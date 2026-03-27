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

### Contifico Invoice Payload — Campo Crítico

El payload de factura usa `subtotal_12` (no `subtotal_15`) como base gravable para IVA, independientemente de si la tasa es 12% o 15%. La tasa real se determina por `porcentaje_iva` en cada línea de `detalles`. Si `subtotal_12 = 0`, el SRI rechaza con "ERROR EN DIFERENCIAS (baseImponible = 0)".

**Flujo de facturación:**
- `POST /orders/:id/invoice/generate` — crea factura en Contifico y envía al SRI
- `POST /orders/:id/invoice/regenerate` — elimina factura rota en Contifico y la recrea (fix para SRI)
- `POST /orders/:id/invoice/authorize` — reenvía doc existente al SRI
- `GET /orders/:id/invoice/auth-status` — estado de autorización SRI

### Key Patterns

- **Composables** (`src/composables/`) — reusable logic (order filtering, batch operations, toast notifications, Excel export)
- **Path alias:** `@` maps to `src/`
- **Lazy loading:** Most route components use dynamic `import()` except `LoginView` and `OrderCreateView`
- **NavBar selection:** `App.vue` conditionally renders `ProductionNavBar`, `SupplyChainNavBar`, or the default `NavBar` based on `route.meta.role`
- **Build chunking:** Vite config splits vendor bundles into `vendor-xlsx`, `vendor-vue-core`, `vendor-axios`, and a generic `vendor` chunk
