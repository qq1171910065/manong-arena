import { CHARACTER_MODEL_OPTIONS } from '@shared/arena/constants'
import type { SystemRoleKind } from '@shared/arena/game-scenario'
import type { GatewayModelInfo } from '@renderer/services/gateway-api'

export interface ModelCatalogEntry {
  id: string
  label: string
  vendor: string
  desc: string
  endpointTypes?: string[]
}

const LABEL_BY_ID = Object.fromEntries(CHARACTER_MODEL_OPTIONS.map((item) => [item.id, item.label]))

const VENDOR_BY_ID: Record<string, string> = {
  doubao: 'ByteDance',
  'gpt-4o': 'OpenAI',
  'claude-3-5-sonnet': 'Anthropic',
  'deepseek-chat': 'DeepSeek',
  kimi: 'Moonshot',
  'gemini-pro': 'Google',
  'qwen-max': 'Alibaba',
  'mistral-large-latest': 'Mistral',
  'llama-3.1-70b': 'Meta',
  'hunyuan-turbo': 'Tencent',
  'glm-4-plus': 'Z.ai',
  'abab6.5-chat': 'MiniMax',
  'yi-large': '01.AI',
  'ernie-4.0-turbo-8k': 'Baidu',
  'grok-2-1212': 'xAI',
  'spark-max': 'iFlytek',
}

const DESC_BY_ID: Record<string, string> = {
  doubao: '默认中文模型，响应快，适合日常对局与规则审阅。',
  'gpt-4o': '综合能力均衡，适合信息整合与稳定发言。',
  'claude-3-5-sonnet': '表达细腻，适合解说与谨慎推理角色。',
  'deepseek-chat': '推理成本友好，适合大规模角色对局。',
  kimi: '长上下文表现好，适合线索整理与主持。',
  'gemini-pro': '适合开放式发言与多轮讨论。',
}

export const CHARACTER_MODEL_RECOMMENDED = ['doubao', 'gpt-4o', 'claude-3-5-sonnet', 'deepseek-chat', 'kimi', 'gemini-pro']

export const SYSTEM_ROLE_MODEL_RECOMMENDED: Record<SystemRoleKind, string[]> = {
  judge: ['doubao', 'gpt-4o', 'deepseek-chat', 'claude-3-5-sonnet'],
  narrator: ['gpt-4o', 'claude-3-5-sonnet', 'doubao', 'abab6.5-chat'],
  host: ['doubao', 'gpt-4o', 'kimi', 'deepseek-chat'],
  commentator: ['gpt-4o', 'doubao', 'claude-3-5-sonnet', 'kimi'],
}

function displayLabel(id: string): string {
  if (LABEL_BY_ID[id]) return LABEL_BY_ID[id]
  const tail = id.split('/').pop() || id
  return tail.length > 28 ? tail.slice(0, 26) + '…' : tail
}

export function entryFromGateway(raw: GatewayModelInfo): ModelCatalogEntry {
  const vendor = raw.tags[0] || VENDOR_BY_ID[raw.id] || 'Gateway'
  const endpoints = raw.endpointTypes.filter(Boolean)
  const knownDesc = DESC_BY_ID[raw.id]
  return {
    id: raw.id,
    label: displayLabel(raw.id),
    vendor,
    desc: knownDesc || (endpoints.length ? `网关对话模型 · ${endpoints.join(' / ')}` : '网关可用对话模型'),
    endpointTypes: endpoints,
  }
}

export function resolveModelInfo(id: string, vendorHint?: string): ModelCatalogEntry {
  return {
    id,
    label: displayLabel(id),
    vendor: vendorHint || VENDOR_BY_ID[id] || 'Gateway',
    desc: DESC_BY_ID[id] || '来自网关模型列表。',
  }
}

export function modelPickerTitle(model: ModelCatalogEntry): string {
  return `${model.label}\n${model.id}\n${model.vendor}\n${model.desc}`
}

export function pickRecommendedFromGateway(all: ModelCatalogEntry[], preferredIds: string[], limit = 6): ModelCatalogEntry[] {
  const byId = new Map(all.map((item) => [item.id, item]))
  const picked: ModelCatalogEntry[] = []
  for (const id of preferredIds) {
    const item = byId.get(id)
    if (item) picked.push(item)
  }
  if (picked.length >= limit) return picked.slice(0, limit)
  for (const item of all) {
    if (picked.some((row) => row.id === item.id)) continue
    picked.push(item)
    if (picked.length >= limit) break
  }
  return picked
}
