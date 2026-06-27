<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import CharacterStageSpeechBubble from '@renderer/components/arena/CharacterStageSpeechBubble.vue'
import { characterBannerUrl } from '@renderer/data/arena-visual-assets'
import { resolveModelInfo } from '@renderer/data/model-catalog'
import type { Character } from '@shared/arena/types'
import type { SpeechDisplayConfig } from '@shared/arena/speech-display'

withDefaults(
  defineProps<{
    character: Character
    selected?: boolean
    disabled?: boolean
    speaking?: boolean
    speechText?: string
    speechSide?: 'left' | 'right'
    speechConfig?: SpeechDisplayConfig | null
    speechParticipants?: Array<{ characterId: string; characterName: string; seatOrder: number }>
    compact?: boolean
  }>(),
  {
    selected: false,
    disabled: false,
    speaking: false,
    speechText: '',
    speechSide: 'right',
    speechConfig: null,
    speechParticipants: () => [],
    compact: true,
  }
)

defineEmits<{ click: [] }>()

function modelName(modelId: string): string {
  return resolveModelInfo(modelId).label
}

function matchLabel(char: Character): string {
  if (char.stats.matchCount <= 0) return '尚未参战'
  return `${char.stats.matchCount} 场对局`
}
</script>

<template>
  <article
    class="pick-card"
    :class="{
      'pick-card--selected': selected,
      'pick-card--disabled': disabled,
      'pick-card--speaking': speaking,
      'pick-card--compact': compact,
    }"
    :style="{ '--accent': character.accentColor }"
    @click="$emit('click')"
  >
    <CharacterStageSpeechBubble
      v-if="speaking && speechText"
      :text="speechText"
      :side="speechSide"
      :active="speaking"
      :speech-config="speechConfig"
      :participants="speechParticipants"
    />
    <div class="pick-card__banner">
      <img class="pick-card__banner-img" :src="characterBannerUrl(character)" :alt="character.name" />
      <span v-if="selected" class="pick-card__check" aria-hidden="true"><Check :size="14" /></span>
    </div>
    <div class="pick-card__body">
      <h3 class="pick-card__name">{{ character.name }}</h3>
      <p class="pick-card__subtitle">{{ character.subtitle || '未填写一句话设定' }}</p>
      <div v-if="character.tags.length || character.modelId" class="pick-card__tags">
        <span class="pick-card__tag pick-card__tag--model">{{ modelName(character.modelId) }}</span>
        <span v-for="tag in character.tags.slice(0, 2)" :key="tag" class="pick-card__tag">{{ tag }}</span>
      </div>
      <span class="pick-card__stat">{{ matchLabel(character) }}</span>
    </div>
  </article>
</template>

<style scoped>
.pick-card {
  --accent: #7568ff;
  --card-width: 248px;
  position: relative;
  width: var(--card-width);
  max-width: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(130, 142, 207, 0.16);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 10px 24px rgba(91, 101, 174, 0.1);
  cursor: pointer;
  transition: transform 0.24s ease, box-shadow 0.24s ease, border-color 0.24s ease;
}

.pick-card--compact {
  --card-width: 100%;
}

.pick-card:hover:not(.pick-card--disabled) {
  transform: translateY(-4px);
  border-color: color-mix(in srgb, var(--accent) 28%, rgba(130, 142, 207, 0.22));
  box-shadow: 0 16px 32px rgba(91, 101, 174, 0.14);
}

.pick-card--selected {
  border-color: color-mix(in srgb, var(--accent) 42%, rgba(126, 99, 255, 0.3));
  box-shadow:
    0 16px 32px rgba(91, 101, 174, 0.14),
    inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent);
}

.pick-card--speaking {
  z-index: 4;
}

.pick-card--disabled {
  opacity: 0.52;
  cursor: not-allowed;
}

.pick-card__banner {
  position: relative;
  width: 100%;
  aspect-ratio: 1280 / 720;
  overflow: hidden;
  background: #eef1f8;
}

.pick-card__banner-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center center;
  transition: transform 0.35s ease;
}

.pick-card:hover:not(.pick-card--disabled) .pick-card__banner-img {
  transform: scale(1.03);
}

.pick-card__check {
  position: absolute;
  right: 10px;
  top: 10px;
  z-index: 3;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  color: #fff;
  background: linear-gradient(135deg, #8d6bff, #5b58f7);
  box-shadow: 0 8px 18px rgba(88, 80, 239, 0.28);
}

.pick-card__body {
  display: grid;
  gap: 6px;
  padding: 12px 14px 14px;
}

.pick-card__name {
  margin: 0;
  overflow: hidden;
  color: #17205a;
  font-size: 15px;
  font-weight: 650;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pick-card__subtitle {
  margin: 0;
  overflow: hidden;
  color: #66709d;
  font-size: 12px;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pick-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
  margin-top: 2px;
}

.pick-card__tag {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  height: 24px;
  padding: 0 9px;
  overflow: hidden;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 560;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pick-card__tag--model {
  color: color-mix(in srgb, var(--accent) 78%, #26305e);
  background: color-mix(in srgb, var(--accent) 12%, white);
}

.pick-card__tag:not(.pick-card__tag--model) {
  color: #655df0;
  border: 1px solid rgba(109, 101, 255, 0.12);
  background: rgba(112, 105, 255, 0.08);
}

.pick-card__stat {
  margin-top: 2px;
  color: #9aa3c7;
  font-size: 11px;
  line-height: 1.3;
}
</style>
