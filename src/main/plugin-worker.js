const { parentPort, workerData } = require('worker_threads')
const fs = require('fs')
const path = require('path')

if (workerData.appData && !process.env.APPDATA) process.env.APPDATA = workerData.appData
if (workerData.programData && !process.env.PROGRAMDATA) process.env.PROGRAMDATA = workerData.programData

const Module = require('module')
const origRequire = Module.prototype.require
Module.prototype.require = function (id) {
  if (id === 'electron') {
    return { app: { getPath: () => workerData.userDataPath || '' } }
  }
  return origRequire.apply(this, arguments)
}

let plugins = []
const pluginsDir = workerData.pluginsDir

function loadAll() {
  for (const p of plugins) {
    try { if (typeof p.module.destroy === 'function') p.module.destroy() } catch {}
  }
  plugins = []

  for (const file of fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js'))) {
    const fp = path.join(pluginsDir, file)
    try { delete require.cache[require.resolve(fp)] } catch {}
    try {
      const mod = require(fp)
      if (typeof mod.init === 'function') mod.init()
      plugins.push({ id: file.replace('.js', ''), module: mod })
    } catch (e) {
      console.error(`[plugin-worker] failed to load ${file}:`, e.stack || e.message)
    }
  }
}

loadAll()
parentPort.postMessage({ type: 'ready' })

parentPort.on('message', (msg) => {
  switch (msg.type) {
    case 'search':
      const sRes = []
      for (const p of plugins) {
        if (msg.enabledStates[p.id] === false) continue
        try {
          const items = p.module.search(msg.query)
          if (items && items.length) {
            sRes.push({ pluginName: p.module.name, pluginIcon: p.module.icon, items })
          }
        } catch (e) {
          sRes.push({ pluginName: p.module.name, pluginIcon: p.module.icon, items: [], error: e.message })
        }
      }
      parentPort.postMessage({ type: 'result', id: msg.id, results: sRes })
      break

    case 'getTopApps':
      const tRes = []
      for (const p of plugins) {
        if (msg.enabledStates[p.id] === false) continue
        if (typeof p.module.getTopApps !== 'function') continue
        try {
          const items = p.module.getTopApps(msg.n)
          if (items && items.length) {
            tRes.push({ pluginName: p.module.name, pluginIcon: p.module.icon, items })
          }
        } catch (e) {
          console.error(`[plugin-worker] ${p.id} getTopApps:`, e.message)
        }
      }
      parentPort.postMessage({ type: 'result', id: msg.id, results: tRes })
      break

    case 'reload':
      loadAll()
      parentPort.postMessage({ type: 'reload-ok' })
      break

    case 'clearFrecency':
      for (const p of plugins) {
        if (typeof p.module.clearFrecency === 'function') {
          try { p.module.clearFrecency() } catch {}
        }
      }
      break

    case 'trackLaunch':
      for (const p of plugins) {
        if (typeof p.module.trackLaunch === 'function') {
          try { p.module.trackLaunch(msg.path) } catch {}
        }
      }
      break

    case 'destroy':
      for (const p of plugins) {
        try { if (typeof p.module.destroy === 'function') p.module.destroy() } catch {}
      }
      process.exit(0)
      break
  }
})
