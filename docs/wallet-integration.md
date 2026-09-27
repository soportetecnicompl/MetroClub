# Integración real de Apple Wallet y Google Wallet

Este documento explica qué falta configurar para que la tarjeta digital
MetroClub funcione en dispositivos reales. El código (`apps/backend/src/modules/wallet/`)
ya implementa la integración completa contra ambas APIs; sin las credenciales
de esta guía, el sistema sigue funcionando (enrolamiento, sellado, canje) pero
omite la parte de Wallet con una advertencia en los logs — no rompe el resto
del flujo.

## Apple Wallet

### Qué genera el código
- `apple/apple-pass.service.ts`: construye y firma el `.pkpass` real con
  `passkit-generator` (sellos, puntos, nombre del cliente, código QR con su id).
- `apple/apple-web-service.controller.ts`: implementa el "Web Service" que
  Apple exige para que el pass reciba actualizaciones automáticas (registro
  de dispositivo, descarga del pass actualizado, logs de error).
- `apple/apple-push.service.ts`: envía el push (APNs, autenticación por
  token) que le avisa al iPhone que su pass cambió.

### Qué falta obtener
1. **Cuenta de Apple Developer Program** (99 USD/año) a nombre de Metrocinemas.
2. **Pass Type ID**: crear un identificador `pass.hn.metrocinemas.metroclub`
   en developer.apple.com → Certificates, Identifiers & Profiles → Identifiers.
3. **Certificado del Pass Type ID**: generarlo desde ese mismo identificador,
   descargarlo (`.cer`) y exportarlo junto a su llave privada a formato PEM:
   ```bash
   openssl x509 -inform der -in pass.cer -out signerCert.pem
   openssl pkcs12 -in Certificates.p12 -nocerts -out signerKey.pem
   ```
4. **Certificado WWDR de Apple** (Apple Worldwide Developer Relations):
   descargar desde https://www.apple.com/certificateauthority/ y convertir a PEM:
   ```bash
   openssl x509 -inform der -in AppleWWDRCAG4.cer -out wwdr.pem
   ```
5. **Llave de autenticación APNs** (.p8, autenticación por token — más simple
   que el certificado push clásico): Apple Developer → Keys → crear una con
   "Apple Push Notifications service (APNs)" habilitado. Anotar el Key ID y
   el Team ID.
6. **Assets de marca**: reemplazar los placeholders en
   `apps/backend/src/modules/wallet/apple/model/` (`icon.png`, `icon@2x.png`,
   `logo.png`, `logo@2x.png`) con el logo real de Metrocinemas (ver el README
   de esa carpeta para las medidas).

### Variables de entorno
```
APPLE_PASS_TYPE_IDENTIFIER=pass.hn.metrocinemas.metroclub
APPLE_TEAM_IDENTIFIER=<Team ID de Apple Developer>
APPLE_PASS_CERT_PATH=/ruta/signerCert.pem
APPLE_PASS_KEY_PATH=/ruta/signerKey.pem
APPLE_PASS_CERT_PASSWORD=<passphrase de la llave>
APPLE_WWDR_CERT_PATH=/ruta/wwdr.pem
APNS_KEY_ID=<Key ID>
APNS_TEAM_ID=<Team ID>
APNS_AUTH_KEY_PATH=/ruta/AuthKey_XXXX.p8
PUBLIC_API_BASE_URL=https://api.metroclub.hn/api
```

`PUBLIC_API_BASE_URL` debe ser una URL pública y accesible por Apple (no
`localhost`) — el pass la usa como `webServiceURL`.

## Google Wallet

### Qué genera el código
- `google/google-wallet.service.ts`: crea la clase de lealtad "MetroClub",
  crea/actualiza el objeto de lealtad del cliente (sellos, puntos) vía la
  Google Wallet REST API, y firma el link "Guardar en Google Wallet" (JWT).
  Las actualizaciones (`PATCH`) se reflejan solas en el pass ya guardado —
  Google no necesita un push aparte como Apple.

### Qué falta obtener
1. **Cuenta de Google Wallet Console** (business.google.com/wallet) a nombre
   de Metrocinemas — se puede empezar en **modo Demo** sin costo ni
   aprobación (permite crear y probar passes reales antes de pedir acceso
   de publicación pública).
2. **Habilitar la Google Wallet API** en el proyecto de Google Cloud
   asociado (Google Cloud Console → APIs y servicios → Habilitar
   `walletobjects.googleapis.com`).
3. **Service account** en ese mismo proyecto de Google Cloud, con su JSON
   de credenciales descargado.
4. **Agregar el email del service account como usuario en Wallet Console**
   (Usuarios → agregar) — sin este paso la API devuelve
   `403 permissionDenied` aunque las credenciales sean válidas.
5. **Logo hosteado en una URL pública HTTPS** (`GOOGLE_WALLET_LOGO_URL`) —
   Google rechaza la creación de la clase de lealtad sin `programLogo`.
   Reemplazar el placeholder por el logo real de Metrocinemas.

Verificado end-to-end en este proyecto (modo Demo): enrolar un cliente crea
la `loyaltyClass` y el `loyaltyObject` reales vía API, y devuelve un link
"Guardar en Google Wallet" (`https://pay.google.com/gp/v/save/...`)
funcional. Una visita/sellado hace `PATCH` del objeto y el cambio se
refleja solo, sin push aparte.

### Variables de entorno
```
GOOGLE_WALLET_ISSUER_ID=<Issuer ID asignado por Google>
GOOGLE_WALLET_SERVICE_ACCOUNT_JSON=/ruta/service-account.json
```
(También acepta el JSON completo inline en la variable, útil en CI/CD.)

## Cómo se prueba sin estas credenciales

Los tests unitarios (`apple-pass.service`, `google-wallet.service` si se
agregan más adelante) validan la lógica pura sin llamar a las APIs reales.
Para una prueba manual end-to-end sin gastar en cuentas de desarrollador,
se puede generar un certificado autofirmado solo para verificar que el
`.pkpass` se arma y firma sin errores (el archivo resultante **no** será
válido en un iPhone real, solo sirve para probar el código):

```bash
openssl req -x509 -newkey rsa:2048 -keyout signerKey.pem -out signerCert.pem -days 1 -nodes -subj "/CN=Test"
```
