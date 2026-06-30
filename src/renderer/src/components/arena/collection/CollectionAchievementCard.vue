<script setup lang="ts">
import { computed } from 'vue'
import { Lock, Trophy } from 'lucide-vue-next'
import {
  achievementGroupTheme,
  resolveCollectionIconUrl,
} from '@renderer/data/collection-visual-assets'

const props = defineProps<{
  id: string
  name: string
  description: string
  group: string
  unlocked: boolean
  iconUrl?: string
}>()

const theme = computed(() => achievementGroupTheme(props.group))
const resolvedIconUrl = computed(() => resolveCollectionIconUrl(props.iconUrl))
</script>

<template>
  <article
    class="ach-card"
    :class="{ 'ach-card--unlocked': unlocked }"
    :style="{
      '--ach-accent': theme.accent,
      '--ach-muted': theme.muted,
      '--ach-ring': theme.ring,
      '--ach-gradient': theme.gradient,
    }"
  >
    <div class="ach-card__medal" :class="{ 'ach-card__medal--locked': !unlocked }">
      <img v-if="resolvedIconUrl" :src="resolvedIconUrl" :alt="name" class="ach-card__icon-img" />
      <div v-else class="ach-card__icon-placeholder" aria-hidden="true">
        <Trophy :size="28" />
      </div>
      <span v-if="!unlocked" class="ach-card__lock" aria-hidden="true">
        <Lock :size="14" />
      </span>
    </div>

    <div class="ach-card__body">
      <strong>{{ name }}</strong>
      <p>{{ description }}</p>
      <em>{{ group }}</em>
    </div>
  </article>
</template>

<style scoped>
.ach-card {
  display: grid;
  gap: 12px;
  padding: 14px;
  border-radius: 18px;
  background: #fff;
  border: 1px solid rgba(130, 142, 207, 0.16);
  box-shadow: 0 8px 20px rgba(91, 101, 174, 0.08);
}

.ach-card--unlocked {
  border-color: var(--ach-ring);
  background: linear-gradient(180deg, color-mix(in srgb, var(--ach-accent) 6%, #fff), #fff 48%);
}

.ach-card__medal {
  position: relative;
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  margin: 0 auto;
  border-radius: 999px;
  background: var(--ach-gradient);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65), 0 10px 24px color-mix(in srgb, var(--ach-accent) 18%, transparent);
}

.ach-card__medal--locked {
  filter: grayscale(0.55);
  opacity: 0.82;
}

.ach-card__icon-placeholder {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.42);
  color: var(--ach-accent);
}

.ach-card__icon-img {
  width: 52px;
  height: 52px;
  object-fit: contain;
}

.ach-card__lock {
  position: absolute;
  right: -2px;
  bottom: -2px;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: #fff;
  border: 1px solid rgba(130, 142, 207, 0.2);
  color: #7380aa;
  box-shadow: 0 4px 10px rgba(91, 101, 174, 0.12);
}

.ach-card__body {
  display: grid;
  gap: 6px;
  text-align: center;
}

.ach-card strong {
  color: #17205a;
  font-size: 15px;
  line-height: 1.3;
}

.ach-card p {
  margin: 0;
  color: #66709d;
  font-size: 13px;
  line-height: 1.45;
}

.ach-card em {
  color: #9aa3c7;
  font-style: normal;
  font-size: 11px;
}
</style>
