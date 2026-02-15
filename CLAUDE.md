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

### Key Patterns

- **Composables** (`src/composables/`) — reusable logic (order filtering, batch operations, toast notifications, Excel export)
- **Path alias:** `@` maps to `src/`
- **Lazy loading:** Most route components use dynamic `import()` except `LoginView` and `OrderCreateView`
- **NavBar selection:** `App.vue` conditionally renders `ProductionNavBar`, `SupplyChainNavBar`, or the default `NavBar` based on `route.meta.role`
- **Build chunking:** Vite config splits vendor bundles into `vendor-xlsx`, `vendor-vue-core`, `vendor-axios`, and a generic `vendor` chunk
