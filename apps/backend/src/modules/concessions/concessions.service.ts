import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PromotionsService } from '../ticketing/promotions.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { SetRecipeDto } from './dto/set-recipe.dto';
import { SellConcessionsDto } from './dto/sell-concessions.dto';

/** Signo del movimiento según su tipo — solo SALE_CONSUMPTION y WASTE restan. */
function signedQuantity(type: string, quantity: number): number {
  return type === 'PURCHASE' ? quantity : -quantity;
}

/**
 * Confitería con control de inventario por receta (BOM): el stock real vive en los
 * insumos (Ingredient), no en el producto vendido — vender 1 "Combo mediano" descuenta
 * palomitas + vaso + refresco según lo que su receta declare. Mismo patrón de
 * Hondusport (candado de fila + kardex de movimientos), adaptado a "un producto
 * consume N insumos" en vez de 1:1.
 */
@Injectable()
export class ConcessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promotions: PromotionsService,
  ) {}

  createIngredient(dto: CreateIngredientDto) {
    return this.prisma.ingredient.create({
      data: {
        complexId: dto.complexId,
        name: dto.name,
        unit: dto.unit,
        stock: dto.initialStock ?? 0,
        minStock: dto.minStock,
      },
    });
  }

  listIngredients(complexId?: string) {
    return this.prisma.ingredient.findMany({
      where: { complexId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  /** Movimiento manual de inventario (compra, ajuste por conteo físico, merma) — con candado de fila y kardex. */
  async adjustStock(ingredientId: string, dto: AdjustStockDto, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string; stock: Prisma.Decimal }[]>(
        Prisma.sql`SELECT id, stock FROM ingredients WHERE id = ${ingredientId} FOR UPDATE`,
      );
      const row = rows[0];
      if (!row) throw new NotFoundException('Insumo no encontrado');

      const delta = signedQuantity(dto.type, dto.quantity);
      const newStock = Number(row.stock) + delta;
      if (newStock < 0) {
        throw new ConflictException('Ese movimiento dejaría el inventario en negativo');
      }

      await tx.ingredient.update({ where: { id: ingredientId }, data: { stock: newStock } });
      return tx.stockMovement.create({
        data: {
          ingredientId,
          type: dto.type,
          quantity: delta,
          balanceAfter: newStock,
          note: dto.note,
          actorId,
        },
      });
    });
  }

  listMovements(ingredientId: string) {
    return this.prisma.stockMovement.findMany({
      where: { ingredientId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  createProduct(dto: CreateProductDto) {
    return this.prisma.product.create({ data: dto });
  }

  async listProducts(complexId?: string) {
    const products = await this.prisma.product.findMany({
      where: { complexId, isActive: true },
      orderBy: { name: 'asc' },
      include: { recipe: { include: { ingredient: true } } },
    });
    return products;
  }

  /** Reemplaza la receta completa del producto (no hace merge parcial). */
  async setRecipe(productId: string, dto: SetRecipeDto) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    await this.prisma.$transaction([
      this.prisma.productRecipeItem.deleteMany({ where: { productId } }),
      this.prisma.productRecipeItem.createMany({
        data: dto.items.map((item) => ({
          productId,
          ingredientId: item.ingredientId,
          quantityPerUnit: item.quantityPerUnit,
        })),
      }),
    ]);

    return this.prisma.productRecipeItem.findMany({ where: { productId }, include: { ingredient: true } });
  }

  /**
   * Vende uno o más productos: valida receta y stock, descuenta cada insumo afectado de
   * forma atómica (candado de fila + kardex), y registra la venta. Si cualquier insumo no
   * alcanza, no se descuenta nada y la venta completa se rechaza (todo o nada). Si viene
   * clientId, busca la promoción de confitería más conveniente (motor de promociones,
   * scope ALL_CONCESSIONS — ej. el 10% MetroClub) y la aplica sobre el subtotal.
   */
  async sellProducts(dto: SellConcessionsDto, actorId?: string) {
    const client = dto.clientId
      ? await this.prisma.client.findUnique({ where: { id: dto.clientId, isDeleted: false } })
      : null;
    if (dto.clientId && !client) {
      throw new NotFoundException('Cliente MetroClub no encontrado');
    }

    return this.prisma.$transaction(async (tx) => {
      const productIds = [...new Set(dto.items.map((i) => i.productId))];
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        include: { recipe: true },
      });

      if (products.length !== productIds.length) {
        throw new NotFoundException('Uno o más productos no existen o no están activos');
      }

      const consumption = new Map<string, number>();
      let subtotal = 0;
      for (const item of dto.items) {
        const product = products.find((p) => p.id === item.productId)!;
        subtotal += Number(product.price) * item.quantity;
        for (const line of product.recipe) {
          const needed = Number(line.quantityPerUnit) * item.quantity;
          consumption.set(line.ingredientId, (consumption.get(line.ingredientId) ?? 0) + needed);
        }
      }

      const match = await this.promotions.getApplicableConcessionDiscount(
        { isMetroClub: Boolean(client), complexId: dto.complexId },
        subtotal,
      );
      const discountApplied = match?.discountApplied ?? 0;
      const total = subtotal - discountApplied;

      const sale = await tx.concessionSale.create({
        data: {
          complexId: dto.complexId,
          clientId: client?.id,
          channel: dto.channel,
          subtotal,
          discountApplied,
          promotionId: match?.promotion.id,
          total,
          items: {
            create: dto.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: products.find((p) => p.id === item.productId)!.price,
            })),
          },
        },
        include: { items: { include: { product: true } } },
      });

      // Orden estable para evitar deadlocks entre ventas concurrentes que comparten insumos.
      const ingredientIds = [...consumption.keys()].sort();
      for (const ingredientId of ingredientIds) {
        const needed = consumption.get(ingredientId)!;
        const rows = await tx.$queryRaw<{ id: string; name: string; stock: Prisma.Decimal }[]>(
          Prisma.sql`SELECT id, name, stock FROM ingredients WHERE id = ${ingredientId} FOR UPDATE`,
        );
        const row = rows[0];
        if (!row) throw new NotFoundException(`Insumo ${ingredientId} no encontrado`);

        const newStock = Number(row.stock) - needed;
        if (newStock < 0) {
          throw new ConflictException(`No hay suficiente inventario de "${row.name}" para completar esta venta`);
        }

        await tx.ingredient.update({ where: { id: ingredientId }, data: { stock: newStock } });
        await tx.stockMovement.create({
          data: {
            ingredientId,
            type: 'SALE_CONSUMPTION',
            quantity: -needed,
            balanceAfter: newStock,
            reference: sale.id,
            actorId,
          },
        });
      }

      return sale;
    });
  }

  listSales(complexId?: string) {
    return this.prisma.concessionSale.findMany({
      where: { complexId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { items: { include: { product: true } } },
    });
  }
}
