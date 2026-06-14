const fs = require('fs')
const path = require('path')
const { app } = require('electron')

let aliasesPath = ''
let aliases = []

function save() {
  if (!aliasesPath) return
  try { fs.writeFileSync(aliasesPath, JSON.stringify(aliases, null, 2), 'utf8') } catch {}
}

module.exports = {
  name: 'Aliases',
  icon: '🔗',
  version: '1.0.0',
  description: '用户自定义快捷别名',
  author: 'Fast Start',

  init() {
    try { aliasesPath = path.join(app.getPath('userData'), 'aliases.json') } catch {}
    if (!aliasesPath) return
    try { aliases = JSON.parse(fs.readFileSync(aliasesPath, 'utf8')) } catch { aliases = [] }
  },

  destroy() { save() },

  getAll() { return aliases.map(a => ({ ...a })) },

  addAlias(item) {
    aliases = aliases.filter(a => a.alias !== item.alias)
    aliases.push({ alias: item.alias, title: item.title || item.alias, desc: item.desc || '', icon: item.icon || '🔗', action: item.action })
    save()
  },

  removeAlias(alias) {
    aliases = aliases.filter(a => a.alias !== alias)
    save()
  },

  search(query) {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const match = aliases.find(a => a.alias.toLowerCase() === q)
    if (!match) return []
    return [{
      title: match.title,
      desc: match.desc,
      icon: match.icon,
      action: match.action,
    }]
  },
}
