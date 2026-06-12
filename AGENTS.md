# AGENTS.md

uTools-like launcher built with Electron — vanilla JS, no bundler.

## Commands

| Command | Action |
|---|---|
| `npm start` / `npm run dev` | Launch the app (hidden, press `Alt+Space` to show) |
| `npm install` | Install dependencies |

## Architecture

| Layer | File | Role |
|---|---|---|
| Main process | `src/main/index.js` | Entry, window, hotkey — delegates to `plugin-loader.js` + `ipc.js` |
| | `src/main/plugin-loader.js` | Plugin loader, calls `init()` if present |
| | `src/main/ipc.js` | All IPC handlers (search, action, resize, context-menu) |
| | `src/main/settings.js` | Settings CRUD + settings window management |
| | `src/main/tray.js` | System tray icon + context menu |
| Preload | `src/preload/index.js` | `contextBridge`-exposed API: `search()`, `action()`, `onShow()`, `hide()`, `quit()` |
| Renderer | `src/renderer/index.html` + `app.js` + `style.css` | Search input + result list, keyboard nav (↑↓ Enter Esc) |
| | `src/renderer/settings.html` + `settings-app.js` + `settings.css` | Settings page (toggles, import, save & quit) |
| Plugins | `plugins/*.js` | Each exports `{ name, icon, search(query) ⇒ items[] }` |

## How it works

- `Alt+Space` toggles the launcher window (frameless, centered, always-on-top)
- Typing invokes `ipcMain.handle('search', …)` which runs every plugin's `search()` in the main process
- Each plugin returns result items with an `action` descriptor (`{ type: 'copy' | 'open', … }`)
- Selection runs the action via `ipcMain.on('action', …)`, then the window hides
- Plugins are `require()`d from `plugins/` directory at startup
- If a plugin exports an `init()` function, it's called after `require()` (used for preloading data, e.g., scanning Start Menu)

## Plugin API

A plugin file must export:

```js
module.exports = {
  name: 'Display name',      // string
  icon: '🔢',                  // string (emoji or text)
  search(query) { … }          // (query: string) ⇒ Item[]
}
```

Each `Item`:

```js
{ title: '…', desc: '…', icon: '…', action: { type: 'copy'|'open', text/url: '…' } }
```

Add new plugins by creating a `.js` file in `plugins/` — no registration needed.

## Security

- `contextIsolation: true`, `nodeIntegration: false`
- CSP set via `<meta>` tag in `index.html`
- All IPC goes through `contextBridge` only
- Plugins run in the **main process** (no sandbox), so review external plugins before adding

## App Icon

| File | Purpose |
|---|---|
| `resources/icon.svg` | Source SVG (blue rounded square + lightning bolt) |
| `resources/icon-*.png` | Generated PNG variants (16/32/48/64/128/256) |

- `tray.js` prefers `resources/icon-16.png` if it exists, else falls back to programmatic bitmap
- `index.js` sets `resources/icon-16.png` as window icon

## Packaging

| Command | Output |
|---|---|
| `npm run dist` | NSIS installer → `release/Fast Start Setup 1.0.0.exe` |
| `npm run dist-dir` | Unpacked portable → `release/win-unpacked/` |

### Optimizations applied

- `compression: maximum` — LZMA compression for NSIS 7z payload
- `asar: true` — code bundled into compressed archive (`app.asar`)
- `removePackageScripts: true` — strips dev-only metadata
- `npmRebuild: false` — no native modules, skip rebuild
- `afterPack.js` removes: 54 unused locale `.pak` (keep only `en-US` + `zh-CN`), SwiftShader/Vulkan, DXIL/DXCompiler, `LICENSES.chromium.html`, `ffmpeg.dll`
- Result: **~79 MB** installer (from ~97 MB baseline)

## Environment

- `.npmrc` sets `electron_mirror=https://npmmirror.com/mirrors/electron/` — Electron downloads use a China mirror
- Electron `^42.4.0` installed as `devDependency`

## Ground rules

- Prefer executable truth over prose — if config and docs disagree, trust config/scripts.
- Keep this file current — when a future session discovers new quirks, add them here.
