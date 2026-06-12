/* ============================================================
   系统托盘 — 图标、左键切换窗口、右键菜单
   ============================================================ */
const { app, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')

function createTray(win, showWindow) {
  // 优先加载 PNG 图标文件，否则使用程序化生成的图标
  let icon
  const iconPath = path.join(__dirname, '..', '..', 'resources', 'icon-16.png')
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath)
  } else {
    icon = nativeImage.createFromBitmap(trayIconBuffer(), { width: 16, height: 16 })
  }

  const tray = new Tray(icon)
  tray.setToolTip('Fast Start — Alt+Space')

  tray.on('click', () => {
    if (win.isVisible()) { win.hide(); return }
    showWindow()
  })

  tray.on('right-click', () => {
    const menu = Menu.buildFromTemplate([
      {
        label: win.isVisible() ? '隐藏窗口' : '显示窗口',
        click: () => {
          if (win.isVisible()) { win.hide(); return }
          showWindow()
        },
      },
      { type: 'separator' },
      {
        label: '设置',
        click: () => { win.webContents.send('open-settings-win') },
      },
      { type: 'separator' },
      { label: '退出', click: () => { app.quit() } },
    ])
    tray.popUpContextMenu(menu)
  })

  return tray
}

/* ── 程序化生成托盘图标（蓝色圆角方块 + 白色闪电） ── */
function trayIconBuffer() {
  const S = 16
  const buf = Buffer.alloc(S * S * 4)

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4

      // 计算到圆角矩形边缘的距离（圆角半径 3）
      const rx = x < 3 ? 3 - x : x > S - 4 ? x - (S - 4) : 0
      const ry = y < 3 ? 3 - y : y > S - 4 ? y - (S - 4) : 0
      const dist = Math.sqrt(rx * rx + ry * ry)

      if (dist > 3.5) {
        // 圆角外：透明
        buf[i+3] = 0
        continue
      }

      // 圆角内：蓝色背景
      buf[i] = 94; buf[i+1] = 175; buf[i+2] = 255; buf[i+3] = 255

      // 绘制白色闪电（由两个三角形组成）
      const inLightning = (
        // 上半部倒三角
        (x >= 5 && x <= 10 && y >= 3 && y <= 7 && x + y >= 8 && y - x <= 0) ||
        // 下半部正三角
        (x >= 6 && x <= 11 && y >= 7 && y <= 12 && x + y >= 12 && x - y >= -2 && x - y <= 4)
      )

      if (inLightning) {
        buf[i] = 255; buf[i+1] = 255; buf[i+2] = 255
      }

      // 边缘抗锯齿
      if (dist > 2.5) {
        const alpha = Math.max(0, 3.5 - dist) / 1
        buf[i+3] = Math.round(255 * alpha)
      }
    }
  }
  return buf
}

module.exports = { createTray }
