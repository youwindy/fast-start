// ── DOM 引用 ──
    const chk = document.getElementById('chk-startup')
    const chkOntop = document.getElementById('chk-ontop')
    const btn = document.getElementById('btn-import')
    const btnClear = document.getElementById('btn-clear')
    const mList = document.getElementById('manual-list')

    // ── 安全注册事件（任一失败不影响后续） ──
    function on(el, event, fn) {
      if (el) el.addEventListener(event, fn)
    }

    // ── 手动应用列表 ──
    function renderManualApps() {
      window.electronAPI.getManualApps().then(apps => {
        if (!apps.length) {
          mList.innerHTML = '<div class="manual-empty">暂无手动导入的应用</div>'
          return
        }
        mList.innerHTML = apps.map(a =>
          `<div class="manual-item">
            <div class="info">
              <div class="name">${esc(a.name)}</div>
              <div class="path" title="${esc(a.path)}">${esc(a.path)}</div>
            </div>
            <button class="del" data-path="${esc(a.path)}">✕</button>
          </div>`
        ).join('')
        mList.querySelectorAll('.del').forEach(el => {
          el.addEventListener('click', () => {
            window.electronAPI.removeManualApp(el.dataset.path).then(renderManualApps)
          })
        })
      })
    }

    // ── HTML 转义 ──
    function esc(s) {
      const d = document.createElement('div')
      d.textContent = s
      return d.innerHTML
    }

    // ── 加载设置 ──
    window.electronAPI.getSettings().then(s => {
      chk.checked = !!s.openAtLogin
      chkOntop.checked = !!s.alwaysOnTop
    })

    // ── 设置变更 ──
    on(chk, 'change', () => {
      window.electronAPI.setSettings({ openAtLogin: chk.checked }).then(s => {
        chk.checked = !!s.openAtLogin
      })
    })

    on(chkOntop, 'change', () => {
      window.electronAPI.setSettings({ alwaysOnTop: chkOntop.checked }).then(s => {
        chkOntop.checked = !!s.alwaysOnTop
      })
    })

    // ── 清除频率 ──
    on(btnClear, 'click', () => {
      if (confirm('确认清除所有应用启动次数记录？')) {
        window.electronAPI.clearFrecency()
      }
    })

    // ── 导入应用 ──
    on(btn, 'click', () => {
      window.electronAPI.addManualApp().then(result => {
        if (result) renderManualApps()
      })
    })

    // ── 保存并退出 ──
    on(document.getElementById('btn-save'), 'click', () => {
      window.electronAPI.closeSettings()
    })

    // ── 初始化 ──
    renderManualApps()
