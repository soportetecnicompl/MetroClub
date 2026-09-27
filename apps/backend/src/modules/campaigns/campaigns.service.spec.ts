import { CampaignsService } from './campaigns.service';
import { WhatsAppMessageType } from '@prisma/client';

describe('CampaignsService', () => {
  let service: CampaignsService;
  let prisma: { client: { findMany: jest.Mock }; campaign: { create: jest.Mock } };
  let whatsappService: { queueMessage: jest.Mock };

  beforeEach(() => {
    prisma = { client: { findMany: jest.fn() }, campaign: { create: jest.fn() } };
    whatsappService = { queueMessage: jest.fn() };
    service = new CampaignsService(prisma as never, whatsappService as never);
  });

  describe('sendToSegment', () => {
    it('encola la plantilla para cada cliente del segmento y registra la campaña', async () => {
      prisma.client.findMany.mockResolvedValue([{ id: 'client-1' }, { id: 'client-2' }]);
      whatsappService.queueMessage.mockResolvedValueOnce({ id: 'message-1' }).mockResolvedValueOnce(null);
      prisma.campaign.create.mockResolvedValue({ id: 'campaign-1' });

      const result = await service.sendToSegment({ segment: 'at_risk', templateName: 'win_back' });

      expect(whatsappService.queueMessage).toHaveBeenCalledWith('client-1', WhatsAppMessageType.CAMPAIGN, 'win_back');
      expect(whatsappService.queueMessage).toHaveBeenCalledWith('client-2', WhatsAppMessageType.CAMPAIGN, 'win_back');
      // matched = cuántos clientes calzan el segmento; queued = a cuántos sí se les pudo encolar el mensaje.
      expect(result).toEqual({ campaign: { id: 'campaign-1' }, matched: 2, queued: 1 });
    });
  });

  describe('sendToClient', () => {
    it('encola la plantilla para un solo cliente (CTA de la ficha de detalle)', async () => {
      whatsappService.queueMessage.mockResolvedValue({ id: 'message-1' });

      const result = await service.sendToClient({ clientId: 'client-1', templateName: 'win_back' });

      expect(whatsappService.queueMessage).toHaveBeenCalledWith('client-1', WhatsAppMessageType.CAMPAIGN, 'win_back');
      expect(result).toEqual({ queued: true });
    });

    it('reporta queued=false si la plantilla no existe/está inactiva', async () => {
      whatsappService.queueMessage.mockResolvedValue(null);

      const result = await service.sendToClient({ clientId: 'client-1', templateName: 'inexistente' });

      expect(result).toEqual({ queued: false });
    });
  });
});
