/**
 * Generate Electron app icons from the Arena cat mascot.
 * Source: src/renderer/src/assets/home/mascot-cat-v2.png
 * Outputs: build/icon.png, build/icon.ico, build/icon.icns (macOS only)
 */
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'src/renderer/src/assets/home/mascot-cat-v2.png')
const buildDir = join(root, 'build')
const publicDir = join(root, 'src/renderer/public')
const iconBase = join(buildDir, 'icon')

if (!existsSync(source)) {
  console.error(`[icons] source not found: ${source}`)
  process.exit(1)
}

mkdirSync(buildDir, { recursive: true })
mkdirSync(publicDir, { recursive: true })

copyFileSync(source, join(buildDir, 'icon.png'))
copyFileSync(source, join(publicDir, 'favicon.png'))

function runPng2icons(args, label) {
  const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    console.error(`[icons] ${label} failed`)
    process.exit(result.status ?? 1)
  }
}

const npxBase = ['--yes', 'png2icons', source, iconBase]

// Windows 上 png2icons 写 .icns 不可靠；Win 包只需 .ico，.icns 保留仓库内文件或在 macOS 上生成。
if (process.platform === 'win32') {
  const icoPath = `${iconBase}.ico`
  if (existsSync(icoPath)) rmSync(icoPath, { force: true })
  runPng2icons([...npxBase, '-icowe', '-i'], 'icon.ico')
  if (!existsSync(`${iconBase}.icns`)) {
    console.warn('[icons] icon.icns unchanged (generate on macOS for DMG builds)')
  }
  console.log('[icons] wrote build/icon.png, build/icon.ico, src/renderer/public/favicon.png')
} else {
  for (const ext of ['ico', 'icns']) {
    const target = `${iconBase}.${ext}`
    if (existsSync(target)) rmSync(target, { force: true })
  }
  runPng2icons([...npxBase, '-allwe', '-i'], 'icon.ico + icon.icns')
  console.log('[icons] wrote build/icon.png, build/icon.ico, build/icon.icns, src/renderer/public/favicon.png')
}
