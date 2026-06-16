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
let queryId = 0     // 防竞态计数器
let loading = false // 窗口初始化中，阻止 input 事件触发重复 load
let listPad = null  // 缓存 list 的 padding-top / padding-bottom

function getListPad() {
  if (!listPad) {
    const s = getComputedStyle(list)
    listPad = { top: parseFloat(s.paddingTop), bottom: parseFloat(s.paddingBottom) }
  }
  return listPad
}

// ── 同步测量内容高度，通知主进程调整窗口 ──
function updateHeight() {
  const maxH = 480 - searchWrap.offsetHeight
  list.style.maxHeight = (maxH > 0 ? maxH : 0) + 'px'

  const last = list.lastElementChild
  const pad = getListPad()
  const h = last
    ? Math.ceil(last.getBoundingClientRect().bottom + pad.bottom)
    : Math.ceil(searchWrap.offsetHeight + pad.top + pad.bottom)
  window.electronAPI.resize(Math.max(68, h))
}

// ===================================================================
//  事件委托 — 条目的 click / dblclick / contextmenu / hover
// ===================================================================

list.addEventListener('click', (e) => {
  const el = e.target.closest('.item')
  if (!el) return
  sel = +el.dataset.idx; hl()
})

list.addEventListener('dblclick', (e) => {
  const el = e.target.closest('.item')
  if (!el) return
  pick(+el.dataset.idx)
})

list.addEventListener('contextmenu', async (e) => {
  const el = e.target.closest('.item')
  if (!el) return
  e.preventDefault()
  const idx = +el.dataset.idx
  sel = idx; hl()
  const item = flat[idx]
  const menu = await window.electronAPI.getContextMenu({ idx, title: item.title, action: item.action })
  showMenu(menu, idx, e.clientX, e.clientY)
})

list.addEventListener('mouseover', (e) => {
  const el = e.target.closest('.item')
  if (!el) return
  sel = +el.dataset.idx; hl()
})

// ===================================================================
//  搜索
// ===================================================================

// 每次输入触发搜索
input.addEventListener('input', async () => {
  if (loading) return
  const q = input.value.trim()
  const id = ++queryId
  if (!q) {
    const plugins = await window.electronAPI.getTopApps()
    if (id !== queryId) return
    if (plugins && plugins.length) {
      render(plugins, '')
    } else {
      list.innerHTML = emptyHTML()
      flat = []; sel = -1
      updateHeight()
    }
    return
  }
  const plugins = await window.electronAPI.search(q)
  if (id !== queryId) return
  render(plugins, q)
})

// ── 渲染搜索结果 ──
function render(plugins, q) {
  list.innerHTML = ''
  flat = []

  for (const p of plugins) {
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

    for (const item of p.items) {
      const el = document.createElement('div')
      el.className = 'item'
      el.dataset.idx = flat.length
      el.title = item.title

      el.innerHTML =
        renderIcon(item.icon || p.pluginIcon) +
        `<div class="body">` +
          `<span class="tl">${highlight(item.title, q)}</span>` +
          `${item.desc ? `<span class="desc">${esc(item.desc)}</span>` : ''}` +
        `</div>`

      group.appendChild(el)
      flat.push(item)
    }
    list.appendChild(group)
  }

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

function scrollInto() {
  const el = list.querySelector(`.item[data-idx="${sel}"]`)
  if (el) el.scrollIntoView({ block: 'nearest' })
}

// ===================================================================
//  文本工具
// ===================================================================

function highlight(text, query) {
  if (!query) return esc(text)
  const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(${q})`, 'gi')
  return esc(text).replace(re, '<em>$1</em>')
}

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
  moreDropdown.className = 'more-dropdown popup-box'

  const items = [
    { label: '⚙ 设置', action: () => window.electronAPI.openSettings() },
    { sep: true },
    { label: '✕ 退出', action: () => window.electronAPI.quit() },
  ]

  for (const it of items) {
    if (it.sep) {
      const hr = document.createElement('div')
      hr.className = 'popup-sep'
      moreDropdown.appendChild(hr)
      continue
    }
    const el = document.createElement('div')
    el.className = 'popup-row'
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

  const wrap = document.createElement('div')
  wrap.className = 'menu-overlay'
  wrap.addEventListener('click', dismissMenu)
  wrap.addEventListener('contextmenu', (e) => e.preventDefault())

  const box = document.createElement('div')
  box.className = 'menu-box popup-box'
  box.addEventListener('click', (e) => e.stopPropagation())

  for (const it of items) {
    if (it.separator) {
      const hr = document.createElement('div')
      hr.className = 'popup-sep'
      box.appendChild(hr)
      continue
    }
    const el = document.createElement('div')
    el.className = 'popup-row'
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

  let bbox = box.getBoundingClientRect()
  const vw = document.documentElement.clientWidth
  const vh = document.documentElement.clientHeight
  let left = cx, top = cy
  if (bbox.height > vh - 8) box.style.maxHeight = (vh - 8) + 'px'
  bbox = box.getBoundingClientRect()
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

window.electronAPI.onExec((idx) => pick(idx))
window.electronAPI.onOpenSettings(() => window.electronAPI.openSettings())

window.electronAPI.onShow(async () => {
  dismissMoreMenu()
  loading = true
  list.innerHTML = emptyHTML()
  input.value = ''
  flat = []; sel = -1
  loading = false
  input.focus()
  updateHeight()

  const id = ++queryId
  const plugins = await window.electronAPI.getTopApps()
  if (id !== queryId) return
  if (plugins && plugins.length) render(plugins, '')
})
