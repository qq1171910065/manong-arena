/**
 * Generate bundled minimal character + game-mode placeholder PNGs into bundled-assets/
 * Run: node scripts/generate-bundled-placeholder-assets.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeSolidPng } from './lib/write-solid-png.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const bundledRoot = join(root, 'bundled-assets')

const EXPRESSIONS = ['neutral', 'thinking', 'confident', 'happy', 'sad', 'angry']

function hexToRgb(hex) {
  const normalized = hex.replace('#', '')
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  }
}

function writeCharacterPack(id, accentHex) {
  const rgb = hexToRgb(accentHex)
  const base = join(bundledRoot, 'character-packs', id)
  writeSolidPng(join(base, 'portrait.png'), 360, 640, rgb.r, rgb.g, rgb.b)
  writeSolidPng(join(base, 'banner.png'), 640, 360, rgb.r, rgb.g, rgb.b)
  for (const expression of EXPRESSIONS) {
    writeSolidPng(join(base, 'avatars', `${expression}.png`), 128, 128, rgb.r, rgb.g, rgb.b)
  }
}

function writeGameModePack(id, accentHex) {
  const rgb = hexToRgb(accentHex)
  const base = join(bundledRoot, 'game-mode-packs', id)
  writeSolidPng(join(base, 'mode-cover.png'), 480, 320, rgb.r, rgb.g, rgb.b)
  writeSolidPng(join(base, 'match-banner.png'), 960, 240, rgb.r, rgb.g, rgb.b)
}

writeCharacterPack('default', '#58c7df')

const gameModes = [
  { id: 'werewolf', color: '#7c3aed' },
  { id: 'roundtable', color: '#0ea5e9' },
  { id: 'avalon', color: '#2563eb' },
  { id: 'undercover', color: '#f97316' },
  { id: 'custom', color: '#64748b' },
]
for (const mode of gameModes) {
  writeGameModePack(mode.id, mode.color)
}

const characterManifest = {
  version: 'bundled-minimal-1',
  packageId: 'character-packs',
  generatedAt: new Date().toISOString(),
  usage: 'Manong Arena 内置默认角色素材包（纯色占位，随客户端分发）',
  characters: [
    {
      id: 'default',
      name: '默认',
      modelId: 'default',
      accent: '#58c7df',
      palette: 'teal / sky blue / white',
      portrait: 'default/portrait.png',
      banner: 'default/banner.png',
      avatars: Object.fromEntries(EXPRESSIONS.map((id) => [id, `default/avatars/${id}.png`])),
    },
  ],
}

const gameModeManifest = {
  version: 'bundled-minimal-1',
  packageId: 'game-mode-packs',
  generatedAt: new Date().toISOString(),
  usage: 'Manong Arena 内置玩法封面占位图（纯色，随客户端分发）',
  modes: gameModes.map((mode) => ({
    id: mode.id,
    accent: mode.color,
    modeCover: `${mode.id}/mode-cover.png`,
    matchBanner: `${mode.id}/match-banner.png`,
  })),
}

mkdirSync(join(bundledRoot, 'character-packs'), { recursive: true })
mkdirSync(join(bundledRoot, 'game-mode-packs'), { recursive: true })
writeFileSync(
  join(bundledRoot, 'character-packs/manifest.json'),
  `${JSON.stringify(characterManifest, null, 2)}\n`,
  'utf8'
)
writeFileSync(
  join(bundledRoot, 'game-mode-packs/manifest.json'),
  `${JSON.stringify(gameModeManifest, null, 2)}\n`,
  'utf8'
)

const rendererManifestPath = join(root, 'src/renderer/src/data/pack-manifests/bundled-character-packs.json')
writeFileSync(rendererManifestPath, `${JSON.stringify(characterManifest, null, 2)}\n`, 'utf8')

console.log('[generate-bundled-placeholder-assets] wrote bundled-assets/')
