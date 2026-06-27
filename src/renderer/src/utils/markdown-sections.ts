export interface MarkdownSection {
  id: string
  title: string
  body: string
}

function slugify(title: string): string {
  const base = title
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fff-]/g, '')
    .toLowerCase()
  return base || 'section'
}

/** 依 ## 標題切分 Markdown，保留文檔前言 */
export function splitMarkdownByH2(source: string): { preamble: string; sections: MarkdownSection[] } {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const preamble: string[] = []
  const sections: MarkdownSection[] = []
  let currentTitle = ''
  let currentBody: string[] = []
  let inSection = false
  const usedIds = new Set<string>()

  function pushSection() {
    if (!currentTitle) return
    let id = slugify(currentTitle)
    if (usedIds.has(id)) {
      id = `${id}-${sections.length + 1}`
    }
    usedIds.add(id)
    sections.push({ id, title: currentTitle, body: currentBody.join('\n').trim() })
  }

  for (const line of lines) {
    const h2 = line.match(/^## (.+)$/)
    if (h2) {
      if (inSection) pushSection()
      inSection = true
      currentTitle = h2[1].trim()
      currentBody = []
    } else if (!inSection) {
      preamble.push(line)
    } else {
      currentBody.push(line)
    }
  }
  if (inSection) pushSection()

  return { preamble: preamble.join('\n').trim(), sections }
}
