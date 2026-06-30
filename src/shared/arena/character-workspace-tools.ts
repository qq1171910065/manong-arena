/** 智能体文件空间工具 — 参考 Claw 式 read/write/list 能力 */

import type { CharacterWorkspaceFile } from './character-agent'

export type WorkspaceToolAction = 'list' | 'read' | 'write' | 'append'

export interface WorkspaceToolCall {
  action: WorkspaceToolAction
  path?: string
  content?: string
}

export interface WorkspaceToolResult {
  action: WorkspaceToolAction
  ok: boolean
  path?: string
  message: string
}

const TOOL_BLOCK_RE = /<workspace-tools>([\s\S]*?)<\/workspace-tools>/gi

/** 用户消息是否涉及文件空间读写 */
export const WORKSPACE_FILE_INTENT_RE =
  /写入|保存|记下|写到|写进|写个文件|写文件|新建文件|创建.{0,8}文件|文件空间|存到|记录到|帮我写|添加到.{0,6}文件|更新.{0,6}文件|生成.{0,8}文件|放进文件|文件里/i

/** 用户消息是否要求写入（非仅读取） */
export const WORKSPACE_WRITE_INTENT_RE =
  /写入|保存|记下|写到|写进|写个文件|写文件|新建文件|创建.{0,8}文件|存到|记录到|帮我写|添加到.{0,6}文件|更新.{0,6}文件|生成.{0,8}文件|放进文件/i

export function hasWorkspaceFileIntent(userMessage: string): boolean {
  return WORKSPACE_FILE_INTENT_RE.test(userMessage)
}

export function hasWorkspaceWriteIntent(userMessage: string): boolean {
  return WORKSPACE_WRITE_INTENT_RE.test(userMessage)
}

export function buildWorkspaceFileIntentHint(userMessage: string): string {
  if (!hasWorkspaceFileIntent(userMessage)) return ''
  return [
    '【文件操作 — 必做】用户要求读写文件空间。',
    '口头回复可以很短，但必须在回复末尾附加 <workspace-tools>[...]</workspace-tools> 才会真正执行。',
    '禁止仅用文字声称已写入；没有 workspace-tools 标签则文件不会出现。',
    'write/append 的 content 字段放完整正文（可很长）；示例：',
    '<workspace-tools>[{"action":"write","path":"notes.md","content":"完整正文..."}]</workspace-tools>',
  ].join('\n')
}

export function buildWorkspaceToolsPrompt(files: CharacterWorkspaceFile[]): string {
  const listing =
    files.length > 0
      ? files.map((f) => `- ${f.name} (${f.relativePath}, ${Math.round(f.sizeBytes / 1024)}KB)`).join('\n')
      : '（暂无文件，可用 write 创建）'

  return [
    '【文件空间工具】',
    '你可读写角色专属文件空间。需要时使用以下格式（可单独一行，可放在回复末尾，用户不可见）：',
    '<workspace-tools>[{"action":"list"}]</workspace-tools>',
    '<workspace-tools>[{"action":"read","path":"notes.md"}]</workspace-tools>',
    '<workspace-tools>[{"action":"write","path":"notes.md","content":"..."}]</workspace-tools>',
    '<workspace-tools>[{"action":"append","path":"notes.md","content":"..."}]</workspace-tools>',
    '规则：path 只用文件名或相对路径；write/append 会覆盖或追加文本；先 read 再改；一次最多 3 个操作。',
    '当前文件：',
    listing,
  ].join('\n')
}

function parseToolRows(parsed: unknown): WorkspaceToolCall[] {
  const calls: WorkspaceToolCall[] = []
  const rows = Array.isArray(parsed) ? parsed : [parsed]
  for (const row of rows.slice(0, 3)) {
    if (!row || typeof row !== 'object') continue
    const item = row as Record<string, unknown>
    const action = String(item.action || '').trim() as WorkspaceToolAction
    if (!['list', 'read', 'write', 'append'].includes(action)) continue
    calls.push({
      action,
      path: item.path ? String(item.path).trim() : undefined,
      content: item.content != null ? String(item.content) : undefined,
    })
  }
  return calls
}

function looksLikeToolPayload(parsed: unknown): boolean {
  if (Array.isArray(parsed)) return parsed.some((row) => row && typeof row === 'object' && 'action' in (row as object))
  return Boolean(parsed && typeof parsed === 'object' && 'action' in (parsed as object))
}

function parseLooseToolObjects(raw: string): WorkspaceToolCall[] {
  const calls: WorkspaceToolCall[] = []
  const objectRe =
    /\{\s*"action"\s*:\s*"(list|read|write|append)"[\s\S]*?\}/gi
  for (const match of raw.matchAll(objectRe)) {
    const body = match[0]?.trim()
    if (!body) continue
    try {
      const parsed = JSON.parse(body) as unknown
      if (looksLikeToolPayload(parsed)) calls.push(...parseToolRows(parsed))
    } catch {
      const action = match[1] as WorkspaceToolAction
      const pathMatch = body.match(/"path"\s*:\s*"((?:\\.|[^"\\])*)"/)
      const contentMatch = body.match(/"content"\s*:\s*"((?:\\.|[^"\\])*)"/s)
      if (action === 'list' || pathMatch) {
        calls.push({
          action,
          path: pathMatch ? pathMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : undefined,
          content: contentMatch ? contentMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : undefined,
        })
      }
    }
  }
  return calls
}

export function extractFilePathFromMessage(text: string): string | null {
  const extMatch = text.match(/[`「『"' ]?([\w\u4e00-\u9fff\-_.]+\.(?:md|txt|json|csv|yaml|yml|log))[`」』"' ]?/i)
  if (extMatch) return extMatch[1]
  const namedMatch = text.match(/(?:文件名|名为|叫做|叫做|叫)[：:\s]+[`「『"' ]?([\w\u4e00-\u9fff\-_.]+)[`」』"' ]?/i)
  if (namedMatch) {
    const name = namedMatch[1]
    return name.includes('.') ? name : `${name}.md`
  }
  return null
}

function extractContentFromUserMessage(userMessage: string): string | null {
  const colonMatch = userMessage.match(/(?:内容[是为]?|如下|以下)[：:\n]\s*([\s\S]+)/i)
  if (colonMatch) return colonMatch[1].trim()
  const quotedMatch = userMessage.match(/[`「『"']([\s\S]+?)[`」』"']\s*(?:写入|保存|写到|写进|存到)/i)
  if (quotedMatch) return quotedMatch[1].trim()
  return null
}

function isWriteAcknowledgmentReply(reply: string): boolean {
  const text = reply.trim()
  if (text.length > 400) return false
  return (
    /^(好的|没问题|行|OK|ok|已经|我已|已完成|写好了|保存好了|存入|写入完成)/.test(text) ||
    /(已经|已)(写入|保存|存到|记录|放进)/.test(text)
  )
}

/** 模型未输出 workspace-tools 时，从对话上下文推断 write 操作 */
export function inferWorkspaceWriteFromContext(
  userMessage: string,
  rawReply: string
): WorkspaceToolCall | null {
  if (!hasWorkspaceWriteIntent(userMessage)) return null

  const path =
    extractFilePathFromMessage(userMessage) ||
    extractFilePathFromMessage(rawReply) ||
    `notes-${new Date().toISOString().slice(0, 10)}.md`

  const userContent = extractContentFromUserMessage(userMessage)
  const reply = stripWorkspaceToolBlocks(rawReply).trim()

  let content = userContent
  if (!content && reply && !isWriteAcknowledgmentReply(reply)) {
    content = reply
  }
  if (!content || content.length < 2) return null

  return { action: 'write', path, content }
}

export function parseWorkspaceToolCalls(raw: string): WorkspaceToolCall[] {
  const calls: WorkspaceToolCall[] = []
  const matches = [...raw.matchAll(TOOL_BLOCK_RE)]
  for (const match of matches) {
    const body = match[1]?.trim()
    if (!body) continue
    try {
      const parsed = JSON.parse(body) as unknown
      if (looksLikeToolPayload(parsed)) calls.push(...parseToolRows(parsed))
    } catch {
      calls.push(...parseLooseToolObjects(body))
    }
  }
  if (calls.length) return calls.slice(0, 3)

  const codeBlockRe = /```(?:json|workspace-tools)?\s*([\s\S]*?)```/gi
  for (const match of raw.matchAll(codeBlockRe)) {
    const body = match[1]?.trim()
    if (!body) continue
    try {
      const parsed = JSON.parse(body) as unknown
      if (looksLikeToolPayload(parsed)) calls.push(...parseToolRows(parsed))
    } catch {
      calls.push(...parseLooseToolObjects(body))
    }
  }

  if (calls.length) return calls.slice(0, 3)
  return parseLooseToolObjects(raw).slice(0, 3)
}

export function stripWorkspaceToolBlocks(raw: string): string {
  let text = raw.replace(TOOL_BLOCK_RE, '').trim()
  text = text
    .replace(/```(?:json|workspace-tools)?\s*[\s\S]*?"action"\s*:\s*"(?:list|read|write|append)"[\s\S]*?```/gi, '')
    .trim()
  return text
}

export function formatWorkspaceToolResults(results: WorkspaceToolResult[]): string {
  if (!results.length) return ''
  return results.map((r) => (r.ok ? `✓ ${r.message}` : `✗ ${r.message}`)).join('\n')
}
