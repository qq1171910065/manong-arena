import { randomUUID } from '@renderer/utils/id'
import projectDocsRaw from '../data/project-docs.md?raw'
import { gatewayChatStream, resolveChatModelId } from './gateway-api'
import { arenaInvoke, ensureArenaReady } from './arena/client'
import type { CharacterChatMessage, MessageStreamStatus } from '@shared/arena/types'

export const HELP_WELCOME_TEXT =
  '你好，我是帮助助手。你可以问我关于角色、对局、模型服务、钱包充值等问题，我会基于项目文档回答。'

export type HelpChatStreamHandler = (messages: CharacterChatMessage[]) => void

function buildHelpSystemPrompt(): string {
  return [
    '你是 Agent Arena 设置中心「帮助中心」的答疑助手。',
    '',
    '## 回答规则',
    '- 只能根据下方「项目文档」中的内容回答，不得编造文档未提及的功能、步骤、政策或数值。',
    '- 若用户问题在项目文档中没有明确说明，必须直接回复：「项目文档中暂无相关说明。你可以前往「项目文档」查看完整内容，或通过「报 Bug」提交反馈。」不要给出推测性答案。',
    '- 语气清晰友好，回答简洁，优先分点说明操作步骤。',
    '- 不要提及你是 AI 模型；不要引用文档外的互联网知识。',
    '',
    '## 项目文档',
    projectDocsRaw.trim(),
  ].join('\n')
}

export function createHelpWelcomeMessage(): CharacterChatMessage {
  return {
    id: 'welcome',
    role: 'assistant',
    content: HELP_WELCOME_TEXT,
    createdAt: new Date().toISOString(),
  }
}

export const helpChatService = {
  createWelcomeMessage: createHelpWelcomeMessage,

  async listMessages(): Promise<CharacterChatMessage[]> {
    await ensureArenaReady()
    return arenaInvoke('storage', 'listHelpChat', () => window.api.listHelpChat())
  },

  async clearMessages(): Promise<void> {
    await ensureArenaReady()
    await arenaInvoke('storage', 'clearHelpChat', () => window.api.clearHelpChat())
  },

  async askStream(
    question: string,
    onMessages: HelpChatStreamHandler
  ): Promise<{ reply: string; messages: CharacterChatMessage[] }> {
    const trimmed = question.trim()
    if (!trimmed) throw new Error('请输入问题')

    await ensureArenaReady()

    const userMsg: CharacterChatMessage = {
      id: randomUUID(),
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    }
    const afterUser = await arenaInvoke('storage', 'appendHelpChat', () =>
      window.api.appendHelpChat(userMsg)
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
      { role: 'system', content: buildHelpSystemPrompt() },
      ...afterUser.slice(-16).map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
    ]

    const modelId = await resolveChatModelId()

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
    const messages = await arenaInvoke('storage', 'appendHelpChat', () =>
      window.api.appendHelpChat(assistantMsg)
    )
    onMessages(messages)

    return { reply, messages }
  },
}
