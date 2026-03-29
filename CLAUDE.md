# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server:** `pnpm dev`
- **Build:** `pnpm build` (runs type-check + vite build in parallel)
- **Type-check only:** `pnpm run type-check` (uses `vue-tsc --build`)
- **Format:** `pnpm format` (Prettier on `src/`)
- **No test runner is configured.**

## Tech Stack

- Vue 3 (Composition API with `<script setup>`) + TypeScript + Vite 7
- Pinia for state management
- Vue Router with role-based access control
- Axios via a shared `APIBase` class (`src/services/httpBase.ts`)
- SCSS with global variables/mixins auto-injected via `@/styles/index.scss`
- `xlsx-js-style` for Excel export, `vuedraggable` for drag-and-drop
- pnpm as package manager (Node >=20.19.0 or >=22.12.0)

## Architecture

### Routing & Roles

The router (`src/router/index.ts`) enforces role-based access. Four roles exist:
- **sales** (default) — `/orders/*`, `/reports/*`
- **production** — `/production/*`
- **RetailManager** — `/pos/*`
- **SUPPLY_CHAIN_MANAGER** — `/supply-chain/*`

Auth tokens and user info are stored in `localStorage` (`access_token`, `user_info`). The `App.vue` listens for a custom `auth:token-expired` event to handle forced logout.

### Services Layer

All API services extend `APIBase` (`src/services/httpBase.ts`), which:
- Builds URLs from `VITE_NICOLE_API` env var (defaults to `http://localhost:8101/api`)
- Attaches Bearer token from `localStorage`
- Handles 401 → dispatches `auth:token-expired` event
- Detects slow connections and shows warnings

Individual services (e.g., `order.service.ts`, `production.service.ts`, `delivery.service.ts`) inherit from `APIBase`.

### Styles

Global SCSS is auto-imported into every component via Vite's `css.preprocessorOptions`. The entry point `src/styles/index.scss` forwards:
- `colorVariables.module.scss` — color CSS custom properties
- `fonts.modules.scss` — font declarations

### Dual-Contifico Architecture (Nicole + Sucree)

The platform integrates **two separate Contifico accounts** — one per business entity:

| Source | Business | Env vars |
|--------|----------|----------|
| `nicole` | Nicole Pastry Arts | `CONTIFICO_API_KEY` + `CONTIFICO_TOKEN` |
| `sucree` | Sucree | `CONTIFICO_SUCREE_API_KEY` + `CONTIFICO_SUCREE_TOKEN` |

**Backend (`nicole-order-backapp`):**
- `ContificoService` accepts a `source: 'nicole' | 'sucree'` constructor param — each instance has its own product/category cache.
- `product.controller.ts` creates `nicoleService` and `sucreeService` instances; routes product fetches based on `req.user.contificoSource` from the JWT.
- Products are tagged with `{ source: 'nicole' | 'sucree' }` before being returned to the frontend.
- The product routes require `authMiddleware` so the user's source is available.

**Frontend:**
- `User.contificoSource: 'nicole' | 'sucree' | 'both'` — defaults to `'nicole'`. Set in **Gestión de Equipo** by `admin` or `SALES_MANAGER`.
- `Product.source` and `CartItem.source` track which Contifico each item belongs to.
- `OrderProductSelector` computes `activeCartSource` from the first cart item and blocks products from the other source with a clear message.
- `OrderProductCard` shows a colored brand badge (purple = Nicole, amber = Sucree) and a lock overlay when blocked.
- **Mixing restriction**: A single order can only contain products from one Contifico. Attempting to add from the other brand shows an error: "Para eso son dos pedidos — son dos empresas distintas."

### Contifico Invoice Payload — Reglas Críticas

**1. `subtotal_12` es la base gravable (siempre)**
El payload usa `subtotal_12` (no `subtotal_15`) como base imponible para IVA, sin importar si la tasa es 12% o 15%. Si `subtotal_12 = 0` → SRI rechaza con "ERROR EN DIFERENCIAS".

**2. `tipoIdentificacionComprador` — derivar solo del largo del ID**
- 13 dígitos → RUC (`tipoIdentificacionComprador = "04"`): enviar `ruc = rawId`, `cedula = ""`
- 10 dígitos → Cédula (`tipoIdentificacionComprador = "05"`): enviar `cedula = rawId`, `ruc = rawId + "001"`
- Contifico requiere `ruc` no vacío incluso para cédulas — enviar `ruc = ""` impide que el documento se firme
- NUNCA enviar ambos `cedula` y `ruc` — Contifico genera `tipoIdentificacionComprador = "None"` → SRI rechaza con "ARCHIVO NO CUMPLE ESTRUCTURA XML"
  - **EXCEPCIÓN**: `ruc = cedula + "001"` sí es aceptado porque Contifico lo trata como RUC de persona natural derivado de cédula
- `personType` del frontend NO se usa para este cálculo en el backend
- `tipo: "C"` en `clientePayload` es el marcador de cliente de Contifico, NO afecta el XML del SRI

**3. `sendToSriWhenReady` — timing asíncrono**
Contifico firma documentos de forma asíncrona. Llamar `sendToSri` inmediatamente falla silenciosamente (`sendToSri` retorna `{ error }` sin lanzar). Siempre usar `sendToSriWhenReady` (polling cada 4s hasta que `firmado = true`, max 30s).

**Estados Contifico → SRI:** No Firmado → Firmado → Enviado SRI → Autorizado

**Flujo de facturación:**
- `POST /orders/:id/invoice/generate` — crea factura en Contifico y envía al SRI
- `POST /orders/:id/invoice/regenerate` — repara doc roto (PUT) y reenvía
- `POST /orders/:id/invoice/authorize` — reenvía doc existente al SRI (fix para timing)
- `GET /orders/:id/invoice/auth-status` — estado de autorización SRI

### Batch Invoice Scripts (nicole-order-backapp)

Scripts para operaciones masivas sobre facturas históricas. Ejecutar desde `nicole-order-backapp/`:

| Comando | Script | Propósito |
|---------|--------|-----------|
| `pnpm regen:invoices` | `scripts/regenerate-invoices.ts` | Crea facturas NUEVAS para todas las órdenes sin autorización SRI |
| `pnpm verify:invoices` | `scripts/verify-invoices.ts` | Verifica estado SRI y guarda números de autorización en DB |

**Flujo de reparación masiva:**
1. `pnpm regen:invoices` — crea facturas nuevas y envía al SRI (CHUNK_SIZE=3 para no saturar API)
2. Esperar 5-10 min para que SRI procese
3. `pnpm verify:invoices` — recoge autorizaciones y las guarda en DB
4. Repetir paso 3 hasta que WAITING_SRI = 0

**Regla crítica:** Siempre crear factura **nueva** (`createInvoice`) para órdenes históricas con errores. No intentar reparar con PUT porque los documentos viejos acumulan errores de datos. El script `regenerate-invoices.ts` siempre recrea — nunca repara.

### Key Patterns

- **Composables** (`src/composables/`) — reusable logic (order filtering, batch operations, toast notifications, Excel export)
- **Path alias:** `@` maps to `src/`
- **Lazy loading:** Most route components use dynamic `import()` except `LoginView` and `OrderCreateView`
- **NavBar selection:** `App.vue` conditionally renders `ProductionNavBar`, `SupplyChainNavBar`, or the default `NavBar` based on `route.meta.role`
- **Build chunking:** Vite config splits vendor bundles into `vendor-xlsx`, `vendor-vue-core`, `vendor-axios`, and a generic `vendor` chunk
