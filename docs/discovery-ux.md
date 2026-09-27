# Fase 1 — Discovery y Diseño UX/UI

Entregable de la etapa 1 del plan de implementación del PRD (`docs/PRD-metroclub.md`,
sección 7). Define qué falta levantar con Metrocinemas antes de cerrar el diseño final,
y documenta los flujos de usuario y el inventario de pantallas que ya guían el desarrollo
del MVP.

## 1. Preguntas de discovery para Metrocinemas

### Marca y activos
- Logo en alta resolución (variantes claro/oscuro), paleta de colores oficial y tipografía
  de marca, para Apple/Google Wallet y el panel admin (NFR-06).
- Imagen de fondo/ícono para la tarjeta digital (formatos requeridos por PassKit y Google
  Wallet: `strip.png`, `icon.png`, `logo.png`, etc.).

### Complejos y operación
- Listado completo de complejos activos (nombre, ciudad, dirección) — mínimo 8-10 para el
  día 1 (NFR-05).
- ¿Cuáles 1-2 complejos serán el piloto (Fase 1)?
- ¿Qué hardware NFC ya tienen o van a comprar (chip NTAG21x + lector ACR/VTAP)? ¿Quién lo
  provee?
- ¿El personal de taquilla/confitería usa un dispositivo compartido o cada quien el propio
  celular/tablet para acercar el NFC?

### Reglas de lealtad y migración
- Confirmar las reglas exactas de sellos/puntos y premios (RF-06 a RF-08); las del PRD son
  un placeholder (`5 sellos → entrada 2D`, `8 → combo`, `12 → VIP`).
- ¿Existen datos del "Club Cineando" actual (clientes, saldos de puntos) que deban
  migrarse, o el MVP arranca en cero?
- Reglas de vigencia/expiración de sellos o puntos (no cubiertas aún en el PRD).

### WhatsApp (n8n + Chatwoot)
- Número(s) de WhatsApp Business verificados a usar.
- ¿Chatwoot y n8n los aloja Metrocinemas o el equipo de desarrollo? Credenciales y accesos.
- Copys finales de los mensajes (post-visita, cumpleaños, win-back, campañas) — hoy son
  placeholders en `WhatsAppTemplate`.
- Política de frecuencia/opt-out para cumplir con las políticas de Meta y la ley de
  protección de datos de Honduras (NFR-03).

### Roles y accesos
- Listado de personas por rol (admin central, admin de complejo, staff) para crear cuentas
  reales — hoy el seed no incluye usuarios.
- ¿El staff necesita una cuenta individual o un usuario compartido por taquilla/confitería?

## 2. Flujos de usuario (a validar con el equipo de Metrocinemas)

### 2.1 Enrolamiento (primera visita) — RF-01/RF-02/RF-03
1. Cliente compra su entrada/confitería.
2. Personal acerca el chip/lector NFC al teléfono del cliente (o muestra QR de respaldo).
3. Como es la primera vez, la app pide: nombre, WhatsApp, fecha de cumpleaños y
   consentimiento explícito (checkbox, no premarcado).
4. Sistema crea el cliente y emite el wallet pass (Apple + Google) en < 3s (NFR-01).
5. Cliente recibe un WhatsApp con el link para agregar la tarjeta a su Wallet.

### 2.2 Sellado (visitas siguientes) — RF-04/RF-05
1. Personal acerca el NFC al teléfono del cliente ya enrolado.
2. Sistema identifica al cliente por WhatsApp/serial de NFC, sin pedir datos de nuevo.
3. Se suma el sello/puntos según la regla activa y se refresca el wallet pass en tiempo
   real.
4. 2-4 horas después, WhatsApp automático pidiendo feedback (RF-11).

### 2.3 Canje de premio — RF-10
1. Cliente llega con sellos/puntos suficientes (visible en su wallet pass).
2. Personal verifica en el sistema (o el cliente muestra el pass) y confirma el canje.
3. Sistema descuenta sellos/puntos y registra la redención.

### 2.4 Automatizaciones de retención — RF-12/RF-13/RF-14
- **Win-back**: sin visitas en 30/45/60 días → WhatsApp con promo de estreno.
- **Cumpleaños**: 7 días antes → saludo + beneficio.
- **Campañas**: admin central dispara un mensaje segmentado (ej. "Ver cartelera").
- Estos tres disparadores hoy los evalúa el backend (`WhatsappService`, crons); con la
  decisión de usar **n8n + Chatwoot**, el backend expone/consume webhooks y n8n orquesta el
  envío real (ver addendum en el PRD, sección 10).

### 2.5 Administración — RF-16 a RF-20
1. Admin (central o de complejo) inicia sesión (`/login`).
2. Ve el dashboard con clientes activos, visitas, canjes y reseñas (`/dashboard`).
3. Gestiona complejos (`/complexes`), reglas y premios (`/loyalty`), plantillas de
   WhatsApp (`/templates`).
4. Exporta la base de clientes en CSV para reportes mensuales.

## 3. Inventario de pantallas (MVP)

| Pantalla | Rol | Estado |
|---|---|---|
| Login | Todos | Implementado (scaffold) |
| Dashboard | Admin central/complejo | Implementado (scaffold) |
| Complejos | Admin central | Implementado (scaffold) |
| Lealtad (reglas + premios) | Admin central | Implementado (scaffold) |
| Plantillas WhatsApp | Admin central | Implementado (scaffold) |
| Tarjeta digital (Wallet pass) | Cliente | Pendiente diseño visual final (depende de assets de marca) |
| Pantalla de enrolamiento (tablet/POS staff) | Staff | Pendiente — no está en el admin-web actual |
| Pantalla de sellado rápido (tap NFC) | Staff | Pendiente — no está en el admin-web actual |

## 4. Principios de diseño (mientras se define la marca)

- **Baja fricción primero**: cada pantalla operada por staff debe completarse en pocos
  segundos (NFR-01, criterio de aceptación "< 15s por enrolamiento").
- **Wallet-first**: la tarjeta digital es el artefacto principal que ve el cliente; el
  admin-web es una herramienta interna, no una app de cara al cliente.
- **Multi-complejo por defecto**: cualquier pantalla de datos (dashboard, historial) debe
  soportar filtrar por complejo desde el día 1 (NFR-05).
- **Diseño provisional neutro**: hasta tener los assets de marca de Metrocinemas, las
  pantallas usan una paleta neutra (ver wireframes) que se reemplaza sin tocar la
  estructura.

## 5. Siguiente paso

Con las respuestas de la sección 1 cerradas, el diseño visual final (colores/tipografía de
marca, wallet pass definitivo) se aplica directamente sobre las pantallas ya scaffoldeadas
del admin-web, y se agregan las dos pantallas de staff pendientes (enrolamiento y sellado
rápido) antes del piloto.
