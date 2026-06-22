<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  source: string
}>()

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; html: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; lang: string; code: string }
  | { type: 'hr' }

function inline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
}

function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i += 1
      continue
    }

    if (/^---+$/.test(line.trim())) {
      blocks.push({ type: 'hr' })
      i += 1
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() })
      i += 1
      continue
    }

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i += 1
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i += 1
      }
      blocks.push({ type: 'code', lang, code: codeLines.join('\n') })
      i += 1
      continue
    }

    const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/)
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[2])
      const items: string[] = []
      while (i < lines.length) {
        const current = lines[i]
        const itemMatch = current.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/)
        if (!itemMatch) break
        items.push(inline(itemMatch[3].trim()))
        i += 1
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    const paragraphLines: string[] = [line]
    i += 1
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|[-*]|\d+\.|```|---)/.test(lines[i])) {
      paragraphLines.push(lines[i])
      i += 1
    }
    blocks.push({ type: 'paragraph', html: inline(paragraphLines.join(' ').trim()) })
  }

  return blocks
}

const blocks = computed(() => parseMarkdown(props.source))
</script>

<template>
  <article class="markdown-content">
    <template v-for="(block, index) in blocks" :key="index">
      <component
        :is="`h${block.type === 'heading' ? block.level : '2'}`"
        v-if="block.type === 'heading'"
        class="markdown-content__heading"
      >
        {{ block.text }}
      </component>
      <p v-else-if="block.type === 'paragraph'" class="markdown-content__paragraph" v-html="block.html" />
      <ul v-else-if="block.type === 'list' && !block.ordered" class="markdown-content__list">
        <li v-for="(item, itemIndex) in block.items" :key="itemIndex" v-html="item" />
      </ul>
      <ol v-else-if="block.type === 'list' && block.ordered" class="markdown-content__list">
        <li v-for="(item, itemIndex) in block.items" :key="itemIndex" v-html="item" />
      </ol>
      <pre v-else-if="block.type === 'code'" class="markdown-content__code"><code>{{ block.code }}</code></pre>
      <hr v-else-if="block.type === 'hr'" class="markdown-content__hr" />
    </template>
  </article>
</template>

<style scoped>
.markdown-content {
  color: var(--text-primary, #2a346b);
  font-size: 14px;
  line-height: 1.7;
}

.markdown-content__heading {
  margin: 18px 0 8px;
  color: #2a346b;
  font-weight: 650;
}

.markdown-content h1.markdown-content__heading {
  margin-top: 0;
  font-size: 22px;
}

.markdown-content h2.markdown-content__heading {
  font-size: 18px;
}

.markdown-content h3.markdown-content__heading {
  font-size: 15px;
}

.markdown-content__paragraph {
  margin: 0 0 10px;
  color: #556089;
}

.markdown-content__list {
  margin: 0 0 12px 18px;
  color: #556089;
}

.markdown-content__code {
  margin: 0 0 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(42, 52, 107, 0.06);
  overflow: auto;
  font-size: 12px;
}

.markdown-content__hr {
  margin: 16px 0;
  border: none;
  border-top: 1px solid rgba(130, 142, 207, 0.16);
}

.markdown-content :deep(code) {
  padding: 1px 6px;
  border-radius: 6px;
  background: rgba(42, 52, 107, 0.08);
  font-size: 12px;
}

.markdown-content :deep(a) {
  color: #625cf0;
  text-decoration: none;
}

.markdown-content :deep(a:hover) {
  text-decoration: underline;
}
</style>
