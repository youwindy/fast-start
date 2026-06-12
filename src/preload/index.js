// Preload — 通过 contextBridge 向渲染进程暴露安全的 API（不暴露 Node.js）
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  search: (q) => ipcRenderer.invoke('search', q),
  getTopApps: () => ipcRenderer.invoke('getTopApps'),
  addManualApp: () => ipcRenderer.invoke('addManualApp'),
  getManualApps: () => ipcRenderer.invoke('getManualApps'),
  removeManualApp: (p) => ipcRenderer.invoke('removeManualApp', p),
  clearFrecency: () => ipcRenderer.invoke('clearFrecency'),
  getSettings: () => ipcRenderer.invoke('getSettings'),
  setSettings: (s) => ipcRenderer.invoke('setSettings', s),
  openSettings: () => ipcRenderer.send('openSettings'),
  closeSettings: () => ipcRenderer.send('closeSettings'),
  action: (a) => ipcRenderer.send('action', a),
  resize: (h) => ipcRenderer.send('resize', h),
  getContextMenu: (item) => ipcRenderer.invoke('context-menu', item),
  onShow: (cb) => ipcRenderer.on('show', cb),
  onOpenSettings: (cb) => ipcRenderer.on('open-settings-win', cb),
  onExec: (cb) => ipcRenderer.on('exec', (_, idx) => cb(idx)),
  hide: () => ipcRenderer.send('hide'),
  quit: () => ipcRenderer.send('quit'),
})
