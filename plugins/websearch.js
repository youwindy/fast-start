const URL_RE = /^https?:\/\//i
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.[a-z]{2,}(\/|$)/i

function isUrl(query) {
  return URL_RE.test(query) || DOMAIN_RE.test(query)
}

const COMMANDS = {
  gh: { name: 'GitHub', url: q => `https://github.com/search?q=${q}` },
  yt: { name: 'YouTube', url: q => `https://www.youtube.com/results?search_query=${q}` },
  w:  { name: 'Wikipedia', url: q => `https://en.wikipedia.org/wiki/${q}` },
  b:  { name: '百度', url: q => `https://www.baidu.com/s?wd=${q}` },
  d:  { name: 'DuckDuckGo', url: q => `https://duckduckgo.com/?q=${q}` },
}

module.exports = {
  name: 'Web Search',
  icon: '🌐',
  version: '1.1.0',
  description: '多搜索引擎 + URL 检测 + 快捷指令 (gh:/yt:/w:/b:/d:)',
  author: 'Fast Start',
  search(query) {
    const q = query.trim()
    if (!q) return []
    const enc = encodeURIComponent

    // URL → 直接打开
    if (isUrl(q)) {
      const url = q.includes('://') ? q : `https://${q}`
      return [{
        title: `打开 ${q}`,
        desc: '在默认浏览器中打开',
        icon: '🌐',
        action: { type: 'open', url },
      }]
    }

    // 快捷指令 gh:xxx / yt:xxx / w:xxx / b:xxx / d:xxx
    const cmdMatch = q.match(/^(gh|yt|w|b|d):\s*(.+)/)
    if (cmdMatch) {
      const [, cmd, rest] = cmdMatch
      const engine = COMMANDS[cmd]
      if (engine && rest) {
        return [{
          title: `${engine.name} 搜索 "${rest}"`,
          desc: '在默认浏览器中打开',
          icon: '🔍',
          action: { type: 'open', url: engine.url(enc(rest)) },
        }]
      }
    }

    return [
      {
        title: `Google 搜索 "${q}"`,
        desc: '在默认浏览器中打开',
        icon: '🔍',
        action: { type: 'open', url: `https://www.google.com/search?q=${enc(q)}` },
      },
      {
        title: `Bing 搜索 "${q}"`,
        desc: '在默认浏览器中打开',
        icon: '🔍',
        action: { type: 'open', url: `https://www.bing.com/search?q=${enc(q)}` },
      },
      {
        title: `DuckDuckGo 搜索 "${q}"`,
        desc: '在默认浏览器中打开',
        icon: '🦆',
        action: { type: 'open', url: `https://duckduckgo.com/?q=${enc(q)}` },
      },
      {
        title: `百度搜索 "${q}"`,
        desc: '在默认浏览器中打开',
        icon: '🔍',
        action: { type: 'open', url: `https://www.baidu.com/s?wd=${enc(q)}` },
      },
    ]
  },
}
