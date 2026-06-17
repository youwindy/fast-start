# AGENTS.md

Windows-only Electron launcher (uTools-like). No bundler, no framework, no tests.

## Commands

| Command | Action |
|---|---|
| `npm start` / `npm run dev` | Same thing (`electron .`). App starts hidden; press **`Alt+Space`** to show |
| `npm run dist` | NSIS installer → `release/Fast Start Setup $VERSION.exe` |
| `npm run dist-dir` | Unpacked portable → `release/win-unpacked/` |
| `npm install` | Installs deps. `.npmrc` sets `electron_mirror` to npmmirror.com — without it, Electron download fails or is very slow outside China |
| `npm run postinstall` | Runs after `npm install` automatically (`electron-builder install-app-deps`) — rebuilds native addons for Electron's Node |

## Architecture

```
main process                 Worker thread (plugin-worker.js)
  │                                │
  ├─ loadPlugins() ──require()──►  init() called HERE too
  ├─ initWorker() ──spawns──►  loads plugins + sends 'ready'
  ├─ searchAll() ──postMessage──►  msg.type='search' → 'result'
  ├─ getTopApps() ──postMessage──►  msg.type='getTopApps' → 'result'
  ├─ trackLaunch() ──postMessage──►  msg.type='trackLaunch'
  ├─ reloadPlugins() ──postMessage──►  msg.type='reload' → 'reload-ok'
  ├─ clearFrecency() ──postMessage──►  msg.type='clearFrecency'
  └─ destroyAllPlugins() ──postMessage──►  msg.type='destroy' → process.exit(0)
```

Key file roles:

| Path | Role |
|---|---|
| `src/main/index.js` | App entry: creates BrowserWindow, registers hotkey, wires everything |
| `src/main/plugin-loader.js` | Loads plugins (calls `init()` main-side), spawns/manages Worker, proxies IPC to Worker |
| `src/main/plugin-worker.js` | **Worker thread**. Mocks `require('electron')` → safe `app.getPath()`. Loads all plugins AGAIN, calls `init()` worker-side. Handles search/getTopApps/reload/destroy/trackLaunch |
| `src/main/ipc.js` | All IPC handlers, action dispatch, settings, manual apps, aliases, plugin import, file picker |
| `src/main/icon-extractor.js` | PowerShell-based batch icon extraction (`.lnk`→PNG data URL), with Electron `getFileIcon` fallback |
| `src/main/settings.js` | Settings CRUD → `userData/settings.json`. Manages settings window lifecycle |
| `src/main/tray.js` | System tray + icon (prefers `resources/icon-16.png`, falls back to programmatic bitmap) |
| `src/preload/index.js` | `contextBridge` exposing `window.electronAPI` |
| `src/renderer/app.js` | Search input, keyboard nav, result rendering, context-menu, race-condition guards |
| `src/renderer/settings.html` / `settings-app.js` / `settings.css` | Settings page UI, same `contextBridge` API as main window |

## Critical non-obvious facts

### `init()` runs in BOTH processes
`plugin-loader.js` calls `mod.init()` in the **main process** during `loadPlugins()`.
`plugin-worker.js` also calls `mod.init()` in the **Worker thread** during `loadAll()`.
This means plugin `init()` must be idempotent — it runs twice. Used for preloading data (e.g., scanning Start Menu).

### `trackLaunch()` and `clearFrecency()` run in BOTH processes too
`plugin-loader.js` calls `p.module.trackLaunch()` in the **main process** AND posts a `trackLaunch` message to the Worker. Same pattern for `clearFrecency()`. This means any plugin exporting these functions will have them invoked twice per call. Only `plugins/apps.js` exports them (for frecency tracking).

### Worker IPC protocol
All messages are plain objects with `{ type, id?, ... }`. The `id` field correlates requests to responses. Only search/getTopApps produce a result message; the rest (trackLaunch, clearFrecency, reload, destroy) are fire-and-forget.

### Search timeout
Plugin search has a **5-second hard timeout**. The promise rejects, the worker keeps running, but the result is discarded. Per-plugin errors don't block others.

### Plugins with split main/Worker roles (CRUD + search)
`plugins/aliases.js` and `plugins/apps.js` both export `search()` (Worker-side) **and** CRUD methods called directly from `src/main/ipc.js` in the main process. Aliases exports `getAll`/`addAlias`/`removeAlias`; apps exports `addManualApp`/`removeManualApp`/`getManualApps`/`clearFrecency`. Any new plugin needing main-process I/O can follow the same model: add IPC handlers in ipc.js, export matching methods.

### Worker auto-restarts on crash
If the Worker exits with non-zero code, the main process restarts it after 1 second. Pending search promises are rejected; queued messages during restart are resent once the Worker re-signals `ready`.

### `openSettings` has a 3-second startup guard
The settings window cannot be opened in the first 3 seconds after app starts (`if (Date.now() - appStartTime < 3000) return`). The `open-settings-win` message from the tray also goes through this handler. If settings won't open, this is why.

### Settings window is a singleton
`settings.js` tracks a single `settingsWin` instance. If already open, `openSettingsWindow()` calls `focus()` instead of creating a new window (`settings.js` L55–L57). The settings window loads `settings.html` and only shows on `ready-to-show`.

### Plugin toggle calls `destroy()` / `reloadPlugins()`
When a plugin is disabled in settings, `ipc.js` calls `p.module.destroy()` in the main process (Worker gets no notification). Re-enabling triggers a full `reloadPlugins()` — Worker restarts from scratch, icons cache cleared.

### No hot reload
Worker only reloads plugins via the explicit `reload` message (triggered by settings toggle, plugin import, manual app add/remove). No file watcher.

### `pinyin-pro` is the only runtime dependency
Used for Chinese pinyin search in `plugins/apps.js`.

### No tests, no linter, no formatter
No test runner, no ESLint, no Prettier. Pure `require()` + `module.exports`. Just Electron + vanilla JS.

### Settings storage
All user data persists to `app.getPath('userData')` → `settings.json`, `frecency.json`, `manual-apps.json`, `pinyin-cache.json`. These are JSON files, read/written synchronously.

### Window sizing quirks
- Window starts at `640×68` (compact), grows dynamically as results populate
- Max height clamped to **480px** in main process, minimum **68px**
- Height measured via `getBoundingClientRect().bottom` of last child + padding-bottom (NOT `scrollHeight` — unreliable in flex layouts)
- Window re-centers on cursor screen after each resize
- Multi-monitor: positions on the display containing the cursor

## Plugin system

Create a `.js` file in `plugins/`. Exports:

```js
module.exports = {
  name: string,           // required
  icon: string,           // required (emoji or text)
  version: string,        // optional
  description: string,    // optional
  author: string,         // optional
  init(),                 // optional — runs in BOTH main + worker (must be idempotent)
  destroy(),              // optional — runs in both when disabled/quitting
  search(query) { ... },  // required — (string) => Item[] | Promise<Item[]>
  getTopApps(n) { ... },  // optional — (number) => Item[]
  trackLaunch(p) { ... }, // optional — (string path) => void
  clearFrecency() { ... },// optional — clears frecency data
  getAllPaths() { ... },  // optional — () => string[] for icon preloading
}
```

**Item action types:**

| Type | Fields | Behavior |
|---|---|---|
| `copy` | `text` | Clipboard copy |
| `open` | `url` | Default browser |
| `openFile` | `path` | `shell.openPath()` (supports `.lnk`, `.exe`, `.msc`) |
| `showInFolder` | `path` | `shell.showItemInFolder()` |
| `runAsAdmin` | `path` | PowerShell `Start-Process -Verb RunAs` (path is double-quoted — spaces safe) |
| `run` | `command`, `args?` | `child_process.spawn()` with `shell: true` — supports shell built-ins and PATH resolution |

> `showInFolder` is never produced directly by plugins — it is only used internally by the right-click context menu handler in `ipc.js`. Plugins can emit it if needed.

## Packaging optimizations

`afterPack.js` strips from the Electron bundle:
- Chrome locales (keeps only `en-US.pak` + `zh-CN.pak`)
- SwiftShader / Vulkan / DXIL / DXCompiler / D3DCompiler DLLs
- `LICENSES.chromium.html` (~19 MB)
- `LICENSE.electron.txt`
- `ffmpeg.dll`

## Security posture

- `contextIsolation: true`, `nodeIntegration: false`
- CSP: `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'`
- All IPC via `contextBridge` only
- Worker thread mocks `require('electron')` — plugins cannot access real Electron APIs from the Worker
- Only `init()` / `destroy()` / `trackLaunch()` / `clearFrecency()` run in main process (have real Electron API access)
