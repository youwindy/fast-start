const fs = require('fs')
const path = require('path')

let plugins = []

function loadPlugins() {
  const dir = path.join(__dirname, '..', '..', 'plugins')
  if (!fs.existsSync(dir)) return []
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
    try {
      const mod = require(path.join(dir, file))
      if (typeof mod.init === 'function') mod.init()
      plugins.push({
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
  return plugins
}

function getPluginsMeta() {
  return plugins.map(p => ({
    id: p.id,
    name: p.name,
    icon: p.icon,
    version: p.version,
    description: p.description,
    author: p.author,
  }))
}

function destroyAllPlugins() {
  for (const p of plugins) {
    try {
      if (typeof p.module.destroy === 'function') p.module.destroy()
    } catch (e) {
      console.error(`[plugin] ${p.id} destroy error:`, e.message)
    }
  }
}

module.exports = { loadPlugins, getPluginsMeta, destroyAllPlugins }
