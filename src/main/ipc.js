const path = require('path')
const fs = require('fs')
const { app, ipcMain, clipboard, shell, dialog, BrowserWindow } = require('electron')
const { spawn } = require('child_process')

let appStartTime = 0

function registerIPC(win, plugins, pluginLoader, settings) {
  appStartTime = Date.now()

  ipcMain.handle('search', async (_, query) => {
    const q = query.trim()
    if (!q) return []
    const enabledStates = settings.getSettings().pluginStates || {}
    try {
      return await pluginLoader.searchAll(q, enabledStates)
    } catch (e) {
      console.error('[ipc] search error:', e.message)
      return []
    }
  })

  ipcMain.on('action', (_, act) => {
    if (!act) return
    switch (act.type) {
      case 'copy': clipboard.writeText(act.text); break
      case 'open': shell.openExternal(act.url); break
      case 'openFile':
        pluginLoader.trackLaunch(act.path)
        shell.openPath(act.path)
        break
      case 'showInFolder': shell.showItemInFolder(act.path); break
      case 'runAsAdmin':
        spawn('powershell', ['-Command', `Start-Process -FilePath "${act.path}" -Verb RunAs`], { windowsHide: true })
        break
      case 'run':
        spawn(act.command, act.args || [], { windowsHide: true, shell: true })
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
    if (a.type === 'run' && a.command) {
      const cmdText = a.command + (a.args ? ' ' + a.args.join(' ') : '')
      result.push({ id: 'exec', label: '复制命令', payload: { type: 'copy', text: cmdText } })
    }
    return result
  })

  ipcMain.on('resize', (_, h) => {
    const clamped = Math.min(Math.max(h, 68), 480)
    win.setContentSize(640, clamped)
    if (win.isVisible()) {
      const { screen } = require('electron')
      const cursor = screen.getCursorScreenPoint()
      const disp = screen.getDisplayNearestPoint(cursor)
      const { x, y, width, height } = disp.workArea
      const [cw, ch] = win.getContentSize()
      win.setPosition(x + Math.round((width - cw) / 2), y + Math.round((height - ch) / 2))
    }
  })

  ipcMain.handle('getTopApps', async () => {
    const enabledStates = settings.getSettings().pluginStates || {}
    try {
      return await pluginLoader.getTopApps(5, enabledStates)
    } catch (e) {
      console.error('[ipc] getTopApps error:', e.message)
      return []
    }
  })

  ipcMain.handle('getPlugins', () => {
    const pluginStates = settings.getSettings().pluginStates || {}
    return pluginLoader.getPluginsMeta().map(p => ({
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
    if (pluginStates[pluginId] !== false) {
      pluginLoader.reloadPlugins()
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
    pluginLoader.reloadPlugins()
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
    pluginLoader.reloadPlugins()
    return { name, path: fp }
  })

  ipcMain.handle('importPlugin', async () => {
    const result = await dialog.showOpenDialog({
      title: '导入插件',
      filters: [{ name: '插件文件', extensions: ['js'] }],
      properties: ['openFile'],
    })
    if (result.canceled || !result.filePaths.length) return null

    const filePath = result.filePaths[0]
    const fileName = path.basename(filePath)

    const validation = pluginLoader.validatePlugin(filePath)
    if (!validation.valid) return validation

    const pluginsDir = path.join(__dirname, '..', '..', 'plugins')
    const dest = path.join(pluginsDir, fileName)
    try {
      fs.copyFileSync(filePath, dest)
    } catch (e) {
      return { success: false, error: `文件复制失败: ${e.message}` }
    }

    // Clean require cache so Worker can load fresh
    try { delete require.cache[require.resolve(dest)] } catch {}

    await pluginLoader.reloadPlugins()
    return {
      success: true,
      plugin: { ...validation.meta, id: fileName.replace('.js', '') },
    }
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
    pluginLoader.reloadPlugins()
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
