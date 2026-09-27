`icon.png`, `icon@2x.png`, `logo.png` y `logo@2x.png` son placeholders de 1×1 px
(transparentes) para que `passkit-generator` pueda construir el `.pkpass` sin
fallar. **Deben reemplazarse con los assets reales de Metrocinemas** antes de
emitir tarjetas a clientes reales:

- `icon.png` / `icon@2x.png`: 29×29 / 58×58 px — ícono que ve el usuario en
  notificaciones y en Wallet.
- `logo.png` / `logo@2x.png`: máx. 160×50 / 320×100 px — logo mostrado en la
  esquina superior de la tarjeta.

Ver `docs/wallet-integration.md` para la lista completa de assets y
credenciales pendientes.
