const { app, BrowserWindow, globalShortcut } = require('electron')
const path = require('path')
const pluginLoader = require('./plugin-loader')
const { registerIPC } = require('./ipc')
const { createTray } = require('./tray')
const settings = require('./settings')

let win

function createWindow() {
  const iconPath = path.join(__dirname, '..', '..', 'resources', 'icon-16.png')
  win = new BrowserWindow({
    width: 640,
    height: 68,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    icon: require('fs').existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))
}

function showWindow() {
  win.setContentSize(640, 68)
  centerOnCursor()
  win.show()
  win.setAlwaysOnTop(true, 'screen-saver')
  win.focus()
  win.webContents.send('show')
}

function centerOnCursor() {
  const { screen } = require('electron')
  const cursor = screen.getCursorScreenPoint()
  const disp = screen.getDisplayNearestPoint(cursor)
  const { x, y, width, height } = disp.workArea
  const [w, h] = win.getContentSize()
  win.setPosition(
    x + Math.round((width - w) / 2),
    y + Math.round((height - h) / 2),
  )
}

app.whenReady().then(() => {
  const plugins = pluginLoader.loadPlugins()
  pluginLoader.initWorker()
  settings.loadSettings()
  createWindow()
  registerIPC(win, plugins, pluginLoader, settings)
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
