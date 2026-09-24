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
```

There are no tests in this project.

## Architecture

This is an Electron app built with `electron-vite`. The main window loads a remote web app (`https://portal.yeapdelivery.com.br`) — there is no local renderer UI beyond a stub. The desktop app exists to provide native printing capabilities to that web app.

**Three-process model:**

- `src/main/index.ts` — Main process. Manages the `BrowserWindow`, token storage and IPC registration.
- `src/main/printer.ts` — Print pipeline (validation, per-printer queue, timeouts, page sizing).
- `src/main/logger.ts` — Structured JSON-line logger writing to `<userData>/app.log`. Never log coupon HTML (contains customer PII).
- `src/preload/index.ts` — Preload script. Bridges the renderer (the remote web app) to main via `contextBridge`. Exposes `window.api` with `printOrder`, `printKitchenOrder`, `getPrinters`, token helpers and `ping`.
- `src/renderer/` — Stub only; the real UI is the remote web app.

**IPC channels:**

| Channel | Direction | Purpose |
|---|---|---|
| `print-order` | renderer → main | Print customer coupon HTML to a named printer N times |
| `print-status` | main → renderer | Result of a `print-order` job (`{ success, error? }`) |
| `print-kitchen-order` | renderer → main | Print kitchen ticket HTML |
| `print-kitchen-status` | main → renderer | Result of a `print-kitchen-order` job |
| `get-printers` | renderer ↔ main (invoke) | Returns list of available printer names |

Print payload: `{ couponHtml, printerName, copiesCount (0–20), paperWidthMm? }`. Status messages carry no job id, so the portal cannot correlate concurrent jobs.

**Printing flow:** payload is validated, then enqueued per printer (jobs to the same printer run serially). Each job writes the HTML to a temp file (data URLs cap at ~2MB in Chromium), loads it in one hidden sandboxed window, waits for `document.fonts.ready`, and calls `webContents.print()` silently once per copy, each with a timeout (a hung driver never calls back). When `paperWidthMm` is given, `pageSize` is set to that width and the measured content height; otherwise the driver's default paper is used (thermal drivers often default to A4 or 3276mm rolls, causing blank feed/scaling). `success` only means the spooler accepted the job, not that paper came out.

**Shared code (`src/`):** Types (`src/types/order.ts`), enums (`src/enums/`), and formatting utilities (`src/utils/`) are shared across processes. These model the `Order` domain (products, variations, addresses, payment/delivery types).

**Supported platform:** Windows 10+ x64. Windows 7 support was dropped, which unpinned Electron from 21 (last line supporting Win7 was 22). Development requires Node >= 22.12 (Electron install requirement).

**Build output:** `electron-vite build` compiles to `out/`. Main-process assets live in `resources/` (electron-vite public dir) and are imported with the `?asset` suffix; electron-builder packages that folder (`asarUnpack: resources/**`).
