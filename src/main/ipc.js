// IPC 处理器 — 渲染进程与主进程之间的桥梁（搜索、动作、设置等）
const path = require('path')
const { app, ipcMain, clipboard, shell, dialog, BrowserWindow } = require('electron')
const { spawn } = require('child_process')

let appStartTime = 0

function registerIPC(win, plugins, settings) {
  appStartTime = Date.now()
  // 搜索：将查询分发给所有插件，收集结果
  ipcMain.handle('search', (_, query) => {
    const q = query.trim()
    if (!q) return []
    const out = []
    for (const p of plugins) {
      try {
        const items = p.module.search(q)
        if (items && items.length) {
          out.push({ pluginName: p.module.name, pluginIcon: p.module.icon || '📦', items })
        }
      } catch (e) {
        console.error(`[plugin] ${p.name} search error:`, e.message)
      }
    }
    return out
  })

  // 动作：执行结果项的交互（打开文件、复制文本、打开 URL 等）
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

  // 右键菜单：根据动作类型动态构建菜单项
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

  // 调整窗口高度以适配内容（宽度固定 640，高度自动 68~480）
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

  // 获取常用应用列表（用于打开窗口时展示）
  ipcMain.handle('getTopApps', () => {
    const out = []
    for (const p of plugins) {
      if (typeof p.module.getTopApps === 'function') {
        try {
          const items = p.module.getTopApps(5)
          if (items && items.length) {
            out.push({ pluginName: p.module.name, pluginIcon: p.module.icon || '📦', items })
          }
        } catch (e) {
          console.error(`[plugin] ${p.name} getTopApps error:`, e.message)
        }
      }
    }
    return out
  })

  // 手动导入应用管理：获取列表、删除、添加（文件选择器）
  ipcMain.handle('getManualApps', () => {
    const p = plugins.find(p => p.name === 'apps')
    if (p && typeof p.module.getManualApps === 'function') return p.module.getManualApps()
    return []
  })

  ipcMain.handle('removeManualApp', (_, filePath) => {
    const p = plugins.find(p => p.name === 'apps')
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
    const p = plugins.find(p => p.name === 'apps')
    if (p && typeof p.module.addManualApp === 'function') p.module.addManualApp(name, fp)
    return { name, path: fp }
  })

  // 设置读写
  ipcMain.handle('getSettings', () => settings.getSettings())
  ipcMain.handle('setSettings', (_, data) => {
    const s = settings.setSettings(data)
    settings.applyWindowSettings(win)   // 窗口置顶等设置即时生效
    return s
  })

  // 清除应用启动历史
  ipcMain.handle('clearFrecency', () => {
    const p = plugins.find(p => p.name === 'apps')
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
