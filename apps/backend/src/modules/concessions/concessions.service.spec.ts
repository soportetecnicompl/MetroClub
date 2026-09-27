import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConcessionsService } from './concessions.service';

describe('ConcessionsService', () => {
  let service: ConcessionsService;
  let prisma: {
    ingredient: { create: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    product: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock };
    productRecipeItem: { deleteMany: jest.Mock; createMany: jest.Mock; findMany: jest.Mock };
    stockMovement: { create: jest.Mock; findMany: jest.Mock };
    concessionSale: { create: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      ingredient: { create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      product: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
      productRecipeItem: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
      stockMovement: { create: jest.fn(), findMany: jest.fn() },
      concessionSale: { create: jest.fn(), findMany: jest.fn() },
      $queryRaw: jest.fn(),
      $transaction: jest.fn((arg: unknown) => {
        // Soporta tanto $transaction(cb) como $transaction([...operaciones])
        if (typeof arg === 'function') return (arg as (tx: unknown) => unknown)(prisma);
        return Promise.all(arg as Promise<unknown>[]);
      }),
    };
    service = new ConcessionsService(prisma as never);
  });

  describe('adjustStock', () => {
    it('suma al stock cuando el movimiento es una compra (PURCHASE)', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'ing-1', stock: 10 }]);
      prisma.ingredient.update.mockResolvedValue({});
      prisma.stockMovement.create.mockImplementation((args) => Promise.resolve(args.data));

      const result = await service.adjustStock('ing-1', { type: 'PURCHASE', quantity: 5 } as never);

      expect(prisma.ingredient.update).toHaveBeenCalledWith({ where: { id: 'ing-1' }, data: { stock: 15 } });
      expect(result).toEqual(expect.objectContaining({ quantity: 5, balanceAfter: 15, type: 'PURCHASE' }));
    });

    it('resta del stock cuando el movimiento es una merma (WASTE)', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'ing-1', stock: 10 }]);
      prisma.ingredient.update.mockResolvedValue({});
      prisma.stockMovement.create.mockImplementation((args) => Promise.resolve(args.data));

      const result = await service.adjustStock('ing-1', { type: 'WASTE', quantity: 3 } as never);

      expect(prisma.ingredient.update).toHaveBeenCalledWith({ where: { id: 'ing-1' }, data: { stock: 7 } });
      expect(result).toEqual(expect.objectContaining({ quantity: -3, balanceAfter: 7 }));
    });

    it('rechaza un ajuste que dejaría el inventario en negativo', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'ing-1', stock: 2 }]);

      await expect(service.adjustStock('ing-1', { type: 'WASTE', quantity: 5 } as never)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.ingredient.update).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si el insumo no existe', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(service.adjustStock('fantasma', { type: 'PURCHASE', quantity: 1 } as never)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('sellProducts', () => {
    const combo = {
      id: 'product-1',
      price: 80,
      isActive: true,
      recipe: [
        { ingredientId: 'palomitas', quantityPerUnit: 150 },
        { ingredientId: 'vaso-refresco', quantityPerUnit: 1 },
      ],
    };

    it('descuenta cada insumo según la receta y registra la venta', async () => {
      prisma.product.findMany.mockResolvedValue([combo]);
      prisma.concessionSale.create.mockResolvedValue({ id: 'sale-1' });
      prisma.$queryRaw
        .mockResolvedValueOnce([{ id: 'palomitas', name: 'Palomitas', stock: 1000 }])
        .mockResolvedValueOnce([{ id: 'vaso-refresco', name: 'Vaso de refresco', stock: 20 }]);
      prisma.ingredient.update.mockResolvedValue({});
      prisma.stockMovement.create.mockResolvedValue({});

      const sale = await service.sellProducts({
        complexId: 'complex-1',
        channel: 'BOX_OFFICE',
        items: [{ productId: 'product-1', quantity: 2 }],
      } as never);

      expect(sale).toEqual({ id: 'sale-1' });
      // 2 combos x 150g de palomitas = 300; stock 1000 - 300 = 700
      expect(prisma.ingredient.update).toHaveBeenCalledWith({ where: { id: 'palomitas' }, data: { stock: 700 } });
      // 2 combos x 1 vaso = 2; stock 20 - 2 = 18
      expect(prisma.ingredient.update).toHaveBeenCalledWith({ where: { id: 'vaso-refresco' }, data: { stock: 18 } });
      expect(prisma.concessionSale.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ total: 160 }) }),
      );
    });

    it('rechaza toda la venta (sin descontar nada) si algún insumo no alcanza', async () => {
      prisma.product.findMany.mockResolvedValue([combo]);
      prisma.concessionSale.create.mockResolvedValue({ id: 'sale-1' });
      // Insuficiente palomitas: se pidieron 150 y solo hay 50 — la venta completa debe rechazarse.
      prisma.$queryRaw.mockResolvedValueOnce([{ id: 'palomitas', name: 'Palomitas', stock: 50 }]);

      await expect(
        service.sellProducts({
          complexId: 'complex-1',
          channel: 'BOX_OFFICE',
          items: [{ productId: 'product-1', quantity: 1 }],
        } as never),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.ingredient.update).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si algún producto no existe o está inactivo', async () => {
      prisma.product.findMany.mockResolvedValue([]);

      await expect(
        service.sellProducts({
          complexId: 'complex-1',
          channel: 'BOX_OFFICE',
          items: [{ productId: 'fantasma', quantity: 1 }],
        } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('setRecipe', () => {
    it('reemplaza la receta completa (borra y vuelve a crear, no hace merge)', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'product-1' });
      prisma.productRecipeItem.deleteMany.mockResolvedValue({ count: 2 });
      prisma.productRecipeItem.createMany.mockResolvedValue({ count: 1 });
      prisma.productRecipeItem.findMany.mockResolvedValue([{ id: 'r1', ingredientId: 'palomitas' }]);

      await service.setRecipe('product-1', { items: [{ ingredientId: 'palomitas', quantityPerUnit: 150 }] } as never);

      expect(prisma.productRecipeItem.deleteMany).toHaveBeenCalledWith({ where: { productId: 'product-1' } });
      expect(prisma.productRecipeItem.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [{ productId: 'product-1', ingredientId: 'palomitas', quantityPerUnit: 150 }],
        }),
      );
    });

    it('lanza NotFoundException si el producto no existe', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.setRecipe('fantasma', { items: [] } as never)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
