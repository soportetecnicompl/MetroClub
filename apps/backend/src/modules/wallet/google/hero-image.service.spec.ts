import { HeroImageService } from './hero-image.service';

describe('HeroImageService', () => {
  it('genera un PNG válido para un progreso de sellos parcial', () => {
    const service = new HeroImageService();

    const buffer = service.render({ stamps: 2, totalStamps: 5, rewardName: 'Entrada 2D gratis' });

    expect(buffer.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('genera un PNG también cuando ya no hay un próximo premio', () => {
    const service = new HeroImageService();

    const buffer = service.render({ stamps: 12, totalStamps: null, rewardName: null });

    expect(buffer.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });
});
