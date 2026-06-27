import { net } from 'electron'

import extractZip from 'extract-zip'

import { createHash } from 'node:crypto'

import {

  createWriteStream,

  existsSync,

  mkdirSync,

  readFileSync,

  rmSync,

  statSync,

} from 'node:fs'

import { join } from 'node:path'

import { Readable } from 'node:stream'

import { pipeline } from 'node:stream/promises'

import type { AssetPackProgressPayload, InitialAssetPackManifest } from '@shared/arena/initial-assets'

import {

  ASSET_PACK_MARKER_PATH,

  ASSET_PACK_GAME_MARKER_PATH,

  findLocalAssetZipPath,

  getAssetPackCacheDir,

  getAssetPackZipPath,

  resolveDownloadUrl,

} from './paths'



const DOWNLOAD_TIMEOUT_MS = 60 * 60 * 1000

const MAX_ZIP_BYTES = 1024 * 1024 * 1024



export { ASSET_PACK_MARKER_PATH, ASSET_PACK_GAME_MARKER_PATH }



export function sha256File(filePath: string): string {

  const hash = createHash('sha256')

  hash.update(readFileSync(filePath))

  return hash.digest('hex')

}



export function verifyAssetPackZip(zipPath: string, manifest: InitialAssetPackManifest): void {

  if (!existsSync(zipPath)) {

    throw new Error('素材包文件不存在')

  }



  const actualSize = statSync(zipPath).size

  if (manifest.sizeBytes > 0 && Math.abs(actualSize - manifest.sizeBytes) > 1024) {

    throw new Error('素材包大小与 manifest 不一致')

  }



  const digest = sha256File(zipPath)

  if (manifest.sha256 && digest !== manifest.sha256) {

    throw new Error('素材包校验失败')

  }

}



function removeStaleZip(zipPath: string, reason: string): void {

  console.warn(`[asset-pack] remove stale zip (${reason}): ${zipPath}`)

  try {

    if (existsSync(zipPath)) rmSync(zipPath, { force: true })

  } catch {

    /* ignore */

  }

}



export async function downloadAssetPackZip(

  url: string,

  destPath: string,

  manifest: InitialAssetPackManifest,

  onProgress?: (payload: AssetPackProgressPayload) => void

): Promise<void> {

  const controller = new AbortController()

  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)

  try {

    onProgress?.({

      phase: 'download',

      percent: 0,

      receivedBytes: 0,

      totalBytes: manifest.sizeBytes || null,

      label: '正在下载素材包…',

    })



    const response = await net.fetch(url, { method: 'GET', signal: controller.signal })

    if (!response.ok) {

      throw new Error(`素材下载失败（HTTP ${response.status}）`)

    }



    const lenHeader = response.headers.get('content-length')

    const total = lenHeader && Number.isFinite(Number(lenHeader)) ? Number(lenHeader) : null

    if (total != null && total > MAX_ZIP_BYTES) {

      throw new Error('素材包体积超过允许上限')

    }



    const body = response.body

    if (!body) throw new Error('下载响应为空')



    let received = 0

    const nodeStream = Readable.fromWeb(body as import('stream/web').ReadableStream)

    nodeStream.on('data', (chunk: Buffer | string) => {

      const n = typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length

      received += n

      if (received > MAX_ZIP_BYTES) {

        nodeStream.destroy(new Error('素材包体积超过允许上限'))

        return

      }

      const percent =

        total != null && total > 0 ? Math.min(95, Math.round((100 * received) / total)) : undefined

      onProgress?.({

        phase: 'download',

        percent,

        receivedBytes: received,

        totalBytes: total,

        label: '正在下载素材包…',

      })

    })



    const ws = createWriteStream(destPath)

    await pipeline(nodeStream, ws)

  } finally {

    clearTimeout(timer)

  }

}



export function assertAssetPackStructure(destDir: string): void {

  const marker = join(destDir, ASSET_PACK_MARKER_PATH)

  const gameMarker = join(destDir, ASSET_PACK_GAME_MARKER_PATH)

  if (!existsSync(marker)) {

    throw new Error('素材包结构无效，缺少 character-packs/manifest.json')

  }

  if (!existsSync(gameMarker)) {

    throw new Error('素材包结构无效，缺少 game-mode-packs/manifest.json')

  }

}



export async function extractAssetPackZip(destDir: string, zipPath: string): Promise<void> {

  mkdirSync(destDir, { recursive: true })

  await extractZip(zipPath, { dir: destDir })

  assertAssetPackStructure(destDir)

}



export type ResolveAssetPackZipResult = {

  zipPath: string

  source: 'local' | 'remote'

}



export async function resolveAssetPackZip(

  appId: string,

  manifest: InitialAssetPackManifest,

  onProgress?: (payload: AssetPackProgressPayload) => void

): Promise<ResolveAssetPackZipResult> {

  const localZip = findLocalAssetZipPath(appId, manifest)

  if (localZip) {

    try {

      verifyAssetPackZip(localZip, manifest)

      return { zipPath: localZip, source: 'local' }

    } catch (error) {

      const reason = error instanceof Error ? error.message : 'verify failed'

      removeStaleZip(localZip, reason)

    }

  }



  const downloadUrl = resolveDownloadUrl(manifest)

  if (!downloadUrl.startsWith('http://') && !downloadUrl.startsWith('https://')) {

    throw new Error(

      `未找到已下载的素材包 ${manifest.fileName}，请配置 manifest 下载地址或设置 ARENA_ASSETS_DOWNLOAD_URL`

    )

  }



  const cacheDir = getAssetPackCacheDir(appId)

  mkdirSync(cacheDir, { recursive: true })

  const zipPath = getAssetPackZipPath(appId, manifest)



  try {

    await downloadAssetPackZip(downloadUrl, zipPath, manifest, onProgress)

    return { zipPath, source: 'remote' }

  } catch (error) {

    removeStaleZip(zipPath, 'download failed')

    throw error

  }

}



export async function installAssetPackFromManifest(

  appId: string,

  destDir: string,

  manifest: InitialAssetPackManifest,

  onProgress?: (payload: AssetPackProgressPayload) => void

): Promise<{ source: 'local' | 'remote' }> {

  onProgress?.({

    phase: 'verify',

    percent: 90,

    label: '正在校验素材包…',

  })



  const { zipPath, source } = await resolveAssetPackZip(appId, manifest, onProgress)

  verifyAssetPackZip(zipPath, manifest)



  onProgress?.({

    phase: 'extract',

    percent: 98,

    label: '正在解压素材…',

  })

  await extractAssetPackZip(destDir, zipPath)



  onProgress?.({

    phase: 'extract',

    percent: 100,

    label: '素材准备完成',

  })



  return { source }

}


