import { randomUUID } from '@renderer/utils/id'
import { gatewayChatCompletion } from '../gateway-api'
import {
  BUILTIN_AGENT_SKILL_TEMPLATES,
  CHARACTER_AGENT_SKILL_MAX,
  CHARACTER_MEMORY_MAX,
  normalizeAgentMemories,
  normalizeAgentProfile,
  normalizeAgentSkill,
  normalizeAgentSkills,
  type CharacterAgentProfile,
  type CharacterAgentSkill,
  type CharacterMemoryCategory,
  type CharacterMemoryEntry,
  type CharacterWorkspaceFile,
} from '@shared/arena/character-agent'
import {
  buildWorkspaceToolsPrompt,
  formatWorkspaceToolResults,
  hasWorkspaceFileIntent,
  hasWorkspaceWriteIntent,
  inferWorkspaceWriteFromContext,
  parseWorkspaceToolCalls,
  stripWorkspaceToolBlocks,
  type WorkspaceToolCall,
  type WorkspaceToolResult,
} from '@shared/arena/character-workspace-tools'
import type { Character, CharacterChatMessage } from '@shared/arena/types'
import { arenaInvoke, ensureArenaReady } from './client'
import { characterService } from './character-service'

function touchCharacter(character: Character): Character {
  return {
    ...character,
    updatedAt: new Date().toISOString(),
  }
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

function memoryExists(memories: CharacterMemoryEntry[], content: string): boolean {
  const normalized = content.trim().toLowerCase()
  return memories.some((m) => m.content.trim().toLowerCase() === normalized)
}

export const characterAgentService = {
  ensureAgentDefaults(character: Character): Character {
    return {
      ...character,
      agentMemories: normalizeAgentMemories(character.agentMemories),
      agentSkills: normalizeAgentSkills(character.agentSkills),
      agentProfile: normalizeAgentProfile(character.agentProfile),
    }
  },

  async saveProfile(character: Character, profile: CharacterAgentProfile): Promise<Character> {
    const next = touchCharacter({
      ...character,
      agentProfile: normalizeAgentProfile(profile),
    })
    return characterService.save(next)
  },

  async saveMemories(character: Character, memories: CharacterMemoryEntry[]): Promise<Character> {
    const next = touchCharacter({
      ...character,
      agentMemories: normalizeAgentMemories(memories),
    })
    return characterService.save(next)
  },

  async upsertMemory(character: Character, entry: CharacterMemoryEntry): Promise<Character> {
    const memories = normalizeAgentMemories(character.agentMemories)
    const index = memories.findIndex((item) => item.id === entry.id)
    const nextEntry = {
      ...entry,
      updatedAt: new Date().toISOString(),
    }
    if (index >= 0) memories[index] = nextEntry
    else {
      if (memories.length >= CHARACTER_MEMORY_MAX) {
        throw new Error(`记忆已达上限（${CHARACTER_MEMORY_MAX} 条）`)
      }
      memories.unshift(nextEntry)
    }
    return this.saveMemories(character, memories)
  },

  async deleteMemory(character: Character, memoryId: string): Promise<Character> {
    const memories = normalizeAgentMemories(character.agentMemories).filter((item) => item.id !== memoryId)
    return this.saveMemories(character, memories)
  },

  createMemory(partial?: Partial<CharacterMemoryEntry>): CharacterMemoryEntry {
    const now = new Date().toISOString()
    return {
      id: randomUUID(),
      category: partial?.category || 'note',
      content: partial?.content || '',
      importance: partial?.importance || 2,
      pinned: partial?.pinned ?? false,
      source: partial?.source || 'manual',
      createdAt: now,
      updatedAt: now,
    }
  },

  async saveSkills(character: Character, skills: CharacterAgentSkill[]): Promise<Character> {
    const next = touchCharacter({
      ...character,
      agentSkills: normalizeAgentSkills(skills),
    })
    return characterService.save(next)
  },

  async upsertSkill(character: Character, skill: CharacterAgentSkill): Promise<Character> {
    const skills = normalizeAgentSkills(character.agentSkills)
    const index = skills.findIndex((item) => item.id === skill.id)
    const nextSkill = {
      ...skill,
      updatedAt: new Date().toISOString(),
    }
    if (index >= 0) skills[index] = nextSkill
    else {
      if (skills.length >= CHARACTER_AGENT_SKILL_MAX) {
        throw new Error(`技能已达上限（${CHARACTER_AGENT_SKILL_MAX} 个）`)
      }
      skills.unshift(nextSkill)
    }
    return this.saveSkills(character, skills)
  },

  async deleteSkill(character: Character, skillId: string): Promise<Character> {
    const skills = normalizeAgentSkills(character.agentSkills).filter((item) => item.id !== skillId)
    return this.saveSkills(character, skills)
  },

  createSkill(partial?: Partial<CharacterAgentSkill>): CharacterAgentSkill {
    const now = new Date().toISOString()
    return normalizeAgentSkill({
      id: randomUUID(),
      name: partial?.name || '新技能',
      description: partial?.description || '',
      triggerTiming: partial?.triggerTiming || '用户提出相关诉求时',
      triggerEffect: partial?.triggerEffect || partial?.instructions || '',
      matchEffect: partial?.matchEffect || '',
      matchPhases: partial?.matchPhases || ['speech'],
      scope: partial?.scope || 'both',
      instructions: partial?.instructions || '',
      enabled: partial?.enabled ?? true,
      createdAt: now,
      updatedAt: now,
      ...partial,
    })
  },

  listSkillTemplates() {
    return BUILTIN_AGENT_SKILL_TEMPLATES
  },

  /** 从私聊 transcript 提取 0-2 条长期记忆 */
  async maybeExtractMemoriesFromChat(
    character: Character,
    recentMessages: CharacterChatMessage[]
  ): Promise<Character | null> {
    const userTurns = recentMessages.filter((m) => m.role === 'user').length
    if (userTurns === 0 || userTurns % 3 !== 0) return null

    const existing = normalizeAgentMemories(character.agentMemories)
    const transcript = recentMessages
      .slice(-10)
      .map((m) => (m.role === 'user' ? '用户' : character.name) + '：' + m.content)
      .join('\n')

    const res = await gatewayChatCompletion(character.modelId, [
      {
        role: 'system',
        content: [
          `你是记忆管理员。根据「${character.name}」与用户的对话，判断是否有值得长期记住的信息。`,
          '已有记忆：\n' + (existing.slice(0, 8).map((m) => m.content).join('\n') || '无'),
          '输出 JSON：{"memories":[{"category":"fact|preference|relationship|task|note","content":"...","importance":1|2|3}]}',
          '无新信息则返回 {"memories":[]}。每次最多 2 条，不要重复已有记忆，不要记闲聊废话。',
          '不要记录游戏、对局、玩法规则或胜负相关内容。',
        ].join('\n'),
      },
      { role: 'user', content: '近期对话：\n' + transcript },
    ])

    const parsed = parseJsonLike(res.content || '') || {}
    const rawList = Array.isArray(parsed.memories) ? parsed.memories : []
    let saved = character
    let added = 0

    for (const item of rawList.slice(0, 2)) {
      if (!item || typeof item !== 'object') continue
      const row = item as Record<string, unknown>
      const content = String(row.content || '').trim()
      if (!content || content.length < 4 || memoryExists(normalizeAgentMemories(saved.agentMemories), content)) continue
      const category = String(row.category || 'note') as CharacterMemoryCategory
      const importance = Number(row.importance)
      saved = await this.upsertMemory(
        saved,
        this.createMemory({
          category: ['fact', 'preference', 'relationship', 'task', 'note'].includes(category) ? category : 'note',
          content,
          importance: importance === 1 || importance === 3 ? importance : 2,
          source: 'chat',
        })
      )
      added += 1
    }

    return added ? saved : null
  },

  async listWorkspaceFiles(characterId: string): Promise<CharacterWorkspaceFile[]> {
    await ensureArenaReady()
    return arenaInvoke('storage', 'listCharacterWorkspaceFiles', () =>
      window.api.listCharacterWorkspaceFiles(characterId)
    )
  },

  async readWorkspaceFile(characterId: string, relativePath: string): Promise<string> {
    await ensureArenaReady()
    return arenaInvoke('storage', 'readCharacterWorkspaceFile', () =>
      window.api.readCharacterWorkspaceFile(characterId, relativePath)
    )
  },

  async writeWorkspaceFile(
    characterId: string,
    input: {
      relativePath?: string
      name: string
      content: string
      description?: string
      id?: string
    }
  ): Promise<CharacterWorkspaceFile> {
    await ensureArenaReady()
    const result = await arenaInvoke('storage', 'writeCharacterWorkspaceFile', () =>
      window.api.writeCharacterWorkspaceFile(characterId, input)
    )
    return result.file
  },

  async deleteWorkspaceFile(characterId: string, relativePath: string): Promise<CharacterWorkspaceFile[]> {
    await ensureArenaReady()
    return arenaInvoke('storage', 'deleteCharacterWorkspaceFile', () =>
      window.api.deleteCharacterWorkspaceFile(characterId, relativePath)
    )
  },

  async importWorkspaceFile(characterId: string): Promise<CharacterWorkspaceFile | null> {
    if (!window.api.openFileDialog) throw new Error('文件对话框不可用')
    const picked = await window.api.openFileDialog({
      filters: [
        { name: '文本文件', extensions: ['txt', 'md', 'json', 'csv', 'yaml', 'yml', 'log'] },
      ],
    })
    if (!picked?.success || !picked.path) return null
    await ensureArenaReady()
    const result = await arenaInvoke('storage', 'importCharacterWorkspaceFile', () =>
      window.api.importCharacterWorkspaceFile(characterId, picked.path)
    )
    return result.file
  },

  async openWorkspaceDir(characterId: string): Promise<void> {
    if (!window.api.openPath) throw new Error('无法打开系统目录')
    await ensureArenaReady()
    const dir = await arenaInvoke('storage', 'getCharacterWorkspaceDir', () =>
      window.api.getCharacterWorkspaceDir(characterId)
    )
    await window.api.openPath(dir)
  },

  async readWorkspaceExcerpts(characterId: string, maxChars = 4000) {
    await ensureArenaReady()
    return arenaInvoke('storage', 'readCharacterWorkspaceExcerpts', () =>
      window.api.readCharacterWorkspaceExcerpts(characterId, maxChars)
    )
  },

  buildWorkspaceToolsPrompt(characterId: string): Promise<string> {
    return this.listWorkspaceFiles(characterId).then((files) => buildWorkspaceToolsPrompt(files))
  },

  async executeWorkspaceTool(characterId: string, call: WorkspaceToolCall): Promise<WorkspaceToolResult> {
    try {
      if (call.action === 'list') {
        const files = await this.listWorkspaceFiles(characterId)
        const names = files.map((f) => f.name).join('、') || '无'
        return { action: 'list', ok: true, message: `文件：${names}` }
      }
      const path = call.path?.trim()
      if (!path) return { action: call.action, ok: false, message: '缺少 path' }

      if (call.action === 'read') {
        const content = await this.readWorkspaceFile(characterId, path)
        const preview = content.length > 800 ? content.slice(0, 800) + '…' : content
        return { action: 'read', ok: true, path, message: preview || '（空文件）' }
      }

      if (call.action === 'write') {
        await this.writeWorkspaceFile(characterId, { name: path, relativePath: path, content: call.content || '' })
        return { action: 'write', ok: true, path, message: `已写入 ${path}` }
      }

      if (call.action === 'append') {
        let existing = ''
        try {
          existing = await this.readWorkspaceFile(characterId, path)
        } catch {
          existing = ''
        }
        await this.writeWorkspaceFile(characterId, {
          name: path,
          relativePath: path,
          content: existing + (call.content || ''),
        })
        return { action: 'append', ok: true, path, message: `已追加 ${path}` }
      }

      return { action: call.action, ok: false, message: '未知操作' }
    } catch (err) {
      return { action: call.action, ok: false, path: call.path, message: (err as Error).message || '操作失败' }
    }
  },

  async executeWorkspaceTools(characterId: string, calls: WorkspaceToolCall[]): Promise<WorkspaceToolResult[]> {
    const results: WorkspaceToolResult[] = []
    for (const call of calls.slice(0, 3)) {
      results.push(await this.executeWorkspaceTool(characterId, call))
    }
    return results
  },

  async processWorkspaceToolsInReply(
    characterId: string,
    rawReply: string
  ): Promise<{ reply: string; toolNotes: string }> {
    const calls = parseWorkspaceToolCalls(rawReply)
    if (!calls.length) return { reply: rawReply.trim(), toolNotes: '' }
    const results = await this.executeWorkspaceTools(characterId, calls)
    const clean = stripWorkspaceToolBlocks(rawReply).trim()
    const toolNotes = formatWorkspaceToolResults(results)
    return { reply: clean, toolNotes }
  },

  async extractWorkspaceToolCalls(
    character: Character,
    userMessage: string,
    rawReply: string
  ): Promise<WorkspaceToolCall[]> {
    const res = await gatewayChatCompletion(character.modelId, [
      {
        role: 'system',
        content: [
          '你是文件空间操作提取器。根据用户请求与助手回复，输出需要执行的实际文件操作。',
          '只输出一个标签，不要其他文字：',
          '<workspace-tools>[{"action":"write","path":"notes.md","content":"完整正文"}]</workspace-tools>',
          '规则：',
          '- path 为文件名（如 notes.md）；write/append 必须带完整 content',
          '- 正文取自助手回复或用户指定内容，不要省略',
          '- 若用户只要求读取/list 且助手未执行写入，输出 <workspace-tools>[]</workspace-tools>',
        ].join('\n'),
      },
      { role: 'user', content: `用户：${userMessage}\n\n助手：${rawReply}` },
    ])
    return parseWorkspaceToolCalls(res.content || '')
  },

  async resolveWorkspaceToolsFromReply(
    character: Character,
    userMessage: string,
    rawReply: string
  ): Promise<{ reply: string; toolNotes: string; filesChanged: boolean }> {
    let calls = parseWorkspaceToolCalls(rawReply)

    if (!calls.length && hasWorkspaceFileIntent(userMessage)) {
      calls = await this.extractWorkspaceToolCalls(character, userMessage, rawReply).catch(() => [])
    }

    if (!calls.length && hasWorkspaceWriteIntent(userMessage)) {
      const inferred = inferWorkspaceWriteFromContext(userMessage, rawReply)
      if (inferred) calls = [inferred]
    }

    if (!calls.length) {
      return {
        reply: rawReply.trim(),
        toolNotes: hasWorkspaceWriteIntent(userMessage)
          ? '⚠ 未能写入文件空间（模型未输出 workspace-tools 标签）'
          : '',
        filesChanged: false,
      }
    }

    const results = await this.executeWorkspaceTools(character.id, calls)
    const clean = stripWorkspaceToolBlocks(rawReply).trim()
    let toolNotes = formatWorkspaceToolResults(results)
    const filesChanged = results.some(
      (r) => r.ok && (r.action === 'write' || r.action === 'append')
    )
    if (hasWorkspaceWriteIntent(userMessage) && !filesChanged) {
      const failHint = '⚠ 文件写入未成功，请重试或指定文件名'
      toolNotes = toolNotes ? `${toolNotes}\n${failHint}` : failHint
    }
    return { reply: clean, toolNotes, filesChanged }
  },
}
