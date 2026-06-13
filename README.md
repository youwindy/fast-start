# Fast Start 🚀

基于 Electron 的 uTools 风格快速启动器，支持插件系统、拼音搜索、频率排序、系统托盘。

使用OpenCode开发，欢迎PR。

## 特性

- **Alt+Space** 全局快捷键，呼出/隐藏启动窗口
- **插件系统** — `plugins/` 目录下放 `.js` 文件即自动注册，无需配置
- **拼音搜索** — 支持中文程序名的拼音首字母/全拼搜索（基于 `pinyin-pro`）
- **频率排序** — 根据启动次数自动排序，常用应用靠前
- **应用扫描** — 自动扫描「开始菜单」已安装应用，支持手动导入 `.exe`/`.lnk`
- **计算器** — 输入数学表达式即时计算
- **网页搜索** — 快捷 Google / Bing 搜索
- **自定义设置** — 开机自启、窗口置顶、手动管理应用、清除频率数据
- **系统托盘** — 左键切换窗口，右键菜单（显示/隐藏/设置/退出）
- **多显示器** — 在鼠标所在屏幕居中弹出
- **轻量打包** — NSIS 安装包约 78 MB，自动精简无用 Chromium 文件


## 快速开始

```bash
# 安装依赖
npm install

# 启动开发模式（隐藏窗口，按 Alt+Space 显示）
npm run dev
```

## 打包

```bash
# NSIS 安装包 → release/Fast Start Setup 1.0.0.exe
npm run dist

# 免安装绿色版 → release/win-unpacked/
npm run dist-dir
```

## 插件开发

在 `plugins/` 目录下创建 `.js` 文件，导出以下接口即可：

```js
module.exports = {
  name: '插件名称',         // string (必填)
  icon: '🔌',                 // string (必填, emoji 或文字)
  version: '1.0.0',          // string (选填)
  description: '…',          // string (选填)
  author: '…',               // string (选填)
  search(query) { … }         // (query: string) ⇒ Item[] | Promise<Item[]>
}
```

### Item 结构

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string | 标题 |
| `desc` | string | 描述（选填） |
| `icon` | string | 图标 emoji 或文字 |
| `action.type` | `'copy'` / `'open'` | 动作类型 |
| `action.text` | string | `copy` 时复制的内容 |
| `action.url` | string | `open` 时打开的 URL |

> 插件运行在主进程（无沙箱），添加外部插件前请审查代码。

## 技术栈

- **Electron 42** — 主进程 + 渲染进程
- **Vanilla JS** — 无打包工具，纯原生开发
- **pinyin-pro** — 中文拼音搜索
- **electron-builder** — 打包分发

## 安全

- `contextIsolation: true`, `nodeIntegration: false`
- 所有 IPC 通过 `contextBridge` 暴露
- CSP: `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'`

## 项目结构

```
fast-start/
├── src/
│   ├── main/          # 主进程
│   │   ├── index.js         # 入口，窗口管理
│   │   ├── plugin-loader.js # 插件加载器
│   │   ├── ipc.js           # IPC 通信处理
│   │   ├── tray.js          # 系统托盘
│   │   └── settings.js      # 设置窗口
│   ├── preload/
│   │   └── index.js         # preload 脚本
│   └── renderer/
│       ├── index.html       # 启动器页面
│       ├── app.js           # 启动器逻辑
│       ├── style.css        # 启动器样式
│       ├── settings.html    # 设置页面
│       ├── settings-app.js  # 设置逻辑
│       └── settings.css     # 设置样式
├── plugins/
│   ├── apps.js              # 应用搜索 + 频率排序
│   ├── calculator.js        # 计算器
│   └── websearch.js         # 网页搜索
├── resources/               # 图标资源
├── scripts/
│   └── afterPack.js         # 打包后体积优化
├── build/                   # electron-builder 构建缓存
└── package.json
```

## 许可

MIT
