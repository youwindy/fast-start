// 插件：计算器 — 安全执行数学表达式，返回可复制的计算结果
function safeEval(expr) {
  if (!/^[\d\s+\-*/().%]+$/.test(expr)) return null
  try { return Function('"use strict"; return (' + expr + ')')() }
  catch { return null }
}

module.exports = {
  name: 'Calculator',
  icon: '🔢',
  search(query) {
    const result = safeEval(query)
    if (result === null || result === undefined) return []
    return [{
      title: `${query} = ${result}`,
      desc: '回车复制结果',
      icon: '📋',
      action: { type: 'copy', text: String(result) },
    }]
  },
}
