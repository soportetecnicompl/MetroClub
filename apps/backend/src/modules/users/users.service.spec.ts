import { ConflictException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    service = new UsersService(prisma as never);
  });

  describe('create', () => {
    it('crea un usuario y nunca devuelve el passwordHash (RF-16)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        name: 'Ana',
        email: 'ana@metrocinemas.hn',
        passwordHash: 'hashed',
        role: UserRole.COMPLEX_ADMIN,
        complexId: 'complex-1',
        isActive: true,
      });

      const result = await service.create({
        name: 'Ana',
        email: 'ana@metrocinemas.hn',
        password: 'super-secreta',
        role: UserRole.COMPLEX_ADMIN,
        complexId: 'complex-1',
      });

      expect(result).not.toHaveProperty('passwordHash');
      expect(result).toMatchObject({ id: 'user-1', email: 'ana@metrocinemas.hn' });
    });

    it('rechaza el correo duplicado', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create({
          name: 'Ana',
          email: 'ana@metrocinemas.hn',
          password: 'super-secreta',
          role: UserRole.STAFF,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
