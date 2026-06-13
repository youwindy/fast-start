const path = require('path')
const { app, ipcMain, clipboard, shell, dialog, BrowserWindow } = require('electron')
const { spawn } = require('child_process')

let appStartTime = 0

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('搜索超时')), ms)),
  ])
}

function registerIPC(win, plugins, settings) {
  appStartTime = Date.now()

  ipcMain.handle('search', async (_, query) => {
    const q = query.trim()
    if (!q) return []
    const enabledStates = settings.getSettings().pluginStates || {}
    const results = await Promise.allSettled(
      plugins.map(async p => {
        if (enabledStates[p.id] === false) return null
        try {
          const items = await withTimeout(
            Promise.resolve().then(() => p.module.search(q)),
            5000,
          )
          if (items && items.length) {
            return { pluginName: p.name, pluginIcon: p.icon, items }
          }
        } catch (e) {
          return { pluginName: p.name, pluginIcon: p.icon, items: [], error: e.message }
        }
        return null
      })
    )
    return results
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value)
  })

  ipcMain.on('action', (_, act) => {
    if (!act) return
    switch (act.type) {
      case 'copy': clipboard.writeText(act.text); break
      case 'open': shell.openExternal(act.url); break
      case 'openFile':
        for (const p of plugins) {
          if (typeof p.module.trackLaunch === 'function') p.module.trackLaunch(act.path)
        }
        shell.openPath(act.path)
        break
      case 'showInFolder': shell.showItemInFolder(act.path); break
      case 'runAsAdmin':
        spawn('powershell', ['-Command', `Start-Process -FilePath "${act.path}" -Verb RunAs`], { windowsHide: true })
        break
    }
    win.hide()
  })

  ipcMain.handle('context-menu', (_, item) => {
    const a = item.action
    const result = [
      { id: 'pick', label: '打开', accelerator: 'Enter' },
      { separator: true },
      { id: 'exec', label: '复制标题', payload: { type: 'copy', text: item.title } },
    ]
    if (a.type === 'open' && a.url) {
      result.push({ id: 'exec', label: '复制链接', payload: { type: 'copy', text: a.url } })
    }
    if (a.type === 'copy' && a.text) {
      result.push({ id: 'exec', label: '复制结果', payload: { type: 'copy', text: a.text } })
    }
    if (a.type === 'openFile' && a.path) {
      result.push(
        { separator: true },
        { id: 'exec', label: '打开文件所在位置', payload: { type: 'showInFolder', path: a.path } },
        { id: 'exec', label: '复制路径', payload: { type: 'copy', text: a.path } },
        { separator: true },
        { id: 'runas', label: '以管理员身份运行' },
      )
    }
    return result
  })

  ipcMain.on('resize', (_, h) => {
    win.setSize(640, Math.min(Math.max(h, 68), 480))
    if (win.isVisible()) {
      const { screen } = require('electron')
      const cursor = screen.getCursorScreenPoint()
      const disp = screen.getDisplayNearestPoint(cursor)
      const { x, y, width, height } = disp.workArea
      const [w, h2] = win.getSize()
      win.setPosition(x + Math.round((width - w) / 2), y + Math.round((height - h2) / 2))
    }
  })

  ipcMain.handle('getTopApps', () => {
    const enabledStates = settings.getSettings().pluginStates || {}
    const out = []
    for (const p of plugins) {
      if (enabledStates[p.id] === false) continue
      if (typeof p.module.getTopApps === 'function') {
        try {
          const items = p.module.getTopApps(5)
          if (items && items.length) {
            out.push({ pluginName: p.name, pluginIcon: p.icon, items })
          }
        } catch (e) {
          console.error(`[plugin] ${p.id} getTopApps error:`, e.message)
        }
      }
    }
    return out
  })

  ipcMain.handle('getPlugins', () => {
    const pluginStates = settings.getSettings().pluginStates || {}
    const { getPluginsMeta } = require('./plugin-loader')
    return getPluginsMeta().map(p => ({
      ...p,
      enabled: pluginStates[p.id] !== false,
    }))
  })

  ipcMain.handle('togglePlugin', (_, pluginId) => {
    const s = settings.getSettings()
    const pluginStates = s.pluginStates || {}
    pluginStates[pluginId] = pluginStates[pluginId] === false ? true : false
    settings.setSettings({ ...s, pluginStates })
    const p = plugins.find(p => p.id === pluginId)
    if (p && pluginStates[pluginId] === false && typeof p.module.destroy === 'function') {
      try { p.module.destroy() } catch (e) { console.error(`[plugin] ${pluginId} destroy error:`, e.message) }
    }
    return pluginStates[pluginId]
  })

  ipcMain.handle('getManualApps', () => {
    const p = plugins.find(p => p.id === 'apps')
    if (p && typeof p.module.getManualApps === 'function') return p.module.getManualApps()
    return []
  })

  ipcMain.handle('removeManualApp', (_, filePath) => {
    const p = plugins.find(p => p.id === 'apps')
    if (p && typeof p.module.removeManualApp === 'function') p.module.removeManualApp(filePath)
  })

  ipcMain.handle('addManualApp', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择应用',
      filters: [{ name: '应用程序', extensions: ['exe', 'lnk', 'url'] }],
      properties: ['openFile'],
    })
    if (result.canceled || !result.filePaths.length) return null
    const fp = result.filePaths[0]
    let name = path.basename(fp)
    if (name.endsWith('.lnk')) name = name.replace(/\.lnk$/i, '').replace(/ - .*$/, '').trim()
    else if (name.endsWith('.exe')) name = name.replace(/\.exe$/i, '').trim()
    else if (name.endsWith('.url')) name = name.replace(/\.url$/i, '').trim()
    if (!name) return null
    const p = plugins.find(p => p.id === 'apps')
    if (p && typeof p.module.addManualApp === 'function') p.module.addManualApp(name, fp)
    return { name, path: fp }
  })

  ipcMain.handle('getSettings', () => settings.getSettings())
  ipcMain.handle('setSettings', (_, data) => {
    const s = settings.setSettings(data)
    settings.applyWindowSettings(win)
    return s
  })

  ipcMain.handle('clearFrecency', () => {
    const p = plugins.find(p => p.id === 'apps')
    if (p && typeof p.module.clearFrecency === 'function') p.module.clearFrecency()
  })

  ipcMain.on('openSettings', () => {
    if (Date.now() - appStartTime < 3000) return
    settings.openSettingsWindow()
  })
  ipcMain.on('closeSettings', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.on('hide', () => win.hide())
  ipcMain.on('quit', () => app.quit())
}

module.exports = { registerIPC }
