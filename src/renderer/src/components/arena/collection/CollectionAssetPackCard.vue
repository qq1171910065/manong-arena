<script setup lang="ts">
import { computed } from 'vue'
import { Image, Layers3 } from 'lucide-vue-next'
import {
  assetPackInitials,
  assetPackTheme,
  resolveCollectionIconUrl,
} from '@renderer/data/collection-visual-assets'

const props = defineProps<{
  characterId: string
  label: string
  palette?: string
  previewBannerUrl?: string
  previewPortraitUrl?: string
  iconUrl?: string
}>()

const theme = computed(() => assetPackTheme(props.palette, props.characterId))
const resolvedIconUrl = computed(() => resolveCollectionIconUrl(props.iconUrl))
const previewUrl = computed(
  () => props.previewBannerUrl || props.previewPortraitUrl || resolvedIconUrl.value || ''
)
const initials = computed(() => assetPackInitials(props.label, props.characterId))
</script>

<template>
  <article
    class="pack-card"
    :style="{
      '--pack-accent': theme.accent,
      '--pack-muted': theme.muted,
      '--pack-ring': theme.ring,
      '--pack-gradient': theme.gradient,
    }"
  >
    <div class="pack-card__poster">
      <img v-if="previewUrl" :src="previewUrl" :alt="label" class="pack-card__img" />
      <div v-else class="pack-card__placeholder" aria-hidden="true">
        <span class="pack-card__initials">{{ initials }}</span>
        <Image :size="18" />
      </div>
      <span class="pack-card__badge">
        <Layers3 :size="12" />
        素材包
      </span>
    </div>

    <div class="pack-card__body">
      <strong>{{ label }}</strong>
      <p>{{ palette || characterId }}</p>
    </div>
  </article>
</template>

<style scoped>
.pack-card {
  display: grid;
  gap: 10px;
  padding: 10px;
  border-radius: 18px;
  background: #fff;
  border: 1px solid rgba(130, 142, 207, 0.16);
  box-shadow: 0 10px 24px rgba(91, 101, 174, 0.1);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.pack-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 28px rgba(91, 101, 174, 0.14);
}

.pack-card__poster {
  position: relative;
  aspect-ratio: 4 / 5;
  overflow: hidden;
  border-radius: 14px;
  background: var(--pack-gradient);
  border: 1px solid color-mix(in srgb, var(--pack-accent) 18%, #fff);
}

.pack-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pack-card__placeholder {
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 8px;
  width: 100%;
  height: 100%;
  color: var(--pack-accent);
}

.pack-card__initials {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, var(--pack-accent) 82%, #fff);
}

.pack-card__badge {
  position: absolute;
  top: 10px;
  left: 10px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  color: var(--pack-accent);
  font-size: 11px;
  font-weight: 600;
  backdrop-filter: blur(6px);
}

.pack-card__body {
  display: grid;
  gap: 4px;
  padding: 0 2px 2px;
}

.pack-card__body strong {
  color: #17205a;
  font-size: 15px;
  line-height: 1.3;
}

.pack-card__body p {
  margin: 0;
  color: #66709d;
  font-size: 12px;
  line-height: 1.4;
}
</style>
