import avatarClaude from '@renderer/assets/characters/avatars/avatar-claude.png'
import avatarDeepseek from '@renderer/assets/characters/avatars/avatar-deepseek.png'
import avatarDoubao from '@renderer/assets/characters/avatars/avatar-doubao.png'
import avatarGemini from '@renderer/assets/characters/avatars/avatar-gemini.png'
import avatarGpt from '@renderer/assets/characters/avatars/avatar-gpt.png'
import avatarHunyuan from '@renderer/assets/characters/avatars/avatar-hunyuan.png'
import avatarKimi from '@renderer/assets/characters/avatars/avatar-kimi.png'
import avatarLlama from '@renderer/assets/characters/avatars/avatar-llama.png'
import avatarMistral from '@renderer/assets/characters/avatars/avatar-mistral.png'
import avatarQwen from '@renderer/assets/characters/avatars/avatar-qwen.png'
import charClaude from '@renderer/assets/home/char-claude.png'
import charDeepseek from '@renderer/assets/home/char-deepseek.png'
import charDoubao from '@renderer/assets/home/char-doubao.png'
import charGemini from '@renderer/assets/home/char-gemini.png'
import charGpt from '@renderer/assets/home/char-gpt.png'
import charHunyuan from '@renderer/assets/home/char-hunyuan.png'
import charKimi from '@renderer/assets/home/char-kimi.png'
import charLlama from '@renderer/assets/home/char-llama.png'
import charMistral from '@renderer/assets/home/char-mistral.png'
import charQwen from '@renderer/assets/home/char-qwen.png'
import matchAvalon from '@renderer/assets/home/match-avalon.png'
import matchUndercover from '@renderer/assets/home/match-undercover.png'
import matchWerewolf from '@renderer/assets/home/match-werewolf.png'
import modeAvalon from '@renderer/assets/home/mode-avalon.png'
import modeCustom from '@renderer/assets/home/mode-custom.png'
import modeUndercover from '@renderer/assets/home/mode-undercover.png'
import modeWerewolf from '@renderer/assets/home/mode-werewolf.png'

const portraits = {
  doubao: charDoubao,
  gpt: charGpt,
  claude: charClaude,
  deepseek: charDeepseek,
  kimi: charKimi,
  gemini: charGemini,
  qwen: charQwen,
  mistral: charMistral,
  llama: charLlama,
  hunyuan: charHunyuan,
  glm: charQwen,
  minimax: charGemini,
  yi: charDeepseek,
  ernie: charGpt,
  grok: charMistral,
  spark: charKimi,
}

const avatars = {
  doubao: avatarDoubao,
  gpt: avatarGpt,
  claude: avatarClaude,
  deepseek: avatarDeepseek,
  kimi: avatarKimi,
  gemini: avatarGemini,
  qwen: avatarQwen,
  mistral: avatarMistral,
  llama: avatarLlama,
  hunyuan: avatarHunyuan,
  glm: avatarQwen,
  minimax: avatarGemini,
  yi: avatarDeepseek,
  ernie: avatarGpt,
  grok: avatarMistral,
  spark: avatarKimi,
}

const portraitList = [
  charDoubao,
  charGpt,
  charClaude,
  charDeepseek,
  charKimi,
  charGemini,
  charQwen,
  charMistral,
  charLlama,
  charHunyuan,
]
const avatarList = [
  avatarDoubao,
  avatarGpt,
  avatarClaude,
  avatarDeepseek,
  avatarKimi,
  avatarGemini,
  avatarQwen,
  avatarMistral,
  avatarLlama,
  avatarHunyuan,
]

function keyFromCharacter(name = '', modelId = ''): keyof typeof portraits | null {
  const normalized = `${name} ${modelId}`.toLowerCase()
  if (normalized.includes('豆包') || normalized.includes('doubao')) return 'doubao'
  if (normalized.includes('gpt')) return 'gpt'
  if (normalized.includes('claude')) return 'claude'
  if (normalized.includes('deepseek')) return 'deepseek'
  if (normalized.includes('kimi')) return 'kimi'
  if (normalized.includes('gemini')) return 'gemini'
  if (normalized.includes('qwen') || normalized.includes('通义') || normalized.includes('千问')) return 'qwen'
  if (normalized.includes('mistral')) return 'mistral'
  if (normalized.includes('llama') || normalized.includes('meta')) return 'llama'
  if (normalized.includes('hunyuan') || normalized.includes('混元')) return 'hunyuan'
  if (normalized.includes('glm') || normalized.includes('智谱')) return 'glm'
  if (normalized.includes('minimax') || normalized.includes('abab')) return 'minimax'
  if (normalized.includes(' yi') || normalized.includes('yi-large') || normalized.includes('零一')) return 'yi'
  if (normalized.includes('ernie') || normalized.includes('文心')) return 'ernie'
  if (normalized.includes('grok')) return 'grok'
  if (normalized.includes('spark') || normalized.includes('星火') || normalized.includes('讯飞')) return 'spark'
  return null
}

function isDirectImageRef(ref = ''): boolean {
  return /^(data:image\/|blob:|file:|https?:\/\/)/i.test(ref)
}

function keyFromAssetRef(ref = ''): keyof typeof portraits | null {
  const normalized = ref.toLowerCase()
  if (normalized.includes('doubao')) return 'doubao'
  if (normalized.includes('gpt')) return 'gpt'
  if (normalized.includes('claude')) return 'claude'
  if (normalized.includes('deepseek')) return 'deepseek'
  if (normalized.includes('kimi')) return 'kimi'
  if (normalized.includes('gemini')) return 'gemini'
  if (normalized.includes('qwen')) return 'qwen'
  if (normalized.includes('mistral')) return 'mistral'
  if (normalized.includes('llama')) return 'llama'
  if (normalized.includes('hunyuan')) return 'hunyuan'
  if (normalized.includes('glm')) return 'glm'
  if (normalized.includes('minimax') || normalized.includes('abab')) return 'minimax'
  if (normalized.includes('yi')) return 'yi'
  if (normalized.includes('ernie')) return 'ernie'
  if (normalized.includes('grok')) return 'grok'
  if (normalized.includes('spark')) return 'spark'
  return null
}

export function characterPortraitByName(name = '', index = 0, modelId = '', portraitUrl = ''): string {
  if (isDirectImageRef(portraitUrl)) return portraitUrl
  const key = keyFromAssetRef(portraitUrl) || keyFromCharacter(name, modelId)
  return key ? portraits[key] : portraitList[index % portraitList.length]
}

export function characterAvatarByName(name = '', index = 0, modelId = '', avatarUrl = ''): string {
  if (isDirectImageRef(avatarUrl)) return avatarUrl
  const key = keyFromAssetRef(avatarUrl) || keyFromCharacter(name, modelId)
  return key ? avatars[key] : avatarList[index % avatarList.length]
}

export const characterImageByName = characterPortraitByName

export function modeImageById(id = ''): string {
  if (id === 'werewolf') return modeWerewolf
  if (id === 'avalon') return modeAvalon
  if (id === 'undercover') return modeUndercover
  return modeCustom
}

export function matchImageByModeId(id = ''): string {
  if (id === 'werewolf') return matchWerewolf
  if (id === 'avalon') return matchAvalon
  if (id === 'undercover') return matchUndercover
  return modeCustom
}

export const modeBadges: Record<string, string> = {
  werewolf: '狼',
  avalon: '剑',
  undercover: '词',
  custom: '创',
}
