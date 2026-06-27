import { packAssetUrl } from '@renderer/data/arena-home-assets'

export type CharacterAssetEmotion = 'neutral' | 'thinking' | 'confident'

export interface CharacterAssetPackItem {
  id: string
  name: string
  vendor: string
  modelKeywords: string[]
  style: 'chibi'
  palette: string
  motif: string
  portrait: string
  banner: string
  avatars: Record<CharacterAssetEmotion, string>
}

function chibiAsset(characterId: string, fileName: string): string {
  return packAssetUrl(`${characterId}/${fileName}`)
}

function chibiAvatar(characterId: string, emotion: CharacterAssetEmotion): string {
  return packAssetUrl(`${characterId}/avatars/${emotion}.png`)
}

export const modelVendorsChibiPack: CharacterAssetPackItem[] = [
  {
    id: 'glm-chibi',
    name: '智谱策士',
    vendor: '智谱 GLM',
    modelKeywords: ['glm', 'zhipu', '智谱'],
    style: 'chibi',
    palette: '蓝紫 / 青色 / 银白',
    motif: '六边形、线路、逻辑方块',
    portrait: chibiAsset('glm', 'portrait.png'),
    banner: chibiAsset('glm', 'banner.png'),
    avatars: {
      neutral: chibiAvatar('glm', 'neutral'),
      thinking: chibiAvatar('glm', 'thinking'),
      confident: chibiAvatar('glm', 'confident'),
    },
  },
  {
    id: 'minimax-chibi',
    name: '跃音小剧场',
    vendor: 'MiniMax',
    modelKeywords: ['minimax', 'abab'],
    style: 'chibi',
    palette: '珊瑚粉 / 暖橙 / 奶油白',
    motif: '圆角波形、语音水晶',
    portrait: chibiAsset('minimax', 'portrait.png'),
    banner: chibiAsset('minimax', 'banner.png'),
    avatars: {
      neutral: chibiAvatar('minimax', 'neutral'),
      thinking: chibiAvatar('minimax', 'thinking'),
      confident: chibiAvatar('minimax', 'confident'),
    },
  },
  {
    id: 'ernie-chibi',
    name: '文心书侦',
    vendor: '文心 ERNIE',
    modelKeywords: ['ernie', 'wenxin', '文心'],
    style: 'chibi',
    palette: '深蓝 / 瓷白 / 朱红',
    motif: '墨带、书页、知识粒子',
    portrait: chibiAsset('ernie', 'portrait.png'),
    banner: chibiAsset('ernie', 'banner.png'),
    avatars: {
      neutral: chibiAvatar('ernie', 'neutral'),
      thinking: chibiAvatar('ernie', 'thinking'),
      confident: chibiAvatar('ernie', 'confident'),
    },
  },
  {
    id: 'spark-chibi',
    name: '星火战术家',
    vendor: '讯飞星火',
    modelKeywords: ['spark', 'iflytek', '讯飞', '星火'],
    style: 'chibi',
    palette: '电光蓝 / 深海军蓝 / 亮红',
    motif: '星芒、声波、指南星盘',
    portrait: chibiAsset('spark', 'portrait.png'),
    banner: chibiAsset('spark', 'banner.png'),
    avatars: {
      neutral: chibiAvatar('spark', 'neutral'),
      thinking: chibiAvatar('spark', 'thinking'),
      confident: chibiAvatar('spark', 'confident'),
    },
  },
]

export const characterAssetPacks = {
  modelVendorsChibiV1: modelVendorsChibiPack,
}
