/** 角色成长属性 → 网关推理参数映射 */

import type { Character } from './types'
import {
  CHARACTER_ATTRIBUTE_LABELS,
  computeCharacterAttributes,
  computePersonalitySkills,
  resolveCharacterGrowth,
  type CharacterAttributeId,
  type CharacterAttributes,
  type CharacterPersonalitySkill,
} from './character-growth'

export interface CharacterAttributeMeta {
  label: string
  description: string
  modelHint: string
}

export const CHARACTER_ATTRIBUTE_META: Record<CharacterAttributeId, CharacterAttributeMeta> = {
  precision: {
    label: '提示精准',
    description: '人设与指令贴合度，越高越克制、越贴设定',
    modelHint: 'top_p ↑ · frequency_penalty ↑ · 提示词约束 ↑',
  },
  empathy: {
    label: '共情细腻',
    description: '情绪回应与语气柔软度，越高越不易机械重复',
    modelHint: 'presence_penalty ↓ · 语气偏柔和',
  },
  creativity: {
    label: '创意温度',
    description: '表达发散与意外性，越高越有灵感、越敢变奏',
    modelHint: 'temperature ↑',
  },
  context: {
    label: '上下文广度',
    description: '可注入的历史对话窗口，越高越记得前文',
    modelHint: 'history window ↑',
  },
  depth: {
    label: '思考深度',
    description: '单次回复与推理预算，越高越愿意展开',
    modelHint: 'max_tokens ↑ · reasoning depth ↑',
  },
}

export type CharacterReasoningDepth = 'lite' | 'standard' | 'deep'

export interface CharacterModelInferenceParams {
  temperature: number
  top_p: number
  presence_penalty: number
  frequency_penalty: number
  max_tokens: number
  contextMessageLimit: number
  promptStrictness: number
  reasoningDepth: CharacterReasoningDepth
}

export interface GatewayGenerationParams {
  temperature?: number
  top_p?: number
  presence_penalty?: number
  frequency_penalty?: number
  max_tokens?: number
}

export interface CharacterDevProfile {
  attributes: CharacterAttributes
  attributeEntries: Array<{
    id: CharacterAttributeId
    value: number
    label: string
    description: string
    modelHint: string
  }>
  modelParams: CharacterModelInferenceParams
  gatewayParams: GatewayGenerationParams
  reasoningDepthLabel: string
  promptStrictnessLabel: string
  activeSkills: CharacterPersonalitySkill[]
  growth: ReturnType<typeof resolveCharacterGrowth>
}

const LEGACY_ATTRIBUTE_KEYS: Record<string, CharacterAttributeId> = {
  expression: 'precision',
  imagination: 'creativity',
  collaboration: 'context',
  activity: 'depth',
  empathy: 'empathy',
}

function createEmptyAttributes(): CharacterAttributes {
  return {
    precision: 0,
    empathy: 0,
    creativity: 0,
    context: 0,
    depth: 0,
  }
}

export function normalizeCharacterAttributes(raw: Partial<Record<string, number>> | CharacterAttributes): CharacterAttributes {
  const result = createEmptyAttributes()
  for (const [key, value] of Object.entries(raw || {})) {
    if (typeof value !== 'number') continue
    const id = (LEGACY_ATTRIBUTE_KEYS[key] || key) as CharacterAttributeId
    if (id in result) result[id] = value
  }
  return result
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function round(value: number, digits = 2): number {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

function attrNorm(attrs: CharacterAttributes, id: CharacterAttributeId): number {
  return clamp01((attrs[id] - 20) / 100)
}

export function resolveCharacterModelParams(character: Character): CharacterModelInferenceParams {
  const attrs = computeCharacterAttributes(character)
  const precision = attrNorm(attrs, 'precision')
  const empathy = attrNorm(attrs, 'empathy')
  const creativity = attrNorm(attrs, 'creativity')
  const context = attrNorm(attrs, 'context')
  const depth = attrNorm(attrs, 'depth')

  const reasoningDepth: CharacterReasoningDepth = depth >= 0.72 ? 'deep' : depth >= 0.42 ? 'standard' : 'lite'

  return {
    temperature: round(0.42 + creativity * 0.56),
    top_p: round(0.78 + precision * 0.2),
    presence_penalty: round(0.38 - empathy * 0.28),
    frequency_penalty: round(0.06 + precision * 0.34),
    max_tokens: Math.round(160 + depth * 440),
    contextMessageLimit: Math.round(8 + context * 24),
    promptStrictness: round(0.52 + precision * 0.42),
    reasoningDepth,
  }
}

export function toGatewayGenerationParams(params: CharacterModelInferenceParams): GatewayGenerationParams {
  return {
    temperature: params.temperature,
    top_p: params.top_p,
    presence_penalty: params.presence_penalty,
    frequency_penalty: params.frequency_penalty,
    max_tokens: params.max_tokens,
  }
}

export function reasoningDepthLabel(depth: CharacterReasoningDepth): string {
  switch (depth) {
    case 'deep':
      return '深度推理'
    case 'standard':
      return '标准推理'
    default:
      return '轻量回复'
  }
}

export function promptStrictnessLabel(value: number): string {
  if (value >= 0.82) return '强约束 · 高度贴设定'
  if (value >= 0.65) return '中约束 · 平衡发挥'
  return '弱约束 · 允许自由发挥'
}

export function resolveCharacterDevProfile(character: Character): CharacterDevProfile {
  const attributes = computeCharacterAttributes(character)
  const modelParams = resolveCharacterModelParams(character)
  const attributeEntries = (Object.keys(CHARACTER_ATTRIBUTE_LABELS) as CharacterAttributeId[]).map((id) => ({
    id,
    value: attributes[id],
    label: CHARACTER_ATTRIBUTE_META[id].label,
    description: CHARACTER_ATTRIBUTE_META[id].description,
    modelHint: CHARACTER_ATTRIBUTE_META[id].modelHint,
  }))

  return {
    attributes,
    attributeEntries,
    modelParams,
    gatewayParams: toGatewayGenerationParams(modelParams),
    reasoningDepthLabel: reasoningDepthLabel(modelParams.reasoningDepth),
    promptStrictnessLabel: promptStrictnessLabel(modelParams.promptStrictness),
    activeSkills: computePersonalitySkills(character).filter((skill) => skill.level > 0),
    growth: resolveCharacterGrowth(character),
  }
}
