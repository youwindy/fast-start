// 主进程入口 — 创建窗口、加载插件、注册 IPC、系统托盘、全局快捷键
const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron')
const path = require('path')
const { loadPlugins } = require('./plugin-loader')
const { registerIPC } = require('./ipc')
const { createTray } = require('./tray')
const pluginLoader = require('./plugin-loader')
const settings = require('./settings')

let win
let appStartTime = 0

function createWindow() {
  const iconPath = path.join(__dirname, '..', '..', 'resources', 'icon-16.png')
  win = new BrowserWindow({
    width: 640,
    height: 68,                   // 初始最小高度，渲染进程通过 IPC 动态调整
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    icon: require('fs').existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,      // 安全：隔离渲染进程与 Node
      nodeIntegration: false,
    },
  })
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))
}

function showWindow() {
  win.setSize(640, 68)            // 显示前重置高度，由渲染进程重新调整
  centerOnCursor()
  win.show()
  win.setAlwaysOnTop(true, 'screen-saver')
  win.focus()
  win.webContents.send('show')    // 通知渲染进程显示
}

function centerOnCursor() {
  // 将窗口居中于鼠标所在的显示器
  const { screen } = require('electron')
  const cursor = screen.getCursorScreenPoint()
  const disp = screen.getDisplayNearestPoint(cursor)
  const { x, y, width, height } = disp.workArea
  const [w, h] = win.getSize()
  win.setPosition(
    x + Math.round((width - w) / 2),
    y + Math.round((height - h) / 2),
  )
}

app.whenReady().then(() => {
  appStartTime = Date.now()
  const plugins = loadPlugins()
  settings.loadSettings()          // 读取持久化设置（开机启动等）
  createWindow()
  registerIPC(win, plugins, settings)
  createTray(win, showWindow)
  globalShortcut.register('Alt+Space', () => {
    if (win.isVisible()) { win.hide(); return }
    showWindow()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  pluginLoader.destroyAllPlugins()
})
