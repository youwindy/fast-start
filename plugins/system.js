const pinyin = require('pinyin-pro')

const ENTRIES = [
  // === 系统工具 ===
  {
    name: '回收站', eng: 'Recycle Bin',
    icon: '🗑️', desc: '查看和管理已删除的文件',
    action: { type: 'run', command: 'explorer.exe', args: ['shell:RecycleBinFolder'] },
  },
  {
    name: '命令提示符', eng: 'Command Prompt',
    icon: '💻', desc: 'Windows 命令行解释器',
    action: { type: 'run', command: 'cmd.exe' },
  },
  {
    name: 'Windows PowerShell', eng: 'Windows PowerShell',
    icon: '🔵', desc: '现代化命令行脚本环境',
    action: { type: 'run', command: 'powershell.exe' },
  },
  {
    name: '任务管理器', eng: 'Task Manager',
    icon: '📊', desc: '查看和管理正在运行的程序和进程',
    action: { type: 'run', command: 'taskmgr.exe' },
  },
  {
    name: '注册表编辑器', eng: 'Registry Editor',
    icon: '📋', desc: '查看和修改 Windows 注册表',
    action: { type: 'run', command: 'regedit.exe' },
  },
  {
    name: '计算器', eng: 'Calculator',
    icon: '🧮', desc: '标准计算器应用',
    action: { type: 'run', command: 'calc.exe' },
  },
  {
    name: '记事本', eng: 'Notepad',
    icon: '📝', desc: '文本编辑器',
    action: { type: 'run', command: 'notepad.exe' },
  },
  {
    name: '画图', eng: 'Paint',
    icon: '🎨', desc: '图像绘制和编辑工具',
    action: { type: 'run', command: 'mspaint.exe' },
  },
  {
    name: '截图工具', eng: 'Snipping Tool',
    icon: '✂️', desc: '屏幕截图工具',
    action: { type: 'run', command: 'snippingtool.exe' },
  },
  {
    name: '文件资源管理器', eng: 'File Explorer',
    icon: '📁', desc: '浏览和管理文件和文件夹',
    action: { type: 'run', command: 'explorer.exe' },
  },
  // === 设置页 ===
  {
    name: '设置', eng: 'Settings',
    icon: '⚙️', desc: 'Windows 系统设置',
    action: { type: 'open', url: 'ms-settings:' },
  },
  {
    name: '显示设置', eng: 'Display Settings',
    icon: '🖥️', desc: '屏幕分辨率、缩放和显示方向',
    action: { type: 'open', url: 'ms-settings:display' },
  },
  {
    name: '声音设置', eng: 'Sound Settings',
    icon: '🔊', desc: '输入、输出设备和音量设置',
    action: { type: 'open', url: 'ms-settings:sound' },
  },
  {
    name: '应用和功能', eng: 'Apps & Features',
    icon: '📦', desc: '管理已安装的应用程序',
    action: { type: 'open', url: 'ms-settings:appsfeatures' },
  },
  {
    name: '网络和 Internet', eng: 'Network & Internet',
    icon: '🌐', desc: 'Wi-Fi、以太网和 VPN 设置',
    action: { type: 'open', url: 'ms-settings:network' },
  },
  {
    name: '蓝牙和其他设备', eng: 'Bluetooth & Devices',
    icon: '📶', desc: '蓝牙、打印机和鼠标等设备',
    action: { type: 'open', url: 'ms-settings:bluetooth' },
  },
  {
    name: '个性化', eng: 'Personalization',
    icon: '🎨', desc: '主题、背景、锁屏和颜色设置',
    action: { type: 'open', url: 'ms-settings:personalization' },
  },
  {
    name: 'Windows 更新', eng: 'Windows Update',
    icon: '🔄', desc: '检查并安装系统更新',
    action: { type: 'open', url: 'ms-settings:windowsupdate' },
  },
  {
    name: '关于', eng: 'About',
    icon: 'ℹ️', desc: '设备规格和 Windows 版本信息',
    action: { type: 'open', url: 'ms-settings:about' },
  },
  // === 管理工具 ===
  {
    name: '控制面板', eng: 'Control Panel',
    icon: '⚙️', desc: '传统 Windows 系统设置',
    action: { type: 'run', command: 'control.exe' },
  },
  {
    name: '设备管理器', eng: 'Device Manager',
    icon: '🖥️', desc: '查看和更新硬件驱动程序',
    action: { type: 'run', command: 'devmgmt.msc' },
  },
  {
    name: '磁盘管理', eng: 'Disk Management',
    icon: '💾', desc: '管理磁盘分区和卷',
    action: { type: 'run', command: 'diskmgmt.msc' },
  },
  {
    name: '服务', eng: 'Services',
    icon: '⚡', desc: '管理 Windows 系统服务',
    action: { type: 'run', command: 'services.msc' },
  },
  {
    name: '事件查看器', eng: 'Event Viewer',
    icon: '📜', desc: '查看系统日志和事件记录',
    action: { type: 'run', command: 'eventvwr.msc' },
  },
  {
    name: '性能监视器', eng: 'Performance Monitor',
    icon: '📈', desc: '监控系统性能',
    action: { type: 'run', command: 'perfmon.msc' },
  },
  {
    name: '本地组策略编辑器', eng: 'Local Group Policy Editor',
    icon: '🔧', desc: '管理组策略配置',
    action: { type: 'run', command: 'gpedit.msc' },
  },
  {
    name: '本地安全策略', eng: 'Local Security Policy',
    icon: '🔒', desc: '安全设置和策略管理',
    action: { type: 'run', command: 'secpol.msc' },
  },
  {
    name: '计算机管理', eng: 'Computer Management',
    icon: '🖥️', desc: '整合的系统管理工具集',
    action: { type: 'run', command: 'compmgmt.msc' },
  },
  {
    name: '系统配置', eng: 'System Configuration',
    icon: '⚡', desc: '配置启动项和系统服务',
    action: { type: 'run', command: 'msconfig.exe' },
  },
  {
    name: '系统信息', eng: 'System Information',
    icon: 'ℹ️', desc: '查看详细的系统硬件和软件信息',
    action: { type: 'run', command: 'msinfo32.exe' },
  },
  {
    name: '网络连接', eng: 'Network Connections',
    icon: '🌐', desc: '查看和管理网络适配器',
    action: { type: 'run', command: 'ncpa.cpl' },
  },
  {
    name: '程序和功能', eng: 'Programs & Features',
    icon: '📦', desc: '卸载或更改已安装的程序',
    action: { type: 'run', command: 'appwiz.cpl' },
  },
  {
    name: '鼠标属性', eng: 'Mouse Properties',
    icon: '🖱️', desc: '鼠标按钮、指针和滚轮设置',
    action: { type: 'run', command: 'main.cpl' },
  },
  {
    name: '日期和时间', eng: 'Date & Time',
    icon: '📅', desc: '日期、时间和时区设置',
    action: { type: 'run', command: 'timedate.cpl' },
  },
  {
    name: '电源选项', eng: 'Power Options',
    icon: '🔋', desc: '电源计划和管理设置',
    action: { type: 'run', command: 'powercfg.cpl' },
  },
  // === 更多设置页 ===
  {
    name: '任务栏', eng: 'Taskbar',
    icon: '📌', desc: '任务栏行为和图标设置',
    action: { type: 'open', url: 'ms-settings:taskbar' },
  },
  {
    name: '通知和操作', eng: 'Notifications & Actions',
    icon: '🔔', desc: '应用通知和快速操作设置',
    action: { type: 'open', url: 'ms-settings:notifications' },
  },
  {
    name: '存储', eng: 'Storage',
    icon: '💽', desc: '存储空间、存储感知和清理建议',
    action: { type: 'open', url: 'ms-settings:storagesense' },
  },
  {
    name: '多任务处理', eng: 'Multitasking',
    icon: '🪟', desc: '窗口排列、虚拟桌面和 Alt+Tab 设置',
    action: { type: 'open', url: 'ms-settings:multitasking' },
  },
  {
    name: '备份', eng: 'Backup',
    icon: '💾', desc: '文件备份和恢复选项',
    action: { type: 'open', url: 'ms-settings:backup' },
  },
  {
    name: '疑难解答', eng: 'Troubleshoot',
    icon: '🔧', desc: '运行系统疑难解答工具',
    action: { type: 'open', url: 'ms-settings:troubleshoot' },
  },
  {
    name: '恢复', eng: 'Recovery',
    icon: '🔄', desc: '重置此电脑、高级启动选项',
    action: { type: 'open', url: 'ms-settings:recovery' },
  },
  {
    name: '激活', eng: 'Activation',
    icon: '🔑', desc: 'Windows 激活状态和产品密钥管理',
    action: { type: 'open', url: 'ms-settings:activation' },
  },
  {
    name: '默认应用', eng: 'Default Apps',
    icon: '📄', desc: '设置文件类型和协议的默认程序',
    action: { type: 'open', url: 'ms-settings:defaultapps' },
  },
  {
    name: '区域和语言', eng: 'Region & Language',
    icon: '🌍', desc: '国家/地区、语言和输入法设置',
    action: { type: 'open', url: 'ms-settings:regionlanguage' },
  },
  {
    name: '输入', eng: 'Typing',
    icon: '⌨️', desc: '输入建议、拼写检查和触摸键盘设置',
    action: { type: 'open', url: 'ms-settings:typing' },
  },
  {
    name: '打印机和扫描仪', eng: 'Printers & Scanners',
    icon: '🖨️', desc: '添加和管理打印机及扫描仪',
    action: { type: 'open', url: 'ms-settings:printers' },
  },
  {
    name: 'USB', eng: 'USB',
    icon: '🔌', desc: 'USB 连接通知和电池设置',
    action: { type: 'open', url: 'ms-settings:usb' },
  },
  {
    name: '电池', eng: 'Battery',
    icon: '🔋', desc: '电池使用情况和节能模式设置',
    action: { type: 'open', url: 'ms-settings:batterysaver' },
  },
  {
    name: '登录选项', eng: 'Sign-in Options',
    icon: '🔐', desc: '密码、PIN、指纹和人脸识别设置',
    action: { type: 'open', url: 'ms-settings:signinoptions' },
  },
  {
    name: '账户', eng: 'Accounts',
    icon: '👤', desc: '用户账户、电子邮件和同步设置',
    action: { type: 'open', url: 'ms-settings:accounts' },
  },
  {
    name: '游戏', eng: 'Gaming',
    icon: '🎮', desc: '游戏模式、游戏栏和截图设置',
    action: { type: 'open', url: 'ms-settings:gaming' },
  },
  {
    name: 'Windows 安全中心', eng: 'Windows Security',
    icon: '🛡️', desc: '病毒防护、防火墙和设备安全性',
    action: { type: 'open', url: 'ms-settings:windowsdefender' },
  },
  {
    name: 'Wi-Fi', eng: 'Wi-Fi',
    icon: '📶', desc: '无线网络连接和管理',
    action: { type: 'open', url: 'ms-settings:network-wifi' },
  },
  {
    name: '代理', eng: 'Proxy',
    icon: '🔗', desc: '手动代理设置和自动检测',
    action: { type: 'open', url: 'ms-settings:network-proxy' },
  },
  {
    name: 'VPN', eng: 'VPN',
    icon: '🔒', desc: '虚拟专用网络连接管理',
    action: { type: 'open', url: 'ms-settings:network-vpn' },
  },
  {
    name: '飞行模式', eng: 'Airplane Mode',
    icon: '✈️', desc: '开启或关闭飞行模式',
    action: { type: 'open', url: 'ms-settings:network-airplanemode' },
  },
  {
    name: '移动热点', eng: 'Mobile Hotspot',
    icon: '📡', desc: '与其他设备共享网络连接',
    action: { type: 'open', url: 'ms-settings:network-mobilehotspot' },
  },
  {
    name: '夜灯', eng: 'Night Light',
    icon: '🌙', desc: '屏幕夜间蓝光过滤设置',
    action: { type: 'open', url: 'ms-settings:nightlight' },
  },
  {
    name: '开发人员设置', eng: 'Developer Settings',
    icon: '🛠️', desc: '开发人员模式、Device Portal 和 SSH',
    action: { type: 'open', url: 'ms-settings:developers' },
  },
  {
    name: '隐私和安全性', eng: 'Privacy & Security',
    icon: '🔒', desc: '应用权限、位置、摄像头和麦克风设置',
    action: { type: 'open', url: 'ms-settings:privacy' },
  },
  // === 更多系统工具 ===
  {
    name: '环境变量', eng: 'Environment Variables',
    icon: '🔧', desc: '编辑系统环境变量（系统属性的高级选项卡）',
    action: { type: 'run', command: 'rundll32.exe', args: ['sysdm.cpl,EditEnvironmentVariables'] },
  },
  {
    name: '任务计划程序', eng: 'Task Scheduler',
    icon: '⏰', desc: '创建和管理计划任务',
    action: { type: 'run', command: 'taskschd.msc' },
  },
  {
    name: '资源监视器', eng: 'Resource Monitor',
    icon: '📊', desc: '实时监控 CPU、内存、磁盘和网络',
    action: { type: 'run', command: 'resmon.exe' },
  },
  {
    name: 'Disk Cleanup', eng: 'Disk Cleanup',
    icon: '🧹', desc: '清理磁盘上的临时文件和系统文件',
    action: { type: 'run', command: 'cleanmgr.exe' },
  },
  {
    name: '磁盘碎片整理', eng: 'Defragment & Optimize Drives',
    icon: '⚡', desc: '分析、优化和整理磁盘驱动器',
    action: { type: 'run', command: 'dfrgui.exe' },
  },
  {
    name: '系统还原', eng: 'System Restore',
    icon: '⏪', desc: '将系统还原到之前的还原点',
    action: { type: 'run', command: 'rstrui.exe' },
  },
  {
    name: 'Windows 内存诊断', eng: 'Windows Memory Diagnostic',
    icon: '🧠', desc: '检查计算机内存问题',
    action: { type: 'run', command: 'mdsched.exe' },
  },
  {
    name: '高级安全 Windows 防火墙', eng: 'Windows Firewall with Advanced Security',
    icon: '🛡️', desc: '入站和出站规则高级配置',
    action: { type: 'run', command: 'wf.msc' },
  },
  {
    name: '证书管理', eng: 'Certificates',
    icon: '📜', desc: '管理用户和计算机证书',
    action: { type: 'run', command: 'certmgr.msc' },
  },
  {
    name: '本地用户和组', eng: 'Local Users and Groups',
    icon: '👥', desc: '管理本地用户账户和组',
    action: { type: 'run', command: 'lusrmgr.msc' },
  },
  {
    name: '组件服务', eng: 'Component Services',
    icon: '⚙️', desc: '配置 COM+ 应用程序和系统服务',
    action: { type: 'run', command: 'dcomcnfg.exe' },
  },
  {
    name: 'DirectX 诊断工具', eng: 'DirectX Diagnostic Tool',
    icon: '🎮', desc: '查看 DirectX 版本和显示/声音信息',
    action: { type: 'run', command: 'dxdiag.exe' },
  },
  {
    name: '默认程序', eng: 'Default Programs',
    icon: '📄', desc: '设置默认程序和文件关联',
    action: { type: 'run', command: 'computerdefaults.exe' },
  },
  {
    name: '屏幕键盘', eng: 'On-Screen Keyboard',
    icon: '⌨️', desc: '使用屏幕上的虚拟键盘输入',
    action: { type: 'run', command: 'osk.exe' },
  },
  {
    name: '放大镜', eng: 'Magnifier',
    icon: '🔍', desc: '放大屏幕部分区域以便查看',
    action: { type: 'run', command: 'magnify.exe' },
  },
  {
    name: '讲述人', eng: 'Narrator',
    icon: '🔊', desc: '屏幕阅读器，朗读屏幕内容',
    action: { type: 'run', command: 'narrator.exe' },
  },
  {
    name: '步骤记录器', eng: 'Steps Recorder',
    icon: '📹', desc: '记录操作步骤并附带屏幕截图',
    action: { type: 'run', command: 'psr.exe' },
  },
  {
    name: '颜色管理', eng: 'Color Management',
    icon: '🎨', desc: '显示器、扫描仪和打印机的颜色配置文件',
    action: { type: 'run', command: 'colorcpl.exe' },
  },
  {
    name: '轻松使用设置中心', eng: 'Ease of Access Center',
    icon: '♿', desc: '让电脑更易使用的设置',
    action: { type: 'run', command: 'utilman.exe' },
  },
  {
    name: '手机连接', eng: 'Phone Link',
    icon: '📱', desc: '将手机连接到电脑以查看通知和照片',
    action: { type: 'open', url: 'ms-phone:' },
  },
]

let searchIndex = []

function buildSearchIndex() {
  searchIndex = ENTRIES.map(e => {
    const hasChinese = /[\u4e00-\u9fff]/.test(e.name)
    const py = hasChinese
      ? {
          full: pinyin.pinyin(e.name, { toneType: 'none' }).replace(/\s/g, ''),
          first: pinyin.pinyin(e.name, { pattern: 'first', toneType: 'none', separator: '' }),
        }
      : null
    return {
      entry: e,
      pinyin: py,
      searchNames: [e.name.toLowerCase(), e.eng.toLowerCase()],
    }
  })
}

function matchEntry(indexEntry, token) {
  for (const n of indexEntry.searchNames) {
    if (n.startsWith(token)) return 100
    if (n.includes(token)) return 80
  }
  if (indexEntry.pinyin) {
    if (indexEntry.pinyin.full.includes(token)) return 60
    if (indexEntry.pinyin.first.includes(token)) return 50
  }
  return 0
}

module.exports = {
  name: '系统功能',
  icon: '🖥️',
  version: '1.1.0',
  description: '搜索 Windows 系统功能、设置页和管理工具',
  author: 'Fast Start',

  init() {
    buildSearchIndex()
  },

  search(query) {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const tokens = q.split(/\s+/).filter(Boolean)
    const scored = []

    for (const idx of searchIndex) {
      let total = 0, ok = true
      for (const t of tokens) {
        const s = matchEntry(idx, t)
        if (!s) { ok = false; break }
        total += s
      }
      if (ok) {
        scored.push({ entry: idx.entry, score: total })
      }
    }

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, 10).map(s => ({
      title: s.entry.name,
      desc: s.entry.desc,
      icon: s.entry.icon,
      action: s.entry.action,
    }))
  },
}
