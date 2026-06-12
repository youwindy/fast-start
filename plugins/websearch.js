// 插件：网页搜索 — 提供 Google 和 Bing 搜索入口
module.exports = {
  name: 'Web Search',
  icon: '🌐',
  search(query) {
    return [
      {
        title: `Google 搜索 "${query}"`,
        desc: '在默认浏览器中打开',
        icon: '🔍',
        action: { type: 'open', url: `https://www.google.com/search?q=${encodeURIComponent(query)}` },
      },
      {
        title: `Bing 搜索 "${query}"`,
        desc: '在默认浏览器中打开',
        icon: '🔍',
        action: { type: 'open', url: `https://www.bing.com/search?q=${encodeURIComponent(query)}` },
      },
    ]
  },
}
