import { randomUUID } from '@renderer/utils/id'
import { CHARACTER_MODEL_RECOMMENDED } from '@renderer/data/model-catalog'
import { gatewayChatCompletion, gatewayChatStream, resolveChatModelId } from '../gateway-api'
import { gameScenarioService } from './game-scenario-service'
import { gameModeService } from './character-service'
import { arenaInvoke, ensureArenaReady } from './client'
import type { CharacterChatMessage, GameMode, MessageStreamStatus } from '@shared/arena/types'
import type { GameScenarioDefinition } from '@shared/arena/game-scenario'

export type QAStreamHandler = (messages: CharacterChatMessage[]) => void

function resolveScenarioSystemModelId(scenario: GameScenarioDefinition | null | undefined): string | undefined {
  const roles = scenario?.systemRoles
  if (!roles?.length) return undefined
  const judge = roles.find((role) => role.kind === 'judge' && role.enabled !== false)
  const narrator = roles.find((role) => role.kind === 'narrator' && role.enabled !== false)
  const host = roles.find((role) => role.kind === 'host' && role.enabled !== false)
  const picked =
    judge?.modelId ||
    narrator?.modelId ||
    host?.modelId ||
    roles.find((role) => role.enabled !== false)?.modelId ||
    roles[0]?.modelId
  return picked?.trim() || undefined
}

function buildQASystemPrompt(mode: GameMode, scenario: GameScenarioDefinition | null | undefined): string {
  return [
    `你是 Agent Arena 的玩法答疑助手，专门解答玩家关于「${mode.name}」的问题。`,
    '',
    '## 你的职责',
    '- 根据下方官方玩法文档准确回答规则、身份技能、流程阶段相关问题。',
    '- 可以举例说明，但不要编造文档中不存在的规则。',
    '- 若文档未涵盖，明确说「当前规则未定义」，并给出合理推测时须标注为推测。',
    '- 语气清晰友好，面向想开局的玩家。',
    '',
    '## 玩法文档',
    scenario?.contentDocument || mode.description,
    '',
    mode.setupSummary ? '## 开局说明\n' + mode.setupSummary : '',
    mode.sheriffRule ? '## 警长规则\n' + mode.sheriffRule : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export const gameModeQAService = {
  async listMessages(gameModeId: string): Promise<CharacterChatMessage[]> {
    await ensureArenaReady()
    return arenaInvoke('storage', 'listGameModeQA', () => window.api.listGameModeQA(gameModeId))
  },

  async clearMessages(gameModeId: string): Promise<void> {
    await ensureArenaReady()
    await arenaInvoke('storage', 'clearGameModeQA', () => window.api.clearGameModeQA(gameModeId))
  },

  async askStream(
    gameModeId: string,
    question: string,
    onMessages: QAStreamHandler
  ): Promise<{ reply: string; messages: CharacterChatMessage[] }> {
    const trimmed = question.trim()
    if (!trimmed) throw new Error('请输入问题')

    await ensureArenaReady()
    const mode = gameModeService.get(gameModeId)
    if (!mode) throw new Error('玩法不存在')
    const scenario = gameScenarioService.getByGameModeId(gameModeId)

    const userMsg: CharacterChatMessage = {
      id: randomUUID(),
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    }
    const afterUser = await arenaInvoke('storage', 'appendGameModeQA', () =>
      window.api.appendGameModeQA(gameModeId, userMsg)
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

    const llmMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: buildQASystemPrompt(mode, scenario) },
      ...afterUser.slice(-12).map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
    ]

    const modelId = await resolveChatModelId({
      explicit: resolveScenarioSystemModelId(scenario),
      preferred: CHARACTER_MODEL_RECOMMENDED,
    })

    await new Promise<void>((resolve, reject) => {
      void gatewayChatStream(modelId, llmMessages, {
        onChunk: (chunk) => {
          draft += chunk
          streamStatus = 'streaming'
          pushDraft()
        },
        onEnd: () => resolve(),
        onError: (err) => reject(new Error(err)),
      }).catch(reject)
    })

    const reply = draft.trim() || '抱歉，我暂时无法回答这个问题。'
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
    const messages = await arenaInvoke('storage', 'appendGameModeQA', () =>
      window.api.appendGameModeQA(gameModeId, assistantMsg)
    )
    onMessages(messages)

    return { reply, messages }
  },

  async ask(gameModeId: string, question: string): Promise<{ reply: string; messages: CharacterChatMessage[] }> {
    const trimmed = question.trim()
    if (!trimmed) throw new Error('请输入问题')

    await ensureArenaReady()
    const mode = gameModeService.get(gameModeId)
    if (!mode) throw new Error('玩法不存在')
    const scenario = gameScenarioService.getByGameModeId(gameModeId)

    const userMsg: CharacterChatMessage = {
      id: randomUUID(),
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    }
    const afterUser = await arenaInvoke('storage', 'appendGameModeQA', () =>
      window.api.appendGameModeQA(gameModeId, userMsg)
    )

    const llmMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: buildQASystemPrompt(mode, scenario) },
      ...afterUser.slice(-12).map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
    ]

    const modelId = await resolveChatModelId({
      explicit: resolveScenarioSystemModelId(scenario),
      preferred: CHARACTER_MODEL_RECOMMENDED,
    })
    const response = await gatewayChatCompletion(modelId, llmMessages)
    const reply = String(response.content || '').trim() || '抱歉，我暂时无法回答这个问题。'

    const assistantMsg: CharacterChatMessage = {
      id: randomUUID(),
      role: 'assistant',
      content: reply,
      createdAt: new Date().toISOString(),
    }
    const messages = await arenaInvoke('storage', 'appendGameModeQA', () =>
      window.api.appendGameModeQA(gameModeId, assistantMsg)
    )

    return { reply, messages }
  },
}
