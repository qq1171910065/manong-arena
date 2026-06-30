<script setup lang="ts">
import { computed } from 'vue'
import { MessageSquareQuote, Tag } from 'lucide-vue-next'
import {
  personalityKindTheme,
  resolveCollectionIconUrl,
} from '@renderer/data/collection-visual-assets'

const props = defineProps<{
  id: string
  kind: 'tag' | 'speech-style'
  name: string
  description: string
  iconUrl?: string
}>()

const theme = computed(() => personalityKindTheme(props.kind))
const resolvedIconUrl = computed(() => resolveCollectionIconUrl(props.iconUrl))
const isTag = computed(() => props.kind === 'tag')
const kindLabel = computed(() => (isTag.value ? '性格标签' : '说话风格'))
</script>

<template>
  <article
    class="persona-card"
    :class="isTag ? 'persona-card--tag' : 'persona-card--style'"
    :style="{
      '--persona-accent': theme.accent,
      '--persona-muted': theme.muted,
      '--persona-ring': theme.ring,
      '--persona-gradient': theme.gradient,
    }"
  >
    <header class="persona-card__head">
      <div class="persona-card__orb">
        <img v-if="resolvedIconUrl" :src="resolvedIconUrl" :alt="name" class="persona-card__icon-img" />
        <Tag v-else-if="isTag" :size="20" />
        <MessageSquareQuote v-else :size="20" />
      </div>
      <div class="persona-card__title">
        <span class="persona-card__kind">{{ kindLabel }}</span>
        <strong>{{ name }}</strong>
        <p>{{ description }}</p>
      </div>
    </header>
  </article>
</template>

<style scoped>
.persona-card {
  display: grid;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 16px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--persona-accent) 5%, #fff), #fff 58%),
    #fff;
  border: 1px solid rgba(130, 142, 207, 0.16);
  box-shadow: 0 8px 20px rgba(91, 101, 174, 0.08);
}

.persona-card__head {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.persona-card__orb {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: var(--persona-gradient);
  color: var(--persona-accent);
  flex: none;
}

.persona-card__icon-img {
  width: 34px;
  height: 34px;
  object-fit: contain;
}

.persona-card__title {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.persona-card__kind {
  justify-self: start;
  padding: 2px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--persona-accent) 10%, #fff);
  color: var(--persona-accent);
  font-size: 10px;
  font-weight: 600;
}

.persona-card strong {
  color: #17205a;
  font-size: 14px;
  line-height: 1.3;
}

.persona-card p {
  margin: 0;
  color: #66709d;
  font-size: 12px;
  line-height: 1.45;
}
</style>
