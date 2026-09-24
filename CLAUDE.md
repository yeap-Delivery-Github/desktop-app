# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev mode (electron-vite dev)
npm run build        # Build for current platform
npm run build:mac    # Build macOS distributable
npm run build:win    # Build Windows distributable
npm run build:linux  # Build Linux distributable
npm run lint         # ESLint
npm run format       # Prettier
npm test             # Vitest (pure printing modules: contract, escpos, codepage, html-render, TCP transport)
```

## Architecture

This is an Electron app built with `electron-vite`. The main window loads a remote web app (`https://portal.yeapdelivery.com.br`) — there is no local renderer UI beyond a stub. The desktop app exists to provide native printing capabilities to that web app.

**Three-process model:**

- `src/main/index.ts` — Main process. Manages the `BrowserWindow`, token storage and IPC registration.
- `src/main/printing/` — Print pipeline (see ADR `docs/adr/0001-structured-print-document.md`):
  - `contract.ts` — IPC payload types and validation (new document request and legacy HTML payload).
  - `escpos.ts` / `codepage.ts` — Document → ESC/POS bytes (word wrap, 32/48 columns, CP850/CP860/ascii).
  - `html-render.ts` — Document → HTML for `html` mode (all text escaped).
  - `html-print.ts` — Prints HTML via a hidden sandboxed window and `webContents.print()`.
  - `raw-transport.ts` — Sends RAW bytes: Windows spooler (`WritePrinter` via Koffi, lazy-loaded, win32 only) or TCP 9100.
  - `queue.ts` — Per-printer serial queue and timeouts. `index.ts` — orchestration and `print.*` logs.
- `src/main/logger.ts` — Structured JSON-line logger writing to `<userData>/app.log`. Never log coupon HTML or document text (contains customer PII).
- `src/preload/index.ts` — Preload script. Bridges the renderer (the remote web app) to main via `contextBridge`. Exposes `window.api` with `printDocument`, `printOrder`, `printKitchenOrder`, `getPrinters`, token helpers and `ping`.
- `src/renderer/` — Stub only; the real UI is the remote web app.

**IPC channels:**

| Channel | Direction | Purpose |
|---|---|---|
| `print-order` | renderer → main | Print customer coupon HTML to a named printer N times |
| `print-status` | main → renderer | Result of a `print-order` job (`{ success, error? }`) |
| `print-kitchen-order` | renderer → main | Print kitchen ticket HTML |
| `print-kitchen-status` | main → renderer | Result of a `print-kitchen-order` job |
| `print-document` | renderer ↔ main (invoke) | Print a structured document (ESC/POS or HTML); resolves `{ jobId, success, error? }`. Only accepted from the portal origin |
| `get-printers` | renderer ↔ main (invoke) | Returns list of available printer names |

Legacy payload (`print-order`/`print-kitchen-order`): `{ couponHtml, printerName, copiesCount (0–20), paperWidthMm? }`. Status messages carry no job id. Kept for portal versions that don't detect `window.api.printDocument`.

`print-document` payload: `{ printer: { mode: 'escpos'|'html', connection: { type: 'windows', name } | { type: 'network', host, port? }, paperWidthMm: 58|80, codePage? }, document: { version: 1, blocks }, copies }`. Network hosts must be private IPv4 on ports 9100–9102. Block types: `text`, `row`, `separator`, `feed`, `cut`.

**ESC/POS flow:** document → bytes (copies concatenated into one job) → spooler RAW or TCP. `success` means bytes were handed to the spooler/socket, not that paper came out. Printers with v4 drivers may reject the `RAW` datatype.

**HTML flow:** payload is validated, then enqueued per printer (jobs to the same printer run serially). Each job writes the HTML to a temp file (data URLs cap at ~2MB in Chromium), loads it in one hidden sandboxed window, waits for `document.fonts.ready`, and calls `webContents.print()` silently once per copy, each with a timeout (a hung driver never calls back). When `paperWidthMm` is given, `pageSize` is set to that width and the measured content height; otherwise the driver's default paper is used (thermal drivers often default to A4 or 3276mm rolls, causing blank feed/scaling). `success` only means the spooler accepted the job, not that paper came out.

**Shared code (`src/`):** Types (`src/types/order.ts`), enums (`src/enums/`), and formatting utilities (`src/utils/`) are shared across processes. These model the `Order` domain (products, variations, addresses, payment/delivery types).

**Supported platform:** Windows 10+ x64. Windows 7 support was dropped, which unpinned Electron from 21 (last line supporting Win7 was 22). Development requires Node >= 22.12 (Electron install requirement).

**Build output:** `electron-vite build` compiles to `out/`. Main-process assets live in `resources/` (electron-vite public dir) and are imported with the `?asset` suffix; electron-builder packages that folder (`asarUnpack: resources/**`).
