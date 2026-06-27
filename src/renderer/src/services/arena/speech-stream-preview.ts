/** 从流式模型 buffer 中提取可展示的公开发言预览（支持纯文本与 JSON speech 字段） */

function extractJsonStringField(buffer: string, field: string): string {
  const key = '"' + field + '"'
  const idx = buffer.indexOf(key)
  if (idx < 0) return ''
  let i = idx + key.length
  while (i < buffer.length && /[\s:]/.test(buffer[i]!)) i++
  if (buffer[i] !== '"') return ''
  i++
  let out = ''
  while (i < buffer.length) {
    const ch = buffer[i]!
    if (ch === '\\') {
      const next = buffer[i + 1]
      if (next === 'n') out += '\n'
      else if (next === 't') out += '\t'
      else if (next === '"') out += '"'
      else if (next === '\\') out += '\\'
      else if (next) out += next
      i += 2
      continue
    }
    if (ch === '"') break
    out += ch
    i++
  }
  return out
}

function stripMarkdownFence(text: string): string {
  return text.replace(/^```(?:json|text)?\s*/i, '').replace(/```\s*$/i, '').trim()
}

function looksLikeJsonEnvelope(text: string): boolean {
  const trimmed = text.trimStart()
  return trimmed.startsWith('{') || trimmed.startsWith('```')
}

function extractPlainSpeechText(raw: string): string {
  let text = stripMarkdownFence(raw.trim())
  if (!text) return ''
  if (/^\s*\{/.test(text)) return ''
  return text
    .replace(/^["'""]+|["'""]+$/g, '')
    .replace(/^```(?:json|text)?\s*/i, '')
    .replace(/```$/i, '')
    .trim()
}

/** 检测流式输出是否为纯文本（非 JSON 包装） */
export function detectPlainTextStream(buffer: string): boolean | null {
  const trimmed = buffer.trimStart()
  if (!trimmed) return null
  if (trimmed.startsWith('```') || trimmed.startsWith('{')) return false
  return true
}

/** 从累积 buffer 提取当前可展示的 speech 片段 */
export function previewSpeechFromStreamBuffer(buffer: string, plainTextMode: boolean | null = null): string {
  if (!buffer) return ''

  const jsonSpeech = extractJsonStringField(buffer, 'speech')
  if (jsonSpeech) return jsonSpeech

  const mode = plainTextMode ?? detectPlainTextStream(buffer)
  if (mode === true) {
    return extractPlainSpeechText(buffer)
  }

  const unfenced = stripMarkdownFence(buffer.trim())
  if (looksLikeJsonEnvelope(unfenced)) {
    if (/"speech"\s*:\s*"/.test(buffer)) {
      return extractJsonStringField(buffer, 'speech')
    }
    return ''
  }

  return extractPlainSpeechText(buffer)
}
