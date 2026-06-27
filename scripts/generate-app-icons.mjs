/**
 * Generate Electron app icons from the Arena cat mascot.
 * Source: src/renderer/src/assets/home/mascot-cat-v2.png
 * Outputs: build/icon.png, build/icon.ico, build/icon.icns
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'src/renderer/src/assets/home/mascot-cat-v2.png')
const buildDir = join(root, 'build')
const publicDir = join(root, 'src/renderer/public')

if (!existsSync(source)) {
  console.error(`[icons] source not found: ${source}`)
  process.exit(1)
}

mkdirSync(buildDir, { recursive: true })
mkdirSync(publicDir, { recursive: true })

copyFileSync(source, join(buildDir, 'icon.png'))
copyFileSync(source, join(publicDir, 'favicon.png'))

const png2icons = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['--yes', 'png2icons', source, join(buildDir, 'icon'), '-allwe', '-i'],
  { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' }
)

if (png2icons.status !== 0) {
  process.exit(png2icons.status ?? 1)
}

console.log('[icons] wrote build/icon.png, build/icon.ico, build/icon.icns, src/renderer/public/favicon.png')
