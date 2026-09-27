import { WhatsappService } from './whatsapp.service';
import { WhatsAppMessageType } from '@prisma/client';

describe('WhatsappService', () => {
  let service: WhatsappService;
  let prisma: {
    whatsAppTemplate: { findUnique: jest.Mock };
    whatsAppMessage: { create: jest.Mock };
    client: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      whatsAppTemplate: { findUnique: jest.fn() },
      whatsAppMessage: { create: jest.fn() },
      client: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new WhatsappService(prisma as never);
  });

  describe('queueMessage', () => {
    it('encola un mensaje cuando la plantilla existe y está activa', async () => {
      prisma.whatsAppTemplate.findUnique.mockResolvedValue({
        id: 'template-1',
        isActive: true,
      });
      prisma.whatsAppMessage.create.mockResolvedValue({ id: 'message-1' });

      const result = await service.queueMessage('client-1', WhatsAppMessageType.POST_VISIT, 'post_visit_feedback');

      expect(prisma.whatsAppMessage.create).toHaveBeenCalledWith({
        data: { clientId: 'client-1', templateId: 'template-1', type: WhatsAppMessageType.POST_VISIT, status: 'queued' },
      });
      expect(result).toEqual({ id: 'message-1' });
    });

    it('no encola nada si la plantilla no existe', async () => {
      prisma.whatsAppTemplate.findUnique.mockResolvedValue(null);

      const result = await service.queueMessage('client-1', WhatsAppMessageType.POST_VISIT, 'inexistente');

      expect(prisma.whatsAppMessage.create).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('no encola nada si la plantilla está inactiva', async () => {
      prisma.whatsAppTemplate.findUnique.mockResolvedValue({ id: 'template-1', isActive: false });

      const result = await service.queueMessage('client-1', WhatsAppMessageType.WIN_BACK, 'win_back');

      expect(prisma.whatsAppMessage.create).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('schedulePostVisitMessage', () => {
    it('encola la plantilla post_visit_feedback tras una visita (RF-11)', async () => {
      prisma.whatsAppTemplate.findUnique.mockResolvedValue({ id: 'template-1', isActive: true });
      prisma.whatsAppMessage.create.mockResolvedValue({ id: 'message-1' });

      await service.schedulePostVisitMessage('client-1');

      expect(prisma.whatsAppTemplate.findUnique).toHaveBeenCalledWith({ where: { name: 'post_visit_feedback' } });
      expect(prisma.whatsAppMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: WhatsAppMessageType.POST_VISIT }) }),
      );
    });
  });

  describe('sendWinBackCampaigns', () => {
    it('encola la plantilla win_back para cada cliente cuya última visita cumple exactamente un umbral (RF-12)', async () => {
      prisma.client.findMany.mockResolvedValueOnce([{ id: 'client-1' }, { id: 'client-2' }]);
      prisma.whatsAppTemplate.findUnique.mockResolvedValue({ id: 'template-1', isActive: true });
      prisma.whatsAppMessage.create.mockResolvedValue({ id: 'message-1' });

      await service.sendWinBackCampaigns();

      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isDeleted: false }) }),
      );
      expect(prisma.whatsAppMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ clientId: 'client-1', type: WhatsAppMessageType.WIN_BACK }) }),
      );
      expect(prisma.whatsAppMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ clientId: 'client-2', type: WhatsAppMessageType.WIN_BACK }) }),
      );
    });

    it('no encola nada si ningún cliente cae exactamente en los umbrales', async () => {
      await service.sendWinBackCampaigns();

      expect(prisma.whatsAppMessage.create).not.toHaveBeenCalled();
    });
  });
});
