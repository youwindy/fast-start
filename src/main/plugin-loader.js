const fs = require('fs')
const path = require('path')
const { Worker } = require('worker_threads')
const { app } = require('electron')
const { batchExtractIcons, extractIconFallback } = require('./icon-extractor')

let plugins = []
let worker = null
let reqId = 0
let pending = new Map()
let ready = false
let queue = []
const iconCache = new Map()
let preloading = false

function loadPlugins() {
  const dir = path.join(__dirname, '..', '..', 'plugins')
  if (!fs.existsSync(dir)) return []
  const next = []
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
    const fp = path.join(dir, file)
    try { delete require.cache[require.resolve(fp)] } catch {}
    try {
      const mod = require(fp)
      if (typeof mod.init === 'function') mod.init()
      next.push({
        id: file.replace('.js', ''),
        name: mod.name || file.replace('.js', ''),
        icon: mod.icon || '📦',
        version: mod.version || '0.0.0',
        description: mod.description || '',
        author: mod.author || '',
        module: mod,
      })
    } catch (e) {
      console.error(`[plugin] failed to load ${file}:`, e.message)
    }
  }
  plugins.length = 0
  for (const p of next) plugins.push(p)
  setTimeout(preloadIcons, 500)
  return plugins
}

function initWorker() {
  const userDataPath = app.getPath('userData')
  const pluginsDir = path.join(__dirname, '..', '..', 'plugins')

  worker = new Worker(path.join(__dirname, 'plugin-worker.js'), {
    workerData: {
      pluginsDir,
      userDataPath,
      appData: process.env.APPDATA || '',
      programData: process.env.PROGRAMDATA || '',
    },
  })

  worker.on('message', async (msg) => {
    if (msg.type === 'ready') {
      ready = true
      for (const item of queue) worker.postMessage(item.msg)
      queue = []
      return
    }
    if (msg.type === 'result') {
      const entry = pending.get(msg.id)
      if (!entry) return
      clearTimeout(entry.timeout)
      msg.results = await enrichIcons(msg.results)
      entry.resolve(msg.results)
      pending.delete(msg.id)
      return
    }
    if (msg.type === 'reload-ok') {
      const entry = pending.get('reload')
      if (entry) { entry.resolve(); pending.delete('reload') }
    }
  })

  worker.on('error', (err) => console.error('[plugin-loader] Worker error:', err))

  worker.on('exit', (code) => {
    ready = false
    for (const [, entry] of pending) {
      entry.reject(new Error('Worker 异常退出'))
      clearTimeout(entry.timeout)
    }
    pending.clear()
    if (code !== 0) {
      console.warn(`[plugin-loader] Worker exited (${code}), restarting...`)
      setTimeout(initWorker, 1000)
    }
  })
}

function post(msg) {
  return new Promise((resolve, reject) => {
    const id = ++reqId
    const timeout = setTimeout(() => {
      if (!pending.has(id)) return
      pending.delete(id)
      reject(new Error('搜索超时'))
    }, 5000)
    pending.set(id, { resolve, reject, timeout })
    msg.id = id
    if (ready) { worker.postMessage(msg) }
    else { queue.push({ msg }) }
  })
}

function searchAll(query, enabledStates) {
  return post({ type: 'search', query, enabledStates })
}

function getTopApps(n, enabledStates) {
  return post({ type: 'getTopApps', n, enabledStates })
}

function trackLaunch(filePath) {
  for (const p of plugins) {
    if (typeof p.module.trackLaunch === 'function') p.module.trackLaunch(filePath)
  }
  if (worker && ready) worker.postMessage({ type: 'trackLaunch', path: filePath })
}

async function enrichIcons(results) {
  const needsIcon = []
  for (const pluginResult of results) {
    for (const item of pluginResult.items) {
      if (item.action && item.action.type === 'openFile' && item.action.path && item.icon === '🚀') {
        if (!iconCache.has(item.action.path)) {
          needsIcon.push(item.action.path)
        }
      }
    }
  }
  if (needsIcon.length) {
    const icons = await batchExtractIcons(needsIcon)
    for (const [p, d] of icons) iconCache.set(p, d)
    const failed = needsIcon.filter(fp => !iconCache.has(fp))
    for (const fp of failed) {
      try {
        const dataUrl = await extractIconFallback(fp)
        if (dataUrl) iconCache.set(fp, dataUrl)
      } catch {}
    }
  }
  for (const pluginResult of results) {
    for (const item of pluginResult.items) {
      if (item.action && item.action.type === 'openFile' && item.action.path && item.icon === '🚀') {
        const cached = iconCache.get(item.action.path)
        if (cached) item.icon = cached
      }
    }
  }
  return results
}

function clearFrecency() {
  for (const p of plugins) {
    if (typeof p.module.clearFrecency === 'function') {
      try { p.module.clearFrecency() } catch (e) { console.error(`[plugin] ${p.id} clearFrecency:`, e.message) }
    }
  }
  if (worker && ready) worker.postMessage({ type: 'clearFrecency' })
  return reloadPlugins()
}

async function preloadIcons() {
  if (preloading) return
  preloading = true
  const allPaths = []
  for (const p of plugins) {
    if (typeof p.module.getAllPaths === 'function') {
      try {
        for (const fp of p.module.getAllPaths()) {
          if (!iconCache.has(fp)) allPaths.push(fp)
        }
      } catch {}
    }
  }
  if (!allPaths.length) { preloading = false; return }
  console.log(`[plugin-loader] preloading ${allPaths.length} icons...`)
  const icons = await batchExtractIcons(allPaths)
  for (const [p, d] of icons) iconCache.set(p, d)
  const failed = allPaths.filter(fp => !iconCache.has(fp))
  for (const fp of failed) {
    try {
      const dataUrl = await extractIconFallback(fp)
      if (dataUrl) iconCache.set(fp, dataUrl)
    } catch {}
  }
  console.log(`[plugin-loader] icons ready: ${iconCache.size} cached`)
  preloading = false
}

function reloadPlugins() {
  iconCache.clear()
  loadPlugins()
  if (!worker || !ready) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { pending.delete('reload'); resolve() }, 5000)
    pending.set('reload', { resolve, reject, timeout: t })
    worker.postMessage({ type: 'reload' })
  })
}

function destroyAllPlugins() {
  for (const p of plugins) {
    try { if (typeof p.module.destroy === 'function') p.module.destroy() }
    catch (e) { console.error(`[plugin] ${p.id} destroy error:`, e.message) }
  }
  if (worker) {
    worker.postMessage({ type: 'destroy' })
    setTimeout(() => { try { worker.terminate() } catch {} }, 2000)
  }
}

function validatePlugin(filePath) {
  try {
    const mod = require(filePath)
    if (typeof mod.search !== 'function') {
      return { valid: false, error: '插件文件必须导出 search 函数' }
    }
    return {
      valid: true,
      meta: {
        name: mod.name || path.basename(filePath, '.js'),
        icon: mod.icon || '📦',
        version: mod.version || '0.0.0',
        description: mod.description || '',
        author: mod.author || '',
      },
    }
  } catch (e) {
    return { valid: false, error: `插件加载失败: ${e.message}` }
  }
}

function getPluginsMeta() {
  return plugins.map(p => ({
    id: p.id, name: p.name, icon: p.icon,
    version: p.version, description: p.description, author: p.author,
  }))
}

module.exports = {
  loadPlugins, initWorker, searchAll, getTopApps, trackLaunch,
  reloadPlugins, destroyAllPlugins, validatePlugin, getPluginsMeta, clearFrecency,
}
