module.exports = {
  name: '测试坏插件',
  icon: '💥',
  version: '0.0.1',
  description: '故意写坏的插件，用于测试 Worker 线程错误隔离',
  author: 'Test',

  search(query) {
    throw new Error(`[test-broken] 模拟的错误: query="${query}"`)
  },
}
