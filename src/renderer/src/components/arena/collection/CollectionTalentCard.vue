<script setup lang="ts">
import { computed } from 'vue'
import { Sparkles } from 'lucide-vue-next'
import type { CharacterAttributeId } from '@shared/arena/character-growth'
import {
  resolveCollectionIconUrl,
  skillAttributeTheme,
} from '@renderer/data/collection-visual-assets'

const props = defineProps<{
  id: string
  name: string
  description: string
  triggerTiming: string
  triggerEffect: string
  matchEffect: string
  attributeId: CharacterAttributeId
  attributeLabel: string
  iconUrl?: string
}>()

const theme = computed(() => skillAttributeTheme(props.attributeId))
const resolvedIconUrl = computed(() => resolveCollectionIconUrl(props.iconUrl))
</script>

<template>
  <article
    class="talent-card"
    :style="{
      '--talent-accent': theme.accent,
      '--talent-muted': theme.muted,
      '--talent-gradient': theme.gradient,
    }"
  >
    <header class="talent-card__head">
      <div class="talent-card__orb">
        <img v-if="resolvedIconUrl" :src="resolvedIconUrl" :alt="name" class="talent-card__icon-img" />
        <Sparkles v-else :size="20" />
      </div>
      <div class="talent-card__title">
        <div class="talent-card__badges">
          <span class="talent-card__kind">天赋</span>
          <span class="talent-card__attr">{{ attributeLabel }}</span>
        </div>
        <strong>{{ name }}</strong>
        <em v-if="description">{{ description }}</em>
      </div>
    </header>

    <dl class="talent-card__meta">
      <div>
        <dt>时机</dt>
        <dd>{{ triggerTiming }}</dd>
      </div>
      <div>
        <dt>效果</dt>
        <dd>{{ triggerEffect }}</dd>
      </div>
      <div>
        <dt>对局</dt>
        <dd>{{ matchEffect }}</dd>
      </div>
    </dl>
  </article>
</template>

<style scoped>
.talent-card {
  display: grid;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 16px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--talent-accent) 5%, #fff), #fff 58%),
    #fff;
  border: 1px solid rgba(130, 142, 207, 0.16);
  box-shadow: 0 8px 20px rgba(91, 101, 174, 0.08);
}

.talent-card__head {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.talent-card__orb {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: var(--talent-gradient);
  color: var(--talent-accent);
  flex: none;
}

.talent-card__icon-img {
  width: 34px;
  height: 34px;
  object-fit: contain;
}

.talent-card__title {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.talent-card__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.talent-card__kind,
.talent-card__attr {
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
}

.talent-card__kind {
  background: rgba(112, 105, 255, 0.1);
  color: #6b66e8;
}

.talent-card__attr {
  background: color-mix(in srgb, var(--talent-accent) 10%, #fff);
  color: var(--talent-accent);
}

.talent-card strong {
  color: #17205a;
  font-size: 14px;
  line-height: 1.3;
}

.talent-card em {
  color: #9aa3c7;
  font-size: 11px;
  font-style: normal;
  line-height: 1.35;
}

.talent-card__meta {
  margin: 0;
  display: grid;
  gap: 6px;
}

.talent-card__meta div {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 6px;
  align-items: start;
}

.talent-card__meta dt {
  color: #9aa3c7;
  font-size: 11px;
  font-weight: 700;
}

.talent-card__meta dd {
  margin: 0;
  color: #59649b;
  font-size: 11px;
  line-height: 1.45;
}
</style>
