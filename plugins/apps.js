/* ============================================================
   插件：应用搜索 — 扫描开始菜单、拼音匹配、手动导入、启动频率
   ============================================================ */

const fs = require('fs')
const path = require('path')
const { app } = require('electron')
const pinyin = require('pinyin-pro')

// ── 开始菜单目录 ──
const START_MENU_DIRS = [
  path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
  path.join(process.env.PROGRAMDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
]

// ── 状态 ──
let cache = []         // 开始菜单扫描结果
let manualApps = []    // 手动导入的应用
let allApps = []       // 合并后的完整列表（用于搜索）
let frecency = new Map()  // 启动频率 <路径, 次数>
let frecencyPath = ''
let manualAppsPath = ''

// ===================================================================
//  开始菜单扫描
// ===================================================================

function scan() {
  const map = new Map()
  for (const dir of START_MENU_DIRS) {
    if (!fs.existsSync(dir)) continue
    walk(dir, map)
  }
  cache = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}

// 递归遍历目录，收集 .lnk 快捷方式
function walk(dir, map) {
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) }
  catch { return }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, map)
    } else if (entry.isFile() && entry.name.endsWith('.lnk') && !entry.name.startsWith('desktop.ini')) {
      const name = entry.name.replace(/\.lnk$/i, '').replace(/ - .*$/, '').trim()
      if (name && !map.has(full)) {
        map.set(full, { name, path: full })
      }
    }
  }
}

// ===================================================================
//  频率记录持久化
// ===================================================================

function loadFrecency() {
  try { frecencyPath = path.join(app.getPath('userData'), 'frecency.json') } catch {}
  if (!frecencyPath) return
  try {
    const data = JSON.parse(fs.readFileSync(frecencyPath, 'utf8'))
    for (const [k, v] of Object.entries(data)) {
      if (v > 0) frecency.set(k, v)
    }
  } catch {}
}

function saveFrecency() {
  try {
    const obj = Object.fromEntries(frecency)
    fs.writeFileSync(frecencyPath, JSON.stringify(obj), 'utf8')
  } catch {}
}

// ===================================================================
//  手动导入应用持久化
// ===================================================================

function loadManualApps() {
  try { manualAppsPath = path.join(app.getPath('userData'), 'manual-apps.json') } catch {}
  if (!manualAppsPath) return
  try {
    manualApps = JSON.parse(fs.readFileSync(manualAppsPath, 'utf8'))
  } catch { manualApps = [] }
}

function saveManualApps() {
  try {
    fs.writeFileSync(manualAppsPath, JSON.stringify(manualApps, null, 2), 'utf8')
  } catch {}
}

// ===================================================================
//  合并缓存
// ===================================================================

// 合并开始菜单 + 手动导入，计算拼音（去重）
function rebuildAllApps() {
  const seen = new Set()
  allApps = []
  for (const item of [...cache, ...manualApps]) {
    if (seen.has(item.path)) continue
    seen.add(item.path)
    allApps.push(item)
  }
  for (const item of allApps) {
    const hasChinese = /[\u4e00-\u9fff]/.test(item.name)
    if (hasChinese) {
      item.pinyinFull = pinyin.pinyin(item.name, { toneType: 'none' }).replace(/\s/g, '')
      item.pinyinFirst = pinyin.pinyin(item.name, { pattern: 'first', toneType: 'none', separator: '' })
    }
  }
}

// ===================================================================
//  插件导出
// ===================================================================

module.exports = {
  name: 'Apps',
  icon: '📱',

  // 初始化：扫描 + 加载频率 + 加载手动导入
  init() {
    scan()
    loadFrecency()
    loadManualApps()
    rebuildAllApps()
  },

  // 记录启动
  trackLaunch(p) {
    frecency.set(p, (frecency.get(p) || 0) + 1)
    saveFrecency()
  },

  // 清空频率记录
  clearFrecency() {
    frecency.clear()
    saveFrecency()
  },

  // ── 手动导入管理 ──
  addManualApp(name, filePath) {
    manualApps.push({ name, path: filePath })
    saveManualApps()
    rebuildAllApps()
  },
  removeManualApp(filePath) {
    manualApps = manualApps.filter(a => a.path !== filePath)
    saveManualApps()
    rebuildAllApps()
  },
  getManualApps() {
    return manualApps.map(a => ({ name: a.name, path: a.path }))
  },

  // 返回启动次数最多的 n 个应用
  getTopApps(n) {
    return allApps
      .map(a => ({ name: a.name, path: a.path, freq: frecency.get(a.path) || 0 }))
      .filter(a => a.freq > 0)
      .sort((a, b) => b.freq - a.freq)
      .slice(0, n)
      .map(a => ({
        title: a.name,
        desc: '回车启动',
        icon: '🚀',
        action: { type: 'openFile', path: a.path },
      }))
  },

  // 搜索：拼音 + 原名 + 频率加权排序
  search(query) {
    const q = query.toLowerCase().trim()
    const scored = []
    for (const a of allApps) {
      const lower = a.name.toLowerCase()
      let match = false, score = 0
      if (lower.startsWith(q))             { match = true; score = 100 }
      else if (lower.includes(q))          { match = true; score = 80 }
      else if (a.pinyinFull?.includes(q))  { match = true; score = 60 }
      else if (a.pinyinFirst?.includes(q)) { match = true; score = 50 }
      if (match) {
        scored.push({
          name: a.name,
          path: a.path,
          score: score + (frecency.get(a.path) || 0) * 50,
        })
      }
    }
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, 8).map(a => ({
      title: a.name,
      desc: '回车启动',
      icon: '🚀',
      action: { type: 'openFile', path: a.path },
    }))
  },
}
