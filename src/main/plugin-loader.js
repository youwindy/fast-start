const fs = require('fs')
const path = require('path')
const { Worker } = require('worker_threads')
const { app } = require('electron')

let plugins = []
let worker = null
let reqId = 0
let pending = new Map()
let ready = false
let queue = []

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
  return plugins
}

function initWorker() {
  const userDataPath = app.getPath('userData')
  const pluginsDir = path.join(__dirname, '..', '..', 'plugins')

  worker = new Worker(path.join(__dirname, 'plugin-worker.js'), {
    workerData: { pluginsDir, userDataPath },
  })

  worker.on('message', (msg) => {
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

function reloadPlugins() {
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
  reloadPlugins, destroyAllPlugins, validatePlugin, getPluginsMeta,
}
