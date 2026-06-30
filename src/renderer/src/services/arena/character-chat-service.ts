import { buildWorkspaceFileIntentHint, hasWorkspaceFileIntent } from '@shared/arena/character-workspace-tools'
import { buildAgentContextPrompt, normalizeAgentProfile } from '@shared/arena/character-agent'
import { resolveCharacterModelParams, toGatewayGenerationParams } from '@shared/arena/character-model-params'
import { randomUUID } from '@renderer/utils/id'
import { gatewayChatCompletion, gatewayChatStream } from '../gateway-api'
import type { GatewayTokenUsage } from '../gateway-api'
import { characterService } from './character-service'
import { characterAgentService } from './character-agent-service'
import { characterGrowthService } from './character-growth-service'
import { arenaInvoke, ensureArenaReady } from './client'
import { settingsService } from './settings-service'
import { arenaLog } from './logger'
import type { Character, CharacterChatMessage, CharacterGrowthRecord, MessageStreamStatus } from '@shared/arena/types'

export type ChatStreamHandler = (messages: CharacterChatMessage[]) => void

const SESSION_TRANSCRIPT_LIMIT = 40

function localDateKey(iso = new Date().toISOString()): string {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function hasRealChatSession(messages: CharacterChatMessage[]): boolean {
  return messages.some((message) => message.role === 'user')
}

function buildSessionTranscript(character: Character, messages: CharacterChatMessage[]): string {
  return messages
    .slice(-SESSION_TRANSCRIPT_LIMIT)
    .map((message) => (message.role === 'user' ? '用户' : character.name) + '：' + message.content)
    .join('\n')
}

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

function buildChatSystemPrompt(
  character: Character,
  workspaceExcerpts: Array<{ name: string; content: string }> = [],
  workspaceToolsPrompt = '',
  userMessage = ''
): string {
  const agentContext = buildAgentContextPrompt({
    scope: 'chat',
    memories: character.agentMemories,
    skills: character.agentSkills,
    workspaceExcerpts,
    profile: character.agentProfile,
  })
  const profile = normalizeAgentProfile(character.agentProfile)
  const fileIntent = hasWorkspaceFileIntent(userMessage)
  return [
    `你是 AI 角色「${character.name}」。`,
    character.subtitle ? `副标题：${character.subtitle}` : '',
    character.bio ? `人设：${character.bio}` : '',
    `说话风格：${character.speechStyle}`,
    character.tags.length ? `标签：${character.tags.join('、')}` : '',
    character.behaviorPrinciples.length ? `行为原则：${character.behaviorPrinciples.join('；')}` : '',
    character.commonPhrases.length ? `常用表达：${character.commonPhrases.join('、')}` : '',
    character.tabooBehaviors.length ? `禁忌：${character.tabooBehaviors.join('；')}` : '',
    profile.extraInstructions ? `补充设定：${profile.extraInstructions}` : '',
    agentContext,
    workspaceToolsPrompt,
    buildWorkspaceFileIntentHint(userMessage),
    '',
    '你正在与用户一对一私下交流，保持角色口吻，自然回应，可流露情绪与态度。',
    '这是日常私聊，不是游戏或对局场景。不要主动提起玩法规则、对局经历或胜负，除非用户明确问起。',
    '不要跳出角色，不要提及你是 AI 或模型。',
    fileIntent
      ? '用户要求文件操作：口头回复可简短，完整正文必须放在 <workspace-tools> 的 content 字段；没有该标签则文件不会出现。'
      : '回复控制在 80-200 字，除非用户明确要求详细说明。',
  ]
    .filter(Boolean)
    .join('\n')
}

async function finalizeSessionGrowth(
  character: Character,
  sessionMessages: CharacterChatMessage[]
): Promise<{ character: Character; growthApplied: boolean }> {
  const settings = await settingsService.get()
  if (!settings.characterEvolution?.postGameReviewEnabled || !hasRealChatSession(sessionMessages)) {
    return { character, growthApplied: false }
  }

  const transcript = buildSessionTranscript(character, sessionMessages)
  const growthRes = await gatewayChatCompletion(character.modelId, [
    {
      role: 'system',
      content: [
        `你是角色养成顾问。根据「${character.name}」与用户的一整段私聊会话，判断角色是否应轻微成长。`,
        '当前行为原则：' + (character.behaviorPrinciples.join('；') || '无'),
        '当前常用表达：' + (character.commonPhrases.join('、') || '无'),
        '输出 JSON：{"summary":"成长摘要","addedPrinciples":[],"removedPrinciples":[],"addedPhrases":[],"shouldApply":true/false}',
        '仅当会话确有可沉淀的变化时 shouldApply 为 true；闲聊废话、单次寒暄应返回 false。',
        '调整应轻微、符合整段对话，最多新增 1 条原则或 1 条常用表达。',
      ].join('\n'),
    },
    { role: 'user', content: '完整会话：\n' + transcript },
  ])

  const parsed = parseJsonLike(growthRes.content || '') || {}
  if (!parsed.shouldApply) return { character, growthApplied: false }

  const added = Array.isArray(parsed.addedPrinciples) ? parsed.addedPrinciples.map(String).filter(Boolean) : []
  const removed = Array.isArray(parsed.removedPrinciples) ? parsed.removedPrinciples.map(String).filter(Boolean) : []
  const addedPhrases = Array.isArray(parsed.addedPhrases) ? parsed.addedPhrases.map(String).filter(Boolean) : []
  const summary = String(parsed.summary || '私聊会话成长').trim()
  const hasChanges = added.length > 0 || removed.length > 0 || addedPhrases.length > 0
  if (!summary && !hasChanges) return { character, growthApplied: false }

  const next = { ...character }
  next.behaviorPrinciples = [
    ...next.behaviorPrinciples.filter((principle) => !removed.includes(principle)),
    ...added.filter((principle) => !next.behaviorPrinciples.includes(principle)),
  ]
  next.commonPhrases = [
    ...next.commonPhrases,
    ...addedPhrases.filter((phrase) => !next.commonPhrases.includes(phrase)),
  ].slice(0, 12)

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

  let saved = character
  if (settings.characterEvolution.autoApplyBehaviorChanges && hasChanges) {
    record.applied = true
    saved = await characterService.save(next)
    saved = await characterGrowthService
      .applyChatGrowthExp(saved, growthRes.usage, growthRes.content, summary)
      .catch(() => saved)
    arenaLog('info', 'character', `角色 ${character.name} 私聊会话成长`, summary)
  }

  await ensureArenaReady()
  await arenaInvoke('storage', 'appendCharacterGrowth', () => window.api.appendCharacterGrowth(record))
  return { character: saved, growthApplied: true }
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

  async prepareChatSession(characterId: string): Promise<{
    character: Character
    messages: CharacterChatMessage[]
    sessionRolledOver: boolean
    growthApplied: boolean
  }> {
    await ensureArenaReady()
    let character = characterAgentService.ensureAgentDefaults(await characterService.get(characterId))
    let messages = await this.listMessages(characterId)
    let sessionRolledOver = false
    let growthApplied = false

    if (hasRealChatSession(messages)) {
      const lastDate = localDateKey(messages[messages.length - 1]?.createdAt)
      if (lastDate !== localDateKey()) {
        const result = await finalizeSessionGrowth(character, messages).catch(() => ({
          character,
          growthApplied: false,
        }))
        character = result.character
        growthApplied = result.growthApplied
        await this.clearMessages(characterId)
        messages = []
        sessionRolledOver = true
      }
    }

    return { character, messages, sessionRolledOver, growthApplied }
  },

  async startNewSession(characterId: string): Promise<{ character: Character; growthApplied: boolean }> {
    await ensureArenaReady()
    let character = characterAgentService.ensureAgentDefaults(await characterService.get(characterId))
    const messages = await this.listMessages(characterId)
    let growthApplied = false

    if (hasRealChatSession(messages)) {
      const result = await finalizeSessionGrowth(character, messages).catch(() => ({
        character,
        growthApplied: false,
      }))
      character = result.character
      growthApplied = result.growthApplied
    }

    await this.clearMessages(characterId)
    return { character, growthApplied }
  },

  async sendMessageStream(
    characterId: string,
    text: string,
    onMessages: ChatStreamHandler
  ): Promise<{ reply: string; character: Character; messages: CharacterChatMessage[] }> {
    const trimmed = text.trim()
    if (!trimmed) throw new Error('请输入消息')

    await ensureArenaReady()
    const character = characterAgentService.ensureAgentDefaults(await characterService.get(characterId))
    const inference = resolveCharacterModelParams(character)
    const gatewayParams = toGatewayGenerationParams(inference)
    const workspaceExcerpts = await characterAgentService.readWorkspaceExcerpts(characterId).catch(() => [])
    const workspaceToolsPrompt = await characterAgentService.buildWorkspaceToolsPrompt(characterId).catch(() => '')

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
      { role: 'system', content: buildChatSystemPrompt(character, workspaceExcerpts, workspaceToolsPrompt, trimmed) },
      ...afterUser.slice(-inference.contextMessageLimit).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
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
      }, gatewayParams).catch(reject)
    })

    let reply = draft.trim() || '……让我想想。'
    const toolProcessed = await characterAgentService
      .resolveWorkspaceToolsFromReply(character, trimmed, reply)
      .catch(() => null)
    if (toolProcessed) {
      reply = toolProcessed.reply || (toolProcessed.toolNotes ? '已更新文件空间。' : reply)
      if (toolProcessed.toolNotes) {
        reply = reply ? `${reply}\n\n（${toolProcessed.toolNotes.replace(/\n/g, '；')}）` : toolProcessed.toolNotes
      }
    }
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
    const memorized = await characterAgentService.maybeExtractMemoriesFromChat(updated, messages).catch(() => null)
    if (memorized) updated = memorized

    return { reply, character: updated, messages }
  },

  async sendMessage(characterId: string, text: string): Promise<{ reply: string; character: Character; messages: CharacterChatMessage[] }> {
    const trimmed = text.trim()
    if (!trimmed) throw new Error('请输入消息')

    await ensureArenaReady()
    const character = characterAgentService.ensureAgentDefaults(await characterService.get(characterId))
    const inference = resolveCharacterModelParams(character)
    const gatewayParams = toGatewayGenerationParams(inference)
    const workspaceExcerpts = await characterAgentService.readWorkspaceExcerpts(characterId).catch(() => [])
    const workspaceToolsPrompt = await characterAgentService.buildWorkspaceToolsPrompt(characterId).catch(() => '')

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
      { role: 'system', content: buildChatSystemPrompt(character, workspaceExcerpts, workspaceToolsPrompt, trimmed) },
      ...afterUser.slice(-inference.contextMessageLimit).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
    ]

    const response = await gatewayChatCompletion(character.modelId, llmMessages, gatewayParams)
    let reply = String(response.content || '').trim() || '……让我想想。'
    const toolProcessed = await characterAgentService
      .resolveWorkspaceToolsFromReply(character, trimmed, reply)
      .catch(() => null)
    if (toolProcessed) {
      reply = toolProcessed.reply || (toolProcessed.toolNotes ? '已更新文件空间。' : reply)
      if (toolProcessed.toolNotes) {
        reply = reply ? `${reply}\n\n（${toolProcessed.toolNotes.replace(/\n/g, '；')}）` : toolProcessed.toolNotes
      }
    }

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
    const memorized = await characterAgentService.maybeExtractMemoriesFromChat(updated, messages).catch(() => null)
    if (memorized) updated = memorized

    return { reply, character: updated, messages }
  },
}
