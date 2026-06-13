/* ============================================================
   渲染进程入口 — 搜索输入、结果渲染、键盘导航、右键菜单、更多菜单
   ============================================================ */

// ── DOM 引用 ──
const input = document.getElementById('search-input')
const list = document.getElementById('result-list')
const searchWrap = document.getElementById('search-wrap')

// ── 状态 ──
let flat = []       // 扁平结果列表（键盘索引用）
let sel = -1        // 当前选中索引
let resizeTimer = null

// ── 防抖：测量内容高度，通知主进程调整窗口 ──
function updateHeight() {
  if (resizeTimer) cancelAnimationFrame(resizeTimer)
  resizeTimer = requestAnimationFrame(() => {
    resizeTimer = null
    const total = searchWrap.offsetHeight + list.scrollHeight
    window.electronAPI.resize(total)
  })
}

// ===================================================================
//  搜索
// ===================================================================

// 每次输入触发搜索
input.addEventListener('input', async () => {
  const q = input.value.trim()
  if (!q) {
    list.innerHTML = emptyHTML()
    flat = []; sel = -1
    updateHeight()
    return
  }
  const plugins = await window.electronAPI.search(q)
  render(plugins, q)
})

// ── 渲染搜索结果 ──
function render(plugins, q) {
  list.innerHTML = ''
  flat = []

  for (const p of plugins) {
    // 插件分组
    const group = document.createElement('div')
    group.className = 'group'

    const hdr = document.createElement('div')
    hdr.className = 'group-header'
    if (p.error) {
      hdr.innerHTML = `${esc(p.pluginIcon)} ${esc(p.pluginName)} <span class="plugin-error" title="${esc(p.error)}">⚠️</span>`
    } else {
      hdr.textContent = `${p.pluginIcon} ${p.pluginName}`
    }
    group.appendChild(hdr)

    // 每项结果
    for (const item of p.items) {
      const el = document.createElement('div')
      el.className = 'item'
      el.dataset.idx = flat.length
      el.title = item.title                     // 悬浮 tooltip 显示全名

      el.innerHTML =
        renderIcon(item.icon || p.pluginIcon) +
        `<div class="body">` +
          `<span class="tl">${highlight(item.title, q)}</span>` +
          `${item.desc ? `<span class="desc">${esc(item.desc)}</span>` : ''}` +
        `</div>`

      const idx = flat.length
      el.addEventListener('click', () => { sel = idx; hl() })
      el.addEventListener('dblclick', () => pick(idx))
      el.addEventListener('contextmenu', async (e) => {
        e.preventDefault()
        sel = idx; hl()
        const menu = await window.electronAPI.getContextMenu({ idx, title: item.title, action: item.action })
        showMenu(menu, idx, e.clientX, e.clientY)
      })
      el.addEventListener('mouseenter', () => { sel = idx; hl() })

      group.appendChild(el)
      flat.push(item)
    }
    list.appendChild(group)
  }

  // 默认选中第一项
  sel = flat.length > 0 ? 0 : -1
  hl()
  if (sel >= 0) scrollInto()
  updateHeight()
}

// ── 图标渲染（支持 data: URI 和 emoji） ──
function renderIcon(icon) {
  if (typeof icon === 'string' && icon.startsWith('data:')) {
    return `<img class="ico-img" src="${esc(icon)}" alt="" />`
  }
  return `<span class="ico">${esc(icon)}</span>`
}

// ── 高亮当前选中项 ──
function hl() {
  list.querySelectorAll('.item').forEach(el => el.classList.remove('sel'))
  const el = list.querySelector(`.item[data-idx="${sel}"]`)
  if (el) el.classList.add('sel')
}

// ── 激活选中项 ──
function pick(idx) {
  if (idx >= 0 && idx < flat.length) window.electronAPI.action(flat[idx].action)
}

// ── 空状态 HTML ──
function emptyHTML() {
  return '<div class="empty">' +
    '<span style="font-size:28px;opacity:0.35">⌨</span>' +
    '<span>按 <kbd>Alt</kbd> + <kbd>Space</kbd> 切换窗口</span></div>'
}

// ===================================================================
//  键盘导航
// ===================================================================

input.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      if (!flat.length) break
      sel = Math.min(sel + 1, flat.length - 1)
      hl(); scrollInto()
      break
    case 'ArrowUp':
      e.preventDefault()
      if (!flat.length) break
      sel = Math.max(sel - 1, 0)
      hl(); scrollInto()
      break
    case 'Enter':
      e.preventDefault()
      if (!flat.length) break
      pick(sel >= 0 ? sel : 0)
      break
    case 'Escape':
      e.preventDefault()
      dismissMenu()
      dismissMoreMenu()
      window.electronAPI.hide()
      break
  }
})

// 滚动到当前选中项
function scrollInto() {
  const el = list.querySelector(`.item[data-idx="${sel}"]`)
  if (el) el.scrollIntoView({ block: 'nearest' })
}

// ===================================================================
//  文本工具
// ===================================================================

// 高亮匹配文字
function highlight(text, query) {
  const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(${q})`, 'gi')
  return esc(text).replace(re, '<em>$1</em>')
}

// HTML 转义
function esc(s) {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

// ===================================================================
//  更多菜单（搜索栏右侧 ··· 按钮）
// ===================================================================

const moreBtn = document.getElementById('more-btn')
let moreDropdown = null

function toggleMoreMenu() {
  dismissMoreMenu()

  moreDropdown = document.createElement('div')
  moreDropdown.className = 'more-dropdown'

  const items = [
    { label: '⚙ 设置', action: () => window.electronAPI.openSettings() },
    { sep: true },
    { label: '✕ 退出', action: () => window.electronAPI.quit() },
  ]

  for (const it of items) {
    if (it.sep) {
      const hr = document.createElement('div')
      hr.className = 'sep'
      moreDropdown.appendChild(hr)
      continue
    }
    const el = document.createElement('div')
    el.className = 'item'
    el.textContent = it.label
    el.addEventListener('click', () => { dismissMoreMenu(); it.action() })
    moreDropdown.appendChild(el)
  }

  document.body.appendChild(moreDropdown)

  const rect = moreBtn.getBoundingClientRect()
  moreDropdown.style.left = rect.left + rect.width - 140 + 'px'
  moreDropdown.style.top = rect.bottom + 4 + 'px'
  requestAnimationFrame(() => moreDropdown.classList.add('open'))
}

function dismissMoreMenu() {
  if (moreDropdown) { moreDropdown.remove(); moreDropdown = null }
}

moreBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  toggleMoreMenu()
})

// 点击外部关闭
document.addEventListener('click', (e) => {
  if (moreDropdown && !moreDropdown.contains(e.target) && e.target !== moreBtn) {
    dismissMoreMenu()
  }
})

// ===================================================================
//  上下文菜单（右键）
// ===================================================================

function showMenu(items, idx, cx, cy) {
  dismissMenu()

  // 遮罩层
  const wrap = document.createElement('div')
  wrap.className = 'menu-overlay'
  wrap.addEventListener('click', dismissMenu)
  wrap.addEventListener('contextmenu', (e) => e.preventDefault())

  // 菜单容器
  const box = document.createElement('div')
  box.className = 'menu-box'
  box.addEventListener('click', (e) => e.stopPropagation())

  for (const it of items) {
    if (it.separator) {
      const hr = document.createElement('div')
      hr.className = 'menu-sep'
      box.appendChild(hr)
      continue
    }
    const el = document.createElement('div')
    el.className = 'menu-item'
    el.innerHTML =
      `<span class="menu-label">${esc(it.label)}</span>` +
      (it.accelerator ? `<span class="menu-accel">${esc(it.accelerator)}</span>` : '')

    el.addEventListener('click', (e) => {
      e.stopPropagation()
      dismissMenu()
      if (it.id === 'pick') { pick(idx); return }
      if (it.id === 'runas') {
        const a = flat[idx].action
        if (a.type === 'openFile' && a.path) {
          window.electronAPI.action({ type: 'runAsAdmin', path: a.path })
        }
        return
      }
      window.electronAPI.action(it.payload)
    })
    box.appendChild(el)
  }

  wrap.appendChild(box)
  document.body.appendChild(wrap)

  // 自动定位，避免超出视口
  const bbox = box.getBoundingClientRect()
  const vw = document.documentElement.clientWidth
  const vh = document.documentElement.clientHeight
  let left = cx, top = cy
  if (left + bbox.width > vw) left = vw - bbox.width - 4
  if (top + bbox.height > vh) top = vh - bbox.height - 4
  box.style.left = Math.max(4, left) + 'px'
  box.style.top = Math.max(4, top) + 'px'
  requestAnimationFrame(() => box.classList.add('open'))
}

function dismissMenu() {
  const wrap = document.querySelector('.menu-overlay')
  if (wrap) wrap.remove()
}

// ===================================================================
//  IPC 事件监听（来自主进程）
// ===================================================================

// 键盘选中项执行（数字键等）
window.electronAPI.onExec((idx) => pick(idx))

// 打开设置窗口
window.electronAPI.onOpenSettings(() => window.electronAPI.openSettings())

// 窗口显示时：展示常用应用或空状态
window.electronAPI.onShow(async () => {
  dismissMoreMenu()
  input.value = ''
  flat = []; sel = -1

  const plugins = await window.electronAPI.getTopApps()
  if (plugins && plugins.length) {
    render(plugins, '')
  } else {
    list.innerHTML = emptyHTML()
  }

  input.focus()
  updateHeight()
})
