<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { File, FileText, Folder, ImageOff } from 'lucide-vue-next'
import type { DevAssetsEntry } from '@shared/arena/dev-assets-types'

const props = defineProps<{
  entry: DevAssetsEntry
}>()

const emit = defineEmits<{
  open: [entry: DevAssetsEntry]
  reveal: [entry: DevAssetsEntry]
}>()

const previewUrl = ref<string | null>(null)
const previewFailed = ref(false)

const imageExt = /\.(png|jpe?g|webp|gif)$/i

const isDirectory = computed(() => props.entry.kind === 'directory')
const isImage = computed(() => props.entry.kind === 'file' && imageExt.test(props.entry.name))

async function loadPreview() {
  if (!isImage.value) return
  try {
    const res = await window.api.previewDevAsset(props.entry.relativePath)
    if (res.ok && res.dataUrl) previewUrl.value = res.dataUrl
    else previewFailed.value = true
  } catch {
    previewFailed.value = true
  }
}

watch(
  () => props.entry.relativePath,
  () => {
    previewUrl.value = null
    previewFailed.value = false
    void loadPreview()
  },
  { immediate: true }
)

function onClick() {
  if (isDirectory.value) emit('open', props.entry)
  else emit('reveal', props.entry)
}
</script>

<template>
  <button type="button" class="dev-asset-tile" :class="{ 'is-dir': isDirectory }" @click="onClick">
    <div class="dev-asset-tile__icon-area">
      <img v-if="previewUrl" :src="previewUrl" :alt="entry.name" class="dev-asset-tile__img" />
      <Folder v-else-if="isDirectory" class="dev-asset-tile__glyph" :size="40" stroke-width="1.5" />
      <FileText v-else-if="entry.isReadme" class="dev-asset-tile__glyph" :size="36" stroke-width="1.5" />
      <ImageOff v-else-if="isImage && previewFailed" class="dev-asset-tile__glyph" :size="36" stroke-width="1.5" />
      <File v-else class="dev-asset-tile__glyph" :size="36" stroke-width="1.5" />
    </div>
    <span class="dev-asset-tile__label" :title="entry.name">{{ entry.name }}</span>
  </button>
</template>

<style scoped>
.dev-asset-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 76px;
  padding: 6px 4px 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  text-align: center;
  transition: background 0.12s ease;
}

.dev-asset-tile:hover {
  background: rgba(92, 87, 239, 0.1);
}

.dev-asset-tile:active {
  background: rgba(92, 87, 239, 0.16);
}

.dev-asset-tile__icon-area {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  flex: 0 0 48px;
  color: #5c57ef;
}

.dev-asset-tile.is-dir .dev-asset-tile__icon-area {
  color: #f0b429;
}

.dev-asset-tile__glyph {
  flex: 0 0 auto;
  filter: drop-shadow(0 1px 2px rgba(40, 48, 100, 0.12));
}

.dev-asset-tile__img {
  display: block;
  max-width: 48px;
  max-height: 48px;
  width: auto;
  height: auto;
  object-fit: contain;
  filter: drop-shadow(0 1px 2px rgba(40, 48, 100, 0.15));
}

.dev-asset-tile__label {
  width: 100%;
  font-size: 12px;
  line-height: 1.25;
  font-weight: 400;
  color: #273060;
  word-break: break-all;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
