import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock } };
  let jwt: { signAsync: jest.Mock };

  const user = {
    id: 'user-1',
    name: 'Admin',
    email: 'admin@metrocinemas.hn',
    passwordHash: 'hashed-password',
    role: 'CENTRAL_ADMIN',
    complexId: null,
    isActive: true,
  };

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() } };
    jwt = { signAsync: jest.fn().mockResolvedValue('signed-jwt') };
    service = new AuthService(prisma as never, jwt as never);
    jest.clearAllMocks();
  });

  it('devuelve un access token cuando las credenciales son válidas (RF-16)', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    jwt.signAsync.mockResolvedValue('signed-jwt');

    const result = await service.login(user.email, 'plain-password');

    expect(result.accessToken).toBe('signed-jwt');
    expect(result.user).toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      complexId: user.complexId,
    });
  });

  it('rechaza el login si el usuario no existe', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.login('nadie@metrocinemas.hn', 'x')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza el login si el usuario está inactivo', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...user, isActive: false });

    await expect(service.login(user.email, 'x')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza el login si la contraseña no coincide', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(service.login(user.email, 'wrong-password')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
