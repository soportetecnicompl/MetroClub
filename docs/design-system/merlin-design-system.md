# Merlin Design System — Referencia de estilos
> Generado con el Editor Visual Merlin · 2026-07-17

---

## 1. COLORES

### 1.1 CSS variables

```css
:root {
  /* ── Tipografía ── */
  --font-family: 'Work Sans', sans-serif;

  /* ── Brand Blue ── */
  --blue-hover: #cf8a01;   /* Hover azul */
  --blue-100: #fca801;   /* Títulos, CTAs sec., labels */
  --blue-80: #fdb934;
  --blue-60: #fdcb67;
  --blue-50: #fed480;
  --blue-40: #fedc99;
  --blue-30: #fee5b3;   /* Deshabilitado / subtle */
  --blue-20: #feeecc;
  --blue-10: #fff6e6;   /* Fondo botón Tertiary */

  /* ── Coral / CTA ── */
  --coral-hover: #071026;   /* Hover CTA */
  --coral-100: #09142e;   /* CTA primario, destructivo */
  --coral-60: #6b7282;   /* Deshabilitado fondo */
  --coral-30: #b5b9c0;   /* Deshabilitado texto */
  --coral-10: #e6e8ea;

  /* ── Neutrals ── */
  --black-100: #1e1e1e;   /* Texto body principal */
  --black-60: #606060;   /* Placeholder, helper */
  --black-40: #969696;   /* Texto deshabilitado */
  --black-10: #f3f3f3;   /* Hover inputs */
  --black-0: #ffffff;   /* Cards, botón secondary */

  /* ── Background ── */
  --background-page: #f7f8fb;   /* Fondo pantalla, inputs */

  /* ── Error ── */
  --error-200: #610017;
  --error-150: #910022;   /* Border y texto de error */
  --error-100: #c31a2f;
  --error-10: #fbf3f5;

  /* ── Warning ── */
  --warning-200: #5b3100;
  --warning-150: #a16b00;
  --warning-100: #ffc217;
  --warning-10: #fff3d1;

  /* ── Success ── */
  --success-200: #0b3b26;
  --success-150: #1b8959;
  --success-100: #6cdcab;
  --success-10: #f4fdf9;

  /* ── Informative ── */
  --info-200: #052d65;
  --info-150: #0a53a5;
  --info-100: #227ad1;
  --info-10: #f1f9ff;

  /* ── Gradientes ── */
  --gradient-horizontal: linear-gradient(to right, #0a1631, #fba701);
  --gradient-vertical: linear-gradient(to bottom, #fba701, #121e6c);

  /* ── Tamaños de fuente ── */
  --font-size-header: 48px;
  --font-size-title: 28px;
  --font-size-subtitle: 16px;
  --font-size-body: 16px;
  --font-size-caption: 12px;

  /* ── Border radius ── */
  --radius-sm: 12px;   /* Inputs, botones Action */
  --radius-md: 16px;   /* Cards, alerts, toasts */
  --radius-lg: 18px;
  --radius-xl: 20px;
  --radius-pill: 32px;   /* Botones WEB, drop up */
  --radius-full: 100px;   /* Botones APP, tags */

  /* ── Sombras ── */
  --shadow-2: 0px 4px 12px 0px rgba(18,30,108,0.08);
  --shadow-4: 0px 4px 16px 0px rgba(18,30,108,0.08);
  --shadow-8: 0px 8px 20px 0px rgba(18,30,108,0.08);
  --shadow-12: 0px 12px 28px 0px rgba(18,30,108,0.08);
}
```

### 1.2 Tabla de paleta

| Grupo | Token | Valor | Uso |
|---|---|---|---|
| Brand Blue | `--blue-hover` | `#cf8a01` | Hover azul |
| Brand Blue | `--blue-100` | `#fca801` | Títulos, CTAs sec., labels |
| Brand Blue | `--blue-80` | `#fdb934` | — |
| Brand Blue | `--blue-60` | `#fdcb67` | — |
| Brand Blue | `--blue-50` | `#fed480` | — |
| Brand Blue | `--blue-40` | `#fedc99` | — |
| Brand Blue | `--blue-30` | `#fee5b3` | Deshabilitado / subtle |
| Brand Blue | `--blue-20` | `#feeecc` | — |
| Brand Blue | `--blue-10` | `#fff6e6` | Fondo botón Tertiary |
| Coral / CTA | `--coral-hover` | `#071026` | Hover CTA |
| Coral / CTA | `--coral-100` | `#09142e` | CTA primario, destructivo |
| Coral / CTA | `--coral-60` | `#6b7282` | Deshabilitado fondo |
| Coral / CTA | `--coral-30` | `#b5b9c0` | Deshabilitado texto |
| Coral / CTA | `--coral-10` | `#e6e8ea` | — |
| Neutrals | `--black-100` | `#1e1e1e` | Texto body principal |
| Neutrals | `--black-60` | `#606060` | Placeholder, helper |
| Neutrals | `--black-40` | `#969696` | Texto deshabilitado |
| Neutrals | `--black-10` | `#f3f3f3` | Hover inputs |
| Neutrals | `--black-0` | `#ffffff` | Cards, botón secondary |
| Background | `--background-page` | `#f7f8fb` | Fondo pantalla, inputs |
| Error | `--error-200` | `#610017` | — |
| Error | `--error-150` | `#910022` | Border y texto de error |
| Error | `--error-100` | `#c31a2f` | — |
| Error | `--error-10` | `#fbf3f5` | — |
| Warning | `--warning-200` | `#5b3100` | — |
| Warning | `--warning-150` | `#a16b00` | — |
| Warning | `--warning-100` | `#ffc217` | — |
| Warning | `--warning-10` | `#fff3d1` | — |
| Success | `--success-200` | `#0b3b26` | — |
| Success | `--success-150` | `#1b8959` | — |
| Success | `--success-100` | `#6cdcab` | — |
| Success | `--success-10` | `#f4fdf9` | — |
| Informative | `--info-200` | `#052d65` | — |
| Informative | `--info-150` | `#0a53a5` | — |
| Informative | `--info-100` | `#227ad1` | — |
| Informative | `--info-10` | `#f1f9ff` | — |

---

## 2. TIPOGRAFÍA

**Font family:** `Work Sans`

| Nivel | Size | Weight | Line-Height |
|---|---|---|---|
| Header | 48px | 500 | 52px |
| Title | 28px | 400 | 32px |
| Subtitle | 16px | 600 | 24px |
| Body | 16px | 400 | 24px |
| Caption | 12px | 700 | 16px |

---

## 3. BORDER RADIUS

| Token | Valor | Uso |
|---|---|---|
| `--radius-sm` | 12px | Inputs, botones Action |
| `--radius-md` | 16px | Cards, alerts, toasts |
| `--radius-lg` | 18px | — |
| `--radius-xl` | 20px | — |
| `--radius-pill` | 32px | Botones WEB, drop up |
| `--radius-full` | 100px | Botones APP, tags |

---

## 4. SOMBRAS

```css
--shadow-2: 0px 4px 12px 0px rgba(18,30,108,0.08);
--shadow-4: 0px 4px 16px 0px rgba(18,30,108,0.08);
--shadow-8: 0px 8px 20px 0px rgba(18,30,108,0.08);
--shadow-12: 0px 12px 28px 0px rgba(18,30,108,0.08);
```

---

## 5. BOTONES

| Variante | Fondo | Texto | Border |
|---|---|---|---|
| Primary | `--coral-100` (#09142e) | `--black-0` (#ffffff) | — |
| Secondary | `--black-0` (#ffffff) | `--coral-100` (#09142e) | — |
| Tertiary | `--blue-10` (#fff6e6) | `--blue-100` (#fca801) | — |
| Primary Disabled | `--coral-60` (#6b7282) | `--coral-30` (#b5b9c0) | — |
