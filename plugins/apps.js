const fs = require('fs')
const path = require('path')
const { app } = require('electron')
const pinyin = require('pinyin-pro')

const START_MENU_DIRS = [
  path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
  path.join(process.env.PROGRAMDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
]

let cache = []
let manualApps = []
let allApps = []
let frecency = new Map()
let frecencyPath = ''
let manualAppsPath = ''
let pinyinCache = {}
let pinyinCachePath = ''

function scan() {
  const map = new Map()
  for (const dir of START_MENU_DIRS) {
    if (!fs.existsSync(dir)) continue
    walk(dir, map)
  }
  cache = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}

function walk(dir, map) {
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) }
  catch { return }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, map)
    } else if (entry.isFile() && entry.name.endsWith('.lnk') && !entry.name.startsWith('desktop.ini')) {
      const name = entry.name.replace(/\.lnk$/i, '')
        .replace(/ - .*$/, '')
        .replace(/\s*\(.*?\)\s*$/, '')
        .replace(/\s[\d]+(?:\.[\d]+)*\s*$/, '')
        .trim()
      if (name && !map.has(full)) {
        map.set(full, { name, path: full })
      }
    }
  }
}

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
  if (!frecencyPath) return
  try {
    fs.writeFileSync(frecencyPath, JSON.stringify(Object.fromEntries(frecency)), 'utf8')
  } catch {}
}

function loadPinyinCache() {
  try { pinyinCachePath = path.join(app.getPath('userData'), 'pinyin-cache.json') } catch {}
  if (!pinyinCachePath) return
  try {
    pinyinCache = JSON.parse(fs.readFileSync(pinyinCachePath, 'utf8'))
  } catch { pinyinCache = {} }
}

function savePinyinCache() {
  if (!pinyinCachePath) return
  try {
    fs.writeFileSync(pinyinCachePath, JSON.stringify(pinyinCache), 'utf8')
  } catch {}
}

function getPinyin(name) {
  if (pinyinCache[name]) return pinyinCache[name]
  if (!/[\u4e00-\u9fff]/.test(name)) return null
  const result = {
    full: pinyin.pinyin(name, { toneType: 'none' }).replace(/\s/g, ''),
    first: pinyin.pinyin(name, { pattern: 'first', toneType: 'none', separator: '' }),
  }
  pinyinCache[name] = result
  return result
}

function loadManualApps() {
  try { manualAppsPath = path.join(app.getPath('userData'), 'manual-apps.json') } catch {}
  if (!manualAppsPath) return
  try {
    manualApps = JSON.parse(fs.readFileSync(manualAppsPath, 'utf8'))
  } catch { manualApps = [] }
}

function saveManualApps() {
  if (!manualAppsPath) return
  try {
    fs.writeFileSync(manualAppsPath, JSON.stringify(manualApps, null, 2), 'utf8')
  } catch {}
}

const ALIAS_MAP = {
  calc: ['calculator'],
  cmd: ['command prompt'],
  note: ['notepad'],
  paint: ['paint', 'mspaint'],
  regedit: ['registry editor'],
  taskmgr: ['task manager'],
  explorer: ['file explorer'],
  ps: ['powershell', 'windows powershell'],
  control: ['control panel'],
  devmgmt: ['device manager'],
  disk: ['disk management'],
  services: ['services'],
  notepad: ['notepad'],
  powershell: ['powershell', 'windows powershell'],
  computer: ['computer management'],
  dfrgui: ['defragment'],
  cleanmgr: ['disk cleanup'],
  resmon: ['resource monitor'],
  dxdiag: ['directx diagnostic'],
  taskschd: ['task scheduler'],
  osk: ['on-screen keyboard'],
  snipping: ['snipping tool'],
  snippingtool: ['snipping tool'],
  mspaint: ['paint'],
}

function rebuildAllApps() {
  const seen = new Set()
  allApps = []
  for (const item of [...cache, ...manualApps]) {
    if (seen.has(item.path)) continue
    seen.add(item.path)
    allApps.push(item)
  }
  for (const item of allApps) {
    const py = getPinyin(item.name)
    if (py) {
      item.pinyinFull = py.full
      item.pinyinFirst = py.first
    }
    const lower = item.name.toLowerCase()
    const appAliases = []
    for (const [alias, targets] of Object.entries(ALIAS_MAP)) {
      if (targets.some(t => lower.includes(t))) appAliases.push(alias)
    }
    if (appAliases.length) item.aliases = appAliases
  }
}

function matchToken(a, token) {
  const lower = a.name.toLowerCase()
  if (lower.startsWith(token)) return 100
  if (lower.includes(token)) return 80
  if (a.aliases) {
    for (const alias of a.aliases) {
      if (alias.startsWith(token)) return 75
      if (alias.includes(token)) return 65
    }
  }
  if (a.pinyinFull?.includes(token)) return 60
  if (a.pinyinFirst?.includes(token)) return 50
  return 0
}

module.exports = {
  name: 'Apps',
  icon: '📱',
  version: '1.1.0',
  description: '扫描开始菜单，支持拼音搜索、频率排序和多关键词',
  author: 'Fast Start',

  init() {
    scan()
    loadFrecency()
    loadManualApps()
    loadPinyinCache()
    rebuildAllApps()
  },

  destroy() {
    saveFrecency()
    savePinyinCache()
  },

  trackLaunch(p) {
    frecency.set(p, (frecency.get(p) || 0) + 1)
    saveFrecency()
  },

  clearFrecency() {
    frecency.clear()
    saveFrecency()
  },

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

  search(query) {
    const q = query.toLowerCase().trim()
    const tokens = q.split(/\s+/).filter(Boolean)
    if (!tokens.length) return []

    const scored = []
    for (const a of allApps) {
      let total = 0, ok = true
      for (const t of tokens) {
        const s = matchToken(a, t)
        if (!s) { ok = false; break }
        total += s
      }
      if (ok) {
        scored.push({
          name: a.name,
          path: a.path,
          score: total + (frecency.get(a.path) || 0) * 50 * tokens.length,
        })
      }
    }

    scored.sort((a, b) => b.score - a.score)
    const limit = q.length <= 2 ? 12 : 8
    return scored.slice(0, limit).map(a => ({
      title: a.name,
      desc: '回车启动',
      icon: '🚀',
      action: { type: 'openFile', path: a.path },
    }))
  },
}
