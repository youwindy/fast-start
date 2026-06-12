/**
 * 打包后处理脚本 — 移除多余文件以减小体积
 * 在 electron-builder 完成打包后执行
 */
exports.default = async function(context) {
  const path = require('path')
  const fs = require('fs')

  const appDir = context.appOutDir
  if (!fs.existsSync(appDir)) return

  let totalRemoved = 0

  function rm(name) {
    const full = path.join(appDir, name)
    if (fs.existsSync(full)) {
      const size = fs.statSync(full).size
      fs.unlinkSync(full)
      totalRemoved += size
      console.log(`  removed: ${name} (${(size / 1024 / 1024).toFixed(2)} MB)`)
    }
  }

  // 1. 只保留中英文语言包（约 54 个文件，~30 MB）
  const localesDir = path.join(appDir, 'locales')
  if (fs.existsSync(localesDir)) {
    const keep = new Set(['en-US.pak', 'zh-CN.pak'])
    for (const f of fs.readdirSync(localesDir)) {
      if (!keep.has(f)) rm(`locales/${f}`)
    }
  }

  // 2. 移除 SwiftShader / Vulkan（约 6 MB）
  rm('vk_swiftshader.dll')
  rm('vk_swiftshader_icd.json')
  rm('vulkan-1.dll')

  // 3. 移除 DirectX / DXIL（约 26 MB）
  rm('dxcompiler.dll')
  rm('dxil.dll')
  rm('d3dcompiler_47.dll')

  // 4. 移除 Chromium 许可证（约 19 MB）
  rm('LICENSES.chromium.html')
  rm('LICENSE.electron.txt')

  // 5. 移除 ffmpeg（约 3 MB）
  rm('ffmpeg.dll')

  console.log(`  total removed: ${(totalRemoved / 1024 / 1024).toFixed(2)} MB`)
}
