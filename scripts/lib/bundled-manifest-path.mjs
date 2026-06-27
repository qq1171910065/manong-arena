import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** pack:assets 写入、安装包内置的素材清单路径 */
export const BUNDLED_MANIFEST_RELATIVE = 'src/shared/arena/bundled-asset-pack-manifest.json'

export function resolveBundledManifestPath(projectRoot) {
  return join(projectRoot, BUNDLED_MANIFEST_RELATIVE)
}

export function resolveProjectRoot(fromDir = join(__dirname, '..', '..')) {
  return fromDir
}

export const BUNDLED_MANIFEST_PATH = resolveBundledManifestPath(resolveProjectRoot())
