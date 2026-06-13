// 设置管理器 — 持久化用户偏好到 userData/settings.json
const fs = require('fs')
const path = require('path')
const { app, BrowserWindow } = require('electron')

let settings = {}
let settingsPath = ''
let settingsWin = null  // 追踪设置窗口实例

function loadSettings() {
  try {
    settingsPath = path.join(app.getPath('userData'), 'settings.json')
  } catch {}
  if (!settingsPath) return
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
  } catch { settings = {} }
  applySettings()
}

function saveSettings() {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8')
  } catch {}
  applySettings()
}

function getSettings() {
  return { ...settings }
}

function setSettings(data) {
  settings = { ...settings, ...data }
  saveSettings()
  return getSettings()
}

// 应用持久化设置中需要调用 Electron API 的部分
function applySettings() {
  try {
    app.setLoginItemSettings({ openAtLogin: !!settings.openAtLogin })
  } catch {}
}

// 将窗口级别的设置（如置顶）应用到指定 BrowserWindow
function applyWindowSettings(win) {
  try {
    if (settings.alwaysOnTop !== undefined) {
      win.setAlwaysOnTop(!!settings.alwaysOnTop)
    }
  } catch {}
}

function openSettingsWindow() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.focus()
    return settingsWin
  }
  const win = new BrowserWindow({
    width: 360,
    height: 500,
    resizable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.loadFile(path.join(__dirname, '..', 'renderer', 'settings.html'))
  win.once('ready-to-show', () => {
    const { screen } = require('electron')
    const cursor = screen.getCursorScreenPoint()
    const disp = screen.getDisplayNearestPoint(cursor)
    const wa = disp.workArea
    const [w, h] = win.getSize()
    win.setPosition(
      wa.x + Math.round((wa.width - w) / 2),
      wa.y + Math.round((wa.height - h) / 2),
    )
    win.show()
    win.setAlwaysOnTop(true, 'screen-saver')
  })
  win.on('closed', () => { if (settingsWin === win) settingsWin = null })
  settingsWin = win
  return win
}

module.exports = { loadSettings, getSettings, setSettings, openSettingsWindow, applyWindowSettings }
