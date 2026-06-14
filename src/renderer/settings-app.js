// ── DOM 引用 ──
    const chk = document.getElementById('chk-startup')
    const chkOntop = document.getElementById('chk-ontop')
    const btn = document.getElementById('btn-import')
    const btnClear = document.getElementById('btn-clear')
    const btnImportPlugin = document.getElementById('btn-import-plugin')
    const mList = document.getElementById('manual-list')
    const pluginList = document.getElementById('plugin-list')

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

    // ── 插件开关列表 ──
    function renderPlugins() {
      window.electronAPI.getPlugins().then(plugins => {
        pluginList.innerHTML = plugins.map(p => `
          <div class="plugin-item">
            <div class="plugin-info">
              <span class="plugin-icon">${esc(p.icon)}</span>
              <div>
                <div class="plugin-name">${esc(p.name)}</div>
                <div class="plugin-meta">v${esc(p.version)}${p.author ? ' by ' + esc(p.author) : ''}${p.description ? ' — ' + esc(p.description) : ''}</div>
              </div>
            </div>
            <label class="switch">
              <input type="checkbox" class="plugin-toggle" data-id="${esc(p.id)}" ${p.enabled ? 'checked' : ''} />
              <span class="track"></span>
            </label>
          </div>
        `).join('')
        pluginList.querySelectorAll('.plugin-toggle').forEach(el => {
          el.addEventListener('change', () => {
            window.electronAPI.togglePlugin(el.dataset.id)
          })
        })
      })
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

    // ── 提示消息 ──
    function toast(msg, isError) {
      const el = document.createElement('div')
      el.className = 'toast' + (isError ? ' toast-error' : '')
      el.textContent = msg
      document.body.appendChild(el)
      requestAnimationFrame(() => el.classList.add('open'))
      setTimeout(() => { el.classList.remove('open'); setTimeout(() => el.remove(), 300) }, 3000)
    }

    // ── 导入插件 ──
    on(btnImportPlugin, 'click', async () => {
      const result = await window.electronAPI.importPlugin()
      if (!result) return
      if (result.success) {
        toast(`插件 "${result.plugin.name}" 导入成功`)
        renderPlugins()
      } else {
        toast(result.error, true)
      }
    })

    // ── 保存并退出 ──
    on(document.getElementById('btn-save'), 'click', () => {
      window.electronAPI.closeSettings()
    })

    // ── 初始化 ──
    renderManualApps()
    renderPlugins()
