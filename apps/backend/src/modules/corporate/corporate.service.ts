import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketQrService } from '../ticketing/ticket-qr.service';
import { VoucherQrService } from './voucher-qr.service';
import { CreateCorporateAccountDto } from './dto/create-corporate-account.dto';
import { CreateBatchDto } from './dto/create-batch.dto';
import { RedeemVoucherDto } from './dto/redeem-voucher.dto';

/**
 * Lotes de boletos de cortesía B2B: una empresa recibe N vouchers (QR propios) que sus
 * empleados/clientes van canjeando por boletos reales — cada canje elige función y butaca
 * en el momento (el voucher no está amarrado a una función específica). El "quemado" es
 * el mismo candado atómico que ya usa el resto de boletería: solo se puede canjear una vez.
 */
@Injectable()
export class CorporateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketQr: TicketQrService,
    private readonly voucherQr: VoucherQrService,
  ) {}

  createAccount(dto: CreateCorporateAccountDto) {
    return this.prisma.corporateAccount.create({ data: dto });
  }

  listAccounts() {
    return this.prisma.corporateAccount.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  async createBatch(dto: CreateBatchDto) {
    const batch = await this.prisma.ticketBatch.create({
      data: {
        corporateAccountId: dto.corporateAccountId,
        complexId: dto.complexId,
        quantity: dto.quantity,
        note: dto.note,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });

    await this.prisma.voucher.createMany({
      data: Array.from({ length: dto.quantity }).map(() => {
        const id = randomUUID();
        return { id, batchId: batch.id, qrToken: this.voucherQr.sign(id) };
      }),
    });

    return this.prisma.ticketBatch.findUniqueOrThrow({ where: { id: batch.id }, include: { vouchers: true } });
  }

  /** Todos los lotes (opcionalmente de una sola empresa) con su avance de canje — para el dashboard. */
  async listBatches(corporateAccountId?: string) {
    const batches = await this.prisma.ticketBatch.findMany({
      where: { corporateAccountId },
      orderBy: { createdAt: 'desc' },
      include: { corporateAccount: true, complex: true, vouchers: { select: { status: true } } },
    });

    return batches.map((batch) => {
      const redeemed = batch.vouchers.filter((v) => v.status === 'REDEEMED').length;
      const voided = batch.vouchers.filter((v) => v.status === 'VOID').length;
      return {
        id: batch.id,
        corporateAccount: batch.corporateAccount,
        complex: batch.complex,
        quantity: batch.quantity,
        note: batch.note,
        expiresAt: batch.expiresAt,
        createdAt: batch.createdAt,
        redeemed,
        voided,
        remaining: batch.quantity - redeemed - voided,
      };
    });
  }

  listVouchers(batchId: string) {
    return this.prisma.voucher.findMany({
      where: { batchId },
      orderBy: { createdAt: 'asc' },
      include: { redeemedTicket: { include: { showtime: { include: { movie: true } }, seat: true } } },
    });
  }

  /**
   * Canjea un voucher por un boleto real: la butaca debe estar HELD por esta misma taquilla
   * (mismo flujo de holdSeat que una venta normal) — aquí se confirma en un solo paso atómico
   * junto con el "quemado" del voucher.
   */
  async redeemVoucher(dto: RedeemVoucherDto) {
    const { valid, voucherId } = this.voucherQr.verify(dto.qrToken);
    if (!valid || !voucherId) {
      throw new BadRequestException('Código de voucher inválido o corrupto');
    }

    const voucher = await this.prisma.voucher.findUnique({ where: { id: voucherId }, include: { batch: true } });
    if (!voucher) throw new NotFoundException('Voucher no encontrado');
    if (voucher.batch.expiresAt && voucher.batch.expiresAt < new Date()) {
      throw new BadRequestException('Este lote de boletos ya venció');
    }

    const showtime = await this.prisma.showtime.findUniqueOrThrow({ where: { id: dto.showtimeId } });
    if (showtime.status === 'CANCELLED') {
      throw new BadRequestException('Esta función fue cancelada');
    }

    return this.prisma.$transaction(async (tx) => {
      const claimedVoucher = await tx.voucher.updateMany({
        where: { id: voucherId, status: 'ISSUED' },
        data: { status: 'REDEEMED', redeemedAt: new Date() },
      });
      if (claimedVoucher.count === 0) {
        throw new ConflictException('Este voucher ya fue canjeado o anulado');
      }

      const claimedSeat = await tx.seatHold.updateMany({
        where: { showtimeId: dto.showtimeId, seatId: dto.seatId, status: 'HELD', expiresAt: { gt: new Date() } },
        data: { status: 'CONVERTED' },
      });
      if (claimedSeat.count === 0) {
        throw new ConflictException('Esa butaca ya no está reservada (se venció la reserva o alguien más la tomó)');
      }

      const ticketId = randomUUID();
      const ticket = await tx.ticket.create({
        data: {
          id: ticketId,
          showtimeId: dto.showtimeId,
          seatId: dto.seatId,
          clientId: dto.clientId,
          complexId: showtime.complexId,
          price: 0,
          discountApplied: 0,
          channel: 'CORPORATE',
          qrToken: this.ticketQr.sign(ticketId),
        },
      });

      await tx.voucher.update({ where: { id: voucherId }, data: { redeemedTicketId: ticket.id } });

      return ticket;
    });
  }

  async voidVoucher(voucherId: string) {
    const result = await this.prisma.voucher.updateMany({
      where: { id: voucherId, status: 'ISSUED' },
      data: { status: 'VOID', voidedAt: new Date() },
    });
    if (result.count === 0) {
      throw new ConflictException('Solo se pueden anular vouchers que sigan sin canjear');
    }
    return this.prisma.voucher.findUniqueOrThrow({ where: { id: voucherId } });
  }
}
