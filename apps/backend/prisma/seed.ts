import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = 'admin@metrocinemas.hn';
const DEFAULT_ADMIN_PASSWORD = 'MetroClub2026!';

async function main() {
  const complex = await prisma.complex.upsert({
    where: { id: 'complex-piloto' },
    update: {},
    create: {
      id: 'complex-piloto',
      name: 'Cinépolis City Mall',
      city: 'Tegucigalpa',
      address: 'City Mall, Tegucigalpa',
    },
  });

  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: DEFAULT_ADMIN_EMAIL },
    update: {},
    create: {
      name: 'Admin Metrocinemas',
      email: DEFAULT_ADMIN_EMAIL,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
    },
  });

  await prisma.loyaltyRule.upsert({
    where: { id: 'default-rule' },
    update: {},
    create: {
      id: 'default-rule',
      name: 'Regla estándar MetroClub',
      stampsPerVisit: 1,
      pointsPerCurrency: 1,
      currencyUnit: 10,
    },
  });

  const rewards = [
    { id: 'reward-5-stamps', name: 'Entrada 2D gratis', stampsCost: 5 },
    { id: 'reward-8-stamps', name: 'Combo personal gratis', stampsCost: 8 },
    { id: 'reward-12-stamps', name: 'Entrada VIP o upgrade', stampsCost: 12 },
  ];

  for (const reward of rewards) {
    await prisma.reward.upsert({ where: { id: reward.id }, update: {}, create: reward });
  }

  console.log(`Complejo piloto: ${complex.name} (${complex.id})`);
  console.log(`Admin: ${DEFAULT_ADMIN_EMAIL} / ${DEFAULT_ADMIN_PASSWORD}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
