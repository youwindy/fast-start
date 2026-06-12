// 插件加载器 — 扫描 plugins/ 目录，require() 每个 .js 文件，调用 init()
const fs = require('fs')
const path = require('path')

function loadPlugins() {
  const plugins = []
  const dir = path.join(__dirname, '..', '..', 'plugins')
  if (!fs.existsSync(dir)) return plugins
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
    try {
      const mod = require(path.join(dir, file))
      if (typeof mod.init === 'function') mod.init()
      plugins.push({ name: file.replace('.js', ''), module: mod })
    } catch (e) {
      console.error(`[plugin] failed to load ${file}:`, e.message)
    }
  }
  return plugins
}

module.exports = { loadPlugins }
