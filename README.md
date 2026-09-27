# MetroClub — Sistema de Fidelización Digital para Metrocinemas

Reemplazo digital del programa "Club Cineando": tarjeta de lealtad en Apple Wallet / Google Wallet,
enrolamiento por NFC, reglas de sellos/puntos configurables y automatizaciones por WhatsApp.

El PRD completo del proyecto está en [`docs/PRD-metroclub.md`](./docs/PRD-metroclub.md).

## Estructura del monorepo

```
apps/
  backend/     API NestJS (auth, clientes, complejos, lealtad, wallet, whatsapp, campañas, reportes)
  admin-web/   Panel de administración (Next.js)
docs/
  PRD-metroclub.md
```

## Stack

- **Backend:** Node.js + NestJS + PostgreSQL (Prisma) + Redis
- **Admin Frontend:** Next.js + React
- **Wallet:** Apple PassKit + Google Wallet API
- **WhatsApp:** Meta Cloud API (vía BSP)
- **Auth:** JWT + roles (super-admin, admin central, admin de complejo, personal)

## Desarrollo

Requisitos: Node.js 20+, PostgreSQL 15+, Redis 7+.

```bash
npm install

# Backend
cp apps/backend/.env.example apps/backend/.env
npm run dev:backend

# Admin web
npm run dev:admin
```

## Estado del proyecto

Fase 1 (MVP) en desarrollo. Ver alcance y criterios de aceptación en el PRD.
