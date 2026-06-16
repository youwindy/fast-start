const fs = require('fs')
const path = require('path')
const os = require('os')
const { app } = require('electron')
const { execFile } = require('child_process')
const { promisify } = require('util')
const execFileAsync = promisify(execFile)

async function batchExtractIcons(paths) {
  if (!paths.length) return []
  const lines = paths.map(p => `'${p.replace(/'/g, "''")}'`).join(',')
  const script = `
$paths = @(${lines})
Add-Type -AssemblyName System.Drawing
$shell = New-Object -ComObject WScript.Shell
$result = @{}
foreach ($p in $paths) {
  try {
    $target = $p
    if ($p -like '*.lnk') {
      try { $sc = $shell.CreateShortcut($p); if ($sc.TargetPath) { $target = $sc.TargetPath } } catch {}
    }
    $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($target)
    if ($icon) {
      $ms = New-Object System.IO.MemoryStream
      $icon.ToBitmap().Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
      $result[$p] = 'data:image/png;base64,' + [Convert]::ToBase64String($ms.ToArray())
      $ms.Dispose(); $icon.Dispose()
    }
  } catch {}
}
if ($result.Count -gt 0) { ConvertTo-Json $result -Compress } else { Write-Output '{}' }
`
  const tmpFile = path.join(os.tmpdir(), `fs-icons-${Date.now()}.ps1`)
  try {
    fs.writeFileSync(tmpFile, script, 'utf8')
    const { stdout } = await execFileAsync('powershell', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tmpFile
    ], { encoding: 'utf8', timeout: 30000, windowsHide: true, maxBuffer: 10 * 1024 * 1024 })
    const parsed = JSON.parse(stdout.trim())
    return Object.entries(parsed).filter(([, v]) => v && v.length > 0)
  } catch (e) {
    console.error('[icon-extractor] batch failed:', e.message)
    return []
  } finally {
    try { fs.unlinkSync(tmpFile) } catch {}
  }
}

async function extractIconFallback(fp) {
  let target = fp
  if (fp.toLowerCase().endsWith('.lnk')) {
    try {
      const { stdout } = await execFileAsync('powershell', [
        '-NoProfile', '-NonInteractive', '-Command',
        `(New-Object -ComObject WScript.Shell).CreateShortcut('${fp.replace(/'/g, "''")}').TargetPath`
      ], { encoding: 'utf8', timeout: 5000, windowsHide: true })
      const resolved = stdout.trim()
      if (resolved) target = resolved
    } catch {}
  }
  const img = await app.getFileIcon(target, { size: 'large' })
  const dataUrl = img.toDataURL()
  return dataUrl || null
}

module.exports = { batchExtractIcons, extractIconFallback }
