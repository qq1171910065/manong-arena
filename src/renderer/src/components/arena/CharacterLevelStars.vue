<script setup lang="ts">
import { computed } from 'vue'
import { Star } from 'lucide-vue-next'
import { computeStarRating, resolveCharacterGrowth } from '@shared/arena/character-growth'
import type { Character } from '@shared/arena/types'

const props = withDefaults(
  defineProps<{
    character: Character
    variant?: 'default' | 'portrait'
  }>(),
  { variant: 'default' },
)

const growth = computed(() => resolveCharacterGrowth(props.character))
const starCount = computed(() => computeStarRating(growth.value.level))
</script>

<template>
  <div
    class="character-level-stars"
    :class="`character-level-stars--${variant}`"
    :aria-label="`${starCount} 星成熟度 · Lv.${growth.level}`"
  >
    <Star
      v-for="index in 7"
      :key="index"
      :size="variant === 'portrait' ? 11 : 10"
      :class="{ on: index <= starCount }"
    />
    <span>Lv.{{ growth.level }}</span>
  </div>
</template>

<style scoped>
.character-level-stars {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: rgba(130, 142, 207, 0.35);
}

.character-level-stars :deep(svg.on) {
  color: #e8b923;
  fill: rgba(232, 185, 35, 0.25);
}

.character-level-stars span {
  margin-left: 4px;
  color: #9aa3c7;
  font-size: 11px;
  font-weight: 650;
  line-height: 1;
}

.character-level-stars--portrait {
  margin-top: 4px;
  color: rgba(255, 255, 255, 0.28);
}

.character-level-stars--portrait :deep(svg.on) {
  color: #ffd86b;
  fill: rgba(255, 216, 107, 0.22);
}

.character-level-stars--portrait span {
  color: rgba(255, 255, 255, 0.82);
}
</style>
