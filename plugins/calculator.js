const SAFE_MATH_PROPS = new Set([
  'abs', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
  'sqrt', 'pow', 'exp', 'log', 'max', 'min', 'cbrt', 'hypot',
  'floor', 'ceil', 'round', 'sign', 'trunc',
  'PI', 'E', 'LN2', 'LN10', 'LOG2E', 'LOG10E', 'SQRT1_2', 'SQRT2',
])

function safeEval(expr) {
  let s = expr.trim()
  if (!s) return null

  const re = /Math\.(\w+)/g
  let m
  while ((m = re.exec(s))) {
    if (!SAFE_MATH_PROPS.has(m[1])) return null
  }

  let v = s.replace(/Math\.\w+/g, '0')
  v = v.replace(/\d+\.?\d*(?:[eE][+-]?\d+)?/g, '0')
  if (v && !/^[\s+\-*/().,%^0]+$/.test(v)) return null

  s = s.replace(/\^/g, '**')
  const result = Function('"use strict"; return (' + s + ')')()
  if (typeof result !== 'number') return null
  return Number.isFinite(result) ? result : null
}

function formatNumber(n) {
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n)
  const s = n.toFixed(10).replace(/\.?0+$/, '')
  return s.length > 16 ? n.toExponential(4) : s
}

module.exports = {
  name: 'Calculator',
  icon: '🔢',
  version: '1.0.1',
  description: '安全执行数学表达式（支持 Math.* 函数和幂运算）',
  author: 'Fast Start',
  search(query) {
    const result = safeEval(query)
    if (result === null || result === undefined) return []
    return [{
      title: `${query} = ${formatNumber(result)}`,
      desc: '回车复制结果',
      icon: '📋',
      action: { type: 'copy', text: String(result) },
    }]
  },
}
