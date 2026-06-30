import { randomUUID } from '@renderer/utils/id'
import { gatewayChatCompletion, gatewayChatStream } from '../gateway-api'
import type { GatewayTokenUsage } from '../gateway-api'
import { characterService } from './character-service'
import { characterGrowthService } from './character-growth-service'
import { arenaInvoke, ensureArenaReady } from './client'
import { settingsService } from './settings-service'
import { arenaLog } from './logger'
import type { Character, CharacterChatMessage, CharacterGrowthRecord, MessageStreamStatus } from '@shared/arena/types'

export type ChatStreamHandler = (messages: CharacterChatMessage[]) => void

const GROWTH_EVERY_TURNS = 2

function parseJsonLike(raw: string): Record<string, unknown> | null {
  const text = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0]) as Record<string, unknown>
    } catch {
      return null
    }
  }
}

function buildChatSystemPrompt(character: Character): string {
  return [
    `你是 AI 角色「${character.name}」。`,
    character.subtitle ? `副标题：${character.subtitle}` : '',
    character.bio ? `人设：${character.bio}` : '',
    `说话风格：${character.speechStyle}`,
    character.tags.length ? `标签：${character.tags.join('、')}` : '',
    character.behaviorPrinciples.length ? `行为原则：${character.behaviorPrinciples.join('；')}` : '',
    character.commonPhrases.length ? `常用表达：${character.commonPhrases.join('、')}` : '',
    character.tabooBehaviors.length ? `禁忌：${character.tabooBehaviors.join('；')}` : '',
    '',
    '你正在与用户一对一私下交流，保持角色口吻，自然回应，可流露情绪与态度。',
    '不要跳出角色，不要提及你是 AI 或模型。',
    '回复控制在 80-200 字，除非用户明确要求详细说明。',
  ]
    .filter(Boolean)
    .join('\n')
}

async function maybeApplyChatGrowth(character: Character, recentMessages: CharacterChatMessage[]): Promise<Character | null> {
  const settings = await settingsService.get()
  if (!settings.characterEvolution?.postGameReviewEnabled) return null

  const userTurns = recentMessages.filter((m) => m.role === 'user').length
  if (userTurns === 0 || userTurns % GROWTH_EVERY_TURNS !== 0) return null

  const transcript = recentMessages
    .slice(-8)
    .map((m) => (m.role === 'user' ? '用户' : character.name) + '：' + m.content)
    .join('\n')

  const growthRes = await gatewayChatCompletion(character.modelId, [
    {
      role: 'system',
      content: [
        `你是角色养成顾问。根据「${character.name}」与用户的对话，判断角色是否应轻微成长。`,
        '当前行为原则：' + (character.behaviorPrinciples.join('；') || '无'),
        '当前常用表达：' + (character.commonPhrases.join('、') || '无'),
        '输出 JSON：{"summary":"成长摘要","addedPrinciples":[],"removedPrinciples":[],"addedPhrases":[],"shouldApply":true/false}',
        '调整应轻微、符合对话内容，每次最多新增 1 条原则或 1 条常用表达。',
      ].join('\n'),
    },
    { role: 'user', content: '近期对话：\n' + transcript },
  ])

  const parsed = parseJsonLike(growthRes.content || '') || {}
  if (!parsed.shouldApply) return null

  const added = Array.isArray(parsed.addedPrinciples) ? parsed.addedPrinciples.map(String).filter(Boolean) : []
  const removed = Array.isArray(parsed.removedPrinciples) ? parsed.removedPrinciples.map(String).filter(Boolean) : []
  const addedPhrases = Array.isArray(parsed.addedPhrases) ? parsed.addedPhrases.map(String).filter(Boolean) : []
  const summary = String(parsed.summary || '对话中成长').trim()

  if (!added.length && !removed.length && !addedPhrases.length) return null

  const next = { ...character }
  next.behaviorPrinciples = [...next.behaviorPrinciples.filter((p) => !removed.includes(p)), ...added.filter((p) => !next.behaviorPrinciples.includes(p))]
  next.commonPhrases = [...next.commonPhrases, ...addedPhrases.filter((p) => !next.commonPhrases.includes(p))].slice(0, 12)

  const record: CharacterGrowthRecord = {
    id: randomUUID(),
    characterId: character.id,
    source: 'chat',
    summary,
    createdAt: new Date().toISOString(),
    addedPrinciples: added,
    removedPrinciples: removed,
    addedPhrases,
    applied: false,
  }

  if (settings.characterEvolution.autoApplyBehaviorChanges) {
    record.applied = true
    let saved = await characterService.save(next)
    await ensureArenaReady()
    await arenaInvoke('storage', 'appendCharacterGrowth', () => window.api.appendCharacterGrowth(record))
    saved = await characterGrowthService.applyChatGrowthExp(saved, growthRes.usage, growthRes.content, summary).catch(() => saved)
    arenaLog('info', 'character', `角色 ${character.name} 对话成长`, summary)
    return saved
  }

  await ensureArenaReady()
  await arenaInvoke('storage', 'appendCharacterGrowth', () => window.api.appendCharacterGrowth(record))
  return null
}

export const characterChatService = {
  async listMessages(characterId: string): Promise<CharacterChatMessage[]> {
    await ensureArenaReady()
    return arenaInvoke('storage', 'listCharacterChat', () => window.api.listCharacterChat(characterId))
  },

  async listGrowth(characterId: string): Promise<CharacterGrowthRecord[]> {
    await ensureArenaReady()
    return arenaInvoke('storage', 'listCharacterGrowth', () => window.api.listCharacterGrowth(characterId))
  },

  async clearMessages(characterId: string): Promise<void> {
    await ensureArenaReady()
    await arenaInvoke('storage', 'clearCharacterChat', () => window.api.clearCharacterChat(characterId))
  },

  async sendMessageStream(
    characterId: string,
    text: string,
    onMessages: ChatStreamHandler
  ): Promise<{ reply: string; character: Character; messages: CharacterChatMessage[] }> {
    const trimmed = text.trim()
    if (!trimmed) throw new Error('请输入消息')

    await ensureArenaReady()
    const character = await characterService.get(characterId)

    const userMsg: CharacterChatMessage = {
      id: randomUUID(),
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    }
    const afterUser = await arenaInvoke('storage', 'appendCharacterChat', () =>
      window.api.appendCharacterChat(characterId, userMsg)
    )

    const placeholderId = randomUUID()
    let draft = ''
    let streamStatus: MessageStreamStatus = 'pending'
    const pushDraft = () => {
      const draftMsg: CharacterChatMessage = {
        id: placeholderId,
        role: 'assistant',
        content: draft,
        createdAt: new Date().toISOString(),
        streamStatus,
      }
      onMessages([...afterUser, draftMsg])
    }

    pushDraft()

    let usage: GatewayTokenUsage | undefined
    const llmMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: buildChatSystemPrompt(character) },
      ...afterUser.slice(-16).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
    ]

    await new Promise<void>((resolve, reject) => {
      void gatewayChatStream(character.modelId, llmMessages, {
        onChunk: (chunk) => {
          draft += chunk
          streamStatus = 'streaming'
          pushDraft()
        },
        onUsage: (u) => {
          usage = { ...usage, ...u }
        },
        onEnd: () => resolve(),
        onError: (err) => reject(new Error(err)),
      }).catch(reject)
    })

    const reply = draft.trim() || '……让我想想。'
    streamStatus = 'done'
    draft = reply
    pushDraft()

    const assistantMsg: CharacterChatMessage = {
      id: placeholderId,
      role: 'assistant',
      content: reply,
      createdAt: new Date().toISOString(),
      streamStatus: 'done',
    }
    const messages = await arenaInvoke('storage', 'appendCharacterChat', () =>
      window.api.appendCharacterChat(characterId, assistantMsg)
    )
    onMessages(messages)

    let updated = await characterService.get(characterId)
    updated = await characterGrowthService
      .applyChatGrowthExp(updated, usage, reply, '私聊回复')
      .catch(() => updated)
    const grown = await maybeApplyChatGrowth(updated, messages).catch(() => null)
    if (grown) updated = grown

    return { reply, character: updated, messages }
  },

  async sendMessage(characterId: string, text: string): Promise<{ reply: string; character: Character; messages: CharacterChatMessage[] }> {
    const trimmed = text.trim()
    if (!trimmed) throw new Error('请输入消息')

    await ensureArenaReady()
    const character = await characterService.get(characterId)

    const userMsg: CharacterChatMessage = {
      id: randomUUID(),
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    }
    const afterUser = await arenaInvoke('storage', 'appendCharacterChat', () =>
      window.api.appendCharacterChat(characterId, userMsg)
    )

    const llmMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: buildChatSystemPrompt(character) },
      ...afterUser.slice(-16).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
    ]

    const response = await gatewayChatCompletion(character.modelId, llmMessages)
    const reply = String(response.content || '').trim() || '……让我想想。'

    const assistantMsg: CharacterChatMessage = {
      id: randomUUID(),
      role: 'assistant',
      content: reply,
      createdAt: new Date().toISOString(),
    }
    const messages = await arenaInvoke('storage', 'appendCharacterChat', () =>
      window.api.appendCharacterChat(characterId, assistantMsg)
    )

    let updated = await characterService.get(characterId)
    updated = await characterGrowthService
      .applyChatGrowthExp(updated, response.usage, reply, '私聊回复')
      .catch(() => updated)
    const grown = await maybeApplyChatGrowth(updated, messages).catch(() => null)
    if (grown) updated = grown

    return { reply, character: updated, messages }
  },
}
