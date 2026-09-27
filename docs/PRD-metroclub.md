# Documento de Requerimientos de Producto (PRD) – Desarrollo Custom

**Proyecto:** Sistema de Fidelización Digital "MetroClub" para Metrocinemas
**Cliente:** Metrocinemas (Honduras)
**Versión:** 1.0 – Lista para desarrollo e implementación
**Fecha:** 25 de septiembre de 2026
**Tipo:** Desarrollo custom (backend + frontend + integraciones)

## 1. Contexto y Objetivo

Metrocinemas es una cadena 100% hondureña con complejos en Tegucigalpa, San Pedro Sula, Santa Rosa de Copán, Choloma, Puerto Cortés, Danlí y otros. Actualmente opera el **Club Cineando** (tarjeta física en taquilla, acumulación de puntos por compras de entradas y confitería, canje por entradas, descuentos y beneficios de cumpleaños).

**Objetivo del proyecto:**
Reemplazar/modernizar el Club Cineando con un sistema digital de baja fricción basado en:
- Chip NFC / lector que el personal acerca al teléfono del cliente.
- Tarjeta digital nativa en **Apple Wallet** y **Google Wallet**.
- Captura de datos mínimos + automatización fuerte por **WhatsApp**.
- Acumulación de sellos/puntos por visitas y gasto.
- Campañas de estrenos, win-back y cumpleaños.

El sistema debe funcionar en todos los complejos de Metrocinemas y ser escalable.

## 2. Alcance del MVP (Fase 1 – listo para desarrollo)

Incluye todo lo necesario para lanzar en 1-2 complejos piloto y luego expandir.

**Incluido:**
- Enrolamiento y sellado por NFC (o QR de respaldo).
- Tarjeta digital en Apple Wallet + Google Wallet.
- Reglas de lealtad configurables (sellos por visita + puntos por gasto).
- Captura de nombre, WhatsApp y fecha de cumpleaños.
- Automatizaciones WhatsApp (post-visita, reseñas, win-back, cumpleaños).
- Panel de administración multi-complejo.
- Reportes básicos de retención y actividad.

**Fuera de alcance del MVP (Fase 2):**
- Integración profunda con el sistema de ticketing actual.
- App nativa propia del cliente.
- Niveles VIP complejos o suscripciones mensuales.
- Integración con sistemas de pago externos.

## 3. Roles de Usuario

| Rol | Descripción |
|-----|-------------|
| Cliente | Espectador que asiste a Metrocinemas |
| Personal de taquilla / confitería | Opera el chip/lector NFC |
| Administrador de complejo | Gestiona su local |
| Administrador central Metrocinemas | Gestiona todos los complejos, campañas y reglas |
| Super-admin (equipo desarrollo) | Configuración técnica y soporte |

## 4. Requerimientos Funcionales (priorizados)

### 4.1 Enrolamiento y Experiencia del Cliente
- RF-01: El personal acerca un chip NFC (o lector) al teléfono del cliente.
- RF-02: Primera vez → se solicita nombre, número de WhatsApp y fecha de cumpleaños + consentimiento explícito.
- RF-03: Se genera automáticamente la tarjeta digital "MetroClub" en Apple Wallet y Google Wallet con logo de Metrocinemas, progreso de sellos y premio actual.
- RF-04: Visitas siguientes → solo "apoya" y se suma el sello/puntos (sin pedir datos de nuevo).
- RF-05: La tarjeta se actualiza en tiempo real (sellos, puntos, premios desbloqueados).

### 4.2 Reglas de Lealtad (configurables por admin)
- RF-06: 1 sello por visita (entrada comprada).
- RF-07: Puntos adicionales por gasto en confitería (ej. 1 punto por cada 10 lempiras).
- RF-08: Premios ejemplo (configurables):
  - 5 sellos → 1 entrada 2D gratis
  - 8 sellos → Combo personal gratis
  - 12 sellos → Entrada VIP o upgrade
- RF-09: La misma tarjeta funciona en **todos** los complejos de Metrocinemas.
- RF-10: Canje de premios (manual por personal o automático).

### 4.3 Automatizaciones por WhatsApp
- RF-11: Mensaje post-visita (2-4 horas después): "¿Cómo estuvo la película en Metrocinemas?" → si positiva, link a Google para dejar reseña.
- RF-12: Win-back: si el cliente no asiste en 30/45/60 días → mensaje con promo de estreno o descuento.
- RF-13: Cumpleaños: saludo + beneficio (popcorn gratis o descuento) 7 días antes.
- RF-14: Campañas de estrenos y eventos (envío masivo o segmentado) con botón de "Ver cartelera / Reservar".
- RF-15: Todos los mensajes deben usar plantillas aprobadas de WhatsApp Business API.

### 4.4 Panel de Administración
- RF-16: Login por rol (complejo / central).
- RF-17: Dashboard con: clientes activos, tasa de retorno, sellos acumulados, reseñas generadas, campañas enviadas.
- RF-18: Gestión de complejos, personal autorizado, reglas de premios y plantillas de mensajes.
- RF-19: Exportación de base de clientes (CSV) y reportes mensuales.
- RF-20: Historial de actividad por cliente.

## 5. Requerimientos No Funcionales
- NFR-01: Tiempo de respuesta del enrolamiento ≤ 3 segundos.
- NFR-02: Disponibilidad 99,5 %.
- NFR-03: Cumplimiento de leyes de protección de datos de Honduras + políticas de Meta.
- NFR-04: Compatible con iOS 16+ y Android 12+.
- NFR-05: Soporte multi-complejo desde el día 1 (al menos 8-10 locales).
- NFR-06: Diseño visual alineado a la identidad de Metrocinemas (colores, logo, tipografía).
- NFR-07: Logs de auditoría y posibilidad de baja del cliente (derecho al olvido).

## 6. Arquitectura Técnica Recomendada
- **Backend:** Node.js (NestJS) + PostgreSQL + Redis.
- **Wallet:** PassKit (Apple) + Google Wallet API (o servicio intermediario para acelerar).
- **WhatsApp:** Meta Cloud API + BSP (recomendado: WATI o similar con buen soporte en Centroamérica).
- **Frontend Admin:** Next.js / React.
- **Experiencia Cliente:** Web responsive (PWA) + deep links a Wallet.
- **NFC:** Chips NTAG213/216 + lectores USB/Bluetooth compatibles (ACR o VTAP).
- **Hosting:** AWS (región más cercana) o Google Cloud.
- **Autenticación:** JWT + roles.

## 7. Entregables y Fases de Implementación

**Fase 1 – MVP (10-14 semanas)**
1. Discovery y diseño UX/UI (2 semanas)
2. Backend core + Wallet + WhatsApp básico (4-5 semanas)
3. Panel admin + flujo NFC (3 semanas)
4. QA, pruebas en 1-2 complejos piloto y ajustes (2-3 semanas)
5. Capacitación al personal y go-live piloto

**Fase 2 (opcional, post-MVP)**
- Integración con sistema de taquilla/ticketing
- Campañas avanzadas y segmentación
- Analytics más profundos
- App de personal (si se requiere)

## 8. Criterios de Aceptación (MVP)
- Un cliente puede enrolarse en < 15 segundos en taquilla o confitería.
- La tarjeta aparece correctamente en Apple Wallet y Google Wallet.
- Los sellos se suman correctamente en cualquier complejo.
- Los mensajes de WhatsApp se envían automáticamente según las reglas.
- El panel muestra métricas reales de los complejos piloto.
- El personal puede operar el sistema con menos de 30 minutos de capacitación.

## 9. Supuestos y Dependencias
- Metrocinemas proporcionará logos, colores y acceso a información de complejos.
- Se contará con números de WhatsApp Business verificados.
- El personal de taquilla/confitería colaborará en las pruebas piloto.
- Se definirán las reglas exactas de sellos y premios junto al equipo de Metrocinemas en la fase de discovery.

## 10. Addendum de Arquitectura — Automatización de WhatsApp

Decisión de arquitectura (post v1.0): la automatización de WhatsApp (RF-11 a RF-15) se
implementa con **n8n** (orquestación de flujos) + **Chatwoot** (bandeja e integración con
WhatsApp Business API), en lugar de una integración directa del backend con la Meta Cloud
API / BSP. El backend sigue siendo la fuente de verdad de plantillas y mensajes
(`WhatsAppTemplate`, `WhatsAppMessage`) y expone/recibe eventos (webhooks) que n8n consume
para disparar los flujos en Chatwoot; Chatwoot gestiona el envío real y las conversaciones.
