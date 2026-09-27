import { BadRequestException } from '@nestjs/common';
import { CheckoutService } from './checkout.service';

describe('CheckoutService', () => {
  let service: CheckoutService;
  let boxOfficeService: { confirmSale: jest.Mock };
  let concessionsService: { sellProducts: jest.Mock };

  beforeEach(() => {
    boxOfficeService = { confirmSale: jest.fn() };
    concessionsService = { sellProducts: jest.fn() };
    service = new CheckoutService(boxOfficeService as never, concessionsService as never);
  });

  it('rechaza un cobro que no trae ni boleto ni confitería', async () => {
    await expect(service.confirmCombinedSale({ complexId: 'complex-1', channel: 'BOX_OFFICE' } as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(boxOfficeService.confirmSale).not.toHaveBeenCalled();
    expect(concessionsService.sellProducts).not.toHaveBeenCalled();
  });

  it('cobra boleto y confitería en una sola llamada y suma el total combinado', async () => {
    boxOfficeService.confirmSale.mockResolvedValue([{ id: 'ticket-1', price: '90' }]);
    concessionsService.sellProducts.mockResolvedValue({ id: 'sale-1', total: '144' });

    const result = await service.confirmCombinedSale({
      complexId: 'complex-1',
      clientId: 'client-1',
      channel: 'BOX_OFFICE',
      ticket: { showtimeId: 'showtime-1', seatIds: ['seat-1'] },
      concessions: { items: [{ productId: 'product-1', quantity: 2 }] },
    } as never);

    expect(boxOfficeService.confirmSale).toHaveBeenCalledWith(
      expect.objectContaining({ showtimeId: 'showtime-1', seatIds: ['seat-1'], clientId: 'client-1' }),
    );
    expect(concessionsService.sellProducts).toHaveBeenCalledWith(
      expect.objectContaining({ complexId: 'complex-1', clientId: 'client-1' }),
    );
    expect(result.grandTotal).toBe(234); // 90 + 144
    expect(result.tickets).toHaveLength(1);
    expect(result.concessionSale).toEqual({ id: 'sale-1', total: '144' });
  });

  it('permite cobrar solo boleto (sin confitería)', async () => {
    boxOfficeService.confirmSale.mockResolvedValue([{ id: 'ticket-1', price: '90' }]);

    const result = await service.confirmCombinedSale({
      complexId: 'complex-1',
      channel: 'BOX_OFFICE',
      ticket: { showtimeId: 'showtime-1', seatIds: ['seat-1'] },
    } as never);

    expect(concessionsService.sellProducts).not.toHaveBeenCalled();
    expect(result.grandTotal).toBe(90);
    expect(result.concessionSale).toBeNull();
  });

  it('permite cobrar solo confitería (sin boleto)', async () => {
    concessionsService.sellProducts.mockResolvedValue({ id: 'sale-1', total: '50' });

    const result = await service.confirmCombinedSale({
      complexId: 'complex-1',
      channel: 'BOX_OFFICE',
      concessions: { items: [{ productId: 'product-1', quantity: 1 }] },
    } as never);

    expect(boxOfficeService.confirmSale).not.toHaveBeenCalled();
    expect(result.grandTotal).toBe(50);
    expect(result.tickets).toEqual([]);
  });

  it('si el boleto ya se vendió pero la confitería falla, el error deja claro qué parte sí se cobró', async () => {
    boxOfficeService.confirmSale.mockResolvedValue([{ id: 'ticket-1', price: '90' }]);
    concessionsService.sellProducts.mockRejectedValue(new Error('No hay suficiente inventario de "Palomitas"'));

    await expect(
      service.confirmCombinedSale({
        complexId: 'complex-1',
        channel: 'BOX_OFFICE',
        ticket: { showtimeId: 'showtime-1', seatIds: ['seat-1'] },
        concessions: { items: [{ productId: 'product-1', quantity: 1 }] },
      } as never),
    ).rejects.toThrow(/ya se vendieron correctamente/);
  });
});
