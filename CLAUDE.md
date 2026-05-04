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

- `src/main/index.ts` — Main process. Manages the `BrowserWindow`, handles IPC from the renderer, and drives the OS print subsystem. All printing logic lives here.
- `src/preload/index.ts` — Preload script. Bridges the renderer (the remote web app) to main via `contextBridge`. Exposes `window.api` with `printOrder`, `getPrinters`, and `ping`.
- `src/renderer/` — Stub only; the real UI is the remote web app.

**IPC channels:**

| Channel | Direction | Purpose |
|---|---|---|
| `print-order` | renderer → main | Print HTML coupon to a named printer N times |
| `print-status` | main → renderer | Result of a print job (`{ success, error? }`) |
| `get-printers` | renderer ↔ main (invoke) | Returns list of available printer names |

**Printing flow:** `printOrder` sends HTML + printer name + copy count to main. Main opens a hidden `BrowserWindow`, loads the HTML as a data URL, waits for `did-finish-load`, then calls `webContents.print()` silently. Each copy is printed sequentially in a loop.

**Shared code (`src/`):** Types (`src/types/order.ts`), enums (`src/enums/`), and formatting utilities (`src/utils/`) are shared across processes. These model the `Order` domain (products, variations, addresses, payment/delivery types).

**Build output:** `electron-vite build` compiles to `out/`. Static resources (icons) are copied from `resources/` to `out/main/resources/` via `vite-plugin-static-copy`.
