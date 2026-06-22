import projectDocsRaw from '../data/project-docs.md?raw'

export interface HelpDocSection {
  id: string
  title: string
  content: string
}

export interface HelpAssistantReply {
  answer: string
  sectionTitle?: string
  suggestions: string[]
}

const STOP_WORDS = new Set([
  '的', '了', '吗', '呢', '吧', '和', '与', '在', '是', '我', '你', '怎么', '如何', '什么', '为什么', '请', '问',
])

function splitSections(markdown: string): HelpDocSection[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const sections: HelpDocSection[] = []
  let current: HelpDocSection | null = null
  let buffer: string[] = []

  function flush() {
    if (!current) return
    current.content = buffer.join('\n').trim()
    if (current.content) sections.push(current)
    buffer = []
  }

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)$/)
    if (heading) {
      flush()
      current = { id: heading[1].trim(), title: heading[1].trim(), content: '' }
      continue
    }
    if (current) buffer.push(line)
  }
  flush()

  if (!sections.length) {
    return [{ id: 'default', title: '使用说明', content: markdown.trim() }]
  }
  return sections
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s，。！？、；："'“”‘’（）()\[\]<>《》\-_/\\]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t))
}

function scoreSection(section: HelpDocSection, queryTokens: string[]): number {
  const hay = `${section.title}\n${section.content}`.toLowerCase()
  let score = 0
  for (const token of queryTokens) {
    if (section.title.toLowerCase().includes(token)) score += 4
    if (hay.includes(token)) score += 2
  }
  return score
}

function extractAnswer(section: HelpDocSection): string {
  const lines = section.content.split('\n').map((line) => line.trim()).filter(Boolean)
  const bullets = lines.filter((line) => /^[-*\d.]/.test(line))
  if (bullets.length) {
    return bullets.slice(0, 4).map((line) => line.replace(/^[-*\d.]+\s*/, '')).join('\n')
  }
  return lines.slice(0, 4).join('\n')
}

export const HELP_DOC_SECTIONS = splitSections(projectDocsRaw)

export function askHelpAssistant(question: string): HelpAssistantReply {
  const trimmed = question.trim()
  if (!trimmed) {
    return {
      answer: '你可以问我：如何调试模型、钱包充值、对局怎么开始、页面显示异常等。',
      suggestions: ['模型无法回复怎么办？', '如何充值？', '对局怎么创建？'],
    }
  }

  const tokens = tokenize(trimmed)
  const ranked = [...HELP_DOC_SECTIONS]
    .map((section) => ({ section, score: scoreSection(section, tokens) }))
    .sort((a, b) => b.score - a.score)

  const best = ranked[0]
  if (!best || best.score <= 0) {
    return {
      answer:
        '我在项目文档里没有找到完全匹配的内容。你可以换个说法，或前往「项目文档」查看完整说明。',
      suggestions: ['模型服务', '钱包充值', '角色与对局', '提交 Bug'],
    }
  }

  const suggestions = ranked
    .slice(1, 4)
    .map((item) => item.section.title)
    .filter(Boolean)

  return {
    answer: extractAnswer(best.section),
    sectionTitle: best.section.title,
    suggestions: suggestions.length ? suggestions : ['如何调试模型？', '余额异常怎么办？'],
  }
}
