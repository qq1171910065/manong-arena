<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import ArenaDialogShell from '@renderer/components/common/ArenaDialogShell.vue'
import { modeImageById } from '@renderer/data/arena-visual-assets'
import type { GameMode } from '@shared/arena/types'

defineProps<{
  modes: GameMode[]
  currentId: string
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ pick: [mode: GameMode] }>()

function choose(mode: GameMode) {
  emit('pick', mode)
  open.value = false
}
</script>

<template>
  <ArenaDialogShell v-model="open" title="切换对局模式" variant="preview" size="md">
    <p class="picker-intro">选择玩法</p>
    <div class="picker-body">
      <button
        v-for="item in modes"
        :key="item.id"
        type="button"
        class="mode-option"
        :class="{ active: item.id === currentId }"
        @click="choose(item)"
      >
        <img :src="modeImageById(item.id)" :alt="item.name" />
        <div>
          <b>{{ item.name }}</b>
          <em>{{ item.subtitle }}</em>
          <small>{{ item.minPlayers }}-{{ item.maxPlayers }} 人 · 约 {{ item.estimatedDurationMinutes }} 分钟</small>
        </div>
        <span v-if="item.id === currentId" class="picked"><Check :size="14" /></span>
      </button>
    </div>
  </ArenaDialogShell>
</template>

<style scoped>
.picker-intro {
  margin: 0 0 12px;
  color: #8077a5;
  font-size: 12px;
  font-weight: 650;
}

.picker-body {
  display: grid;
  gap: 10px;
}

.mode-option {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) 28px;
  gap: 12px;
  align-items: center;
  padding: 10px;
  border: 1px solid rgba(126, 99, 255, 0.1);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.54);
  text-align: left;
  cursor: pointer;
  transition: 180ms ease;
}

.mode-option:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.82);
}

.mode-option.active {
  border-color: rgba(126, 99, 255, 0.42);
  background: rgba(126, 99, 255, 0.08);
  box-shadow: inset 0 -3px 0 #7e63ff;
}

.mode-option img {
  width: 72px;
  height: 72px;
  border-radius: 16px;
  object-fit: cover;
}

.mode-option b {
  display: block;
  color: #1b1856;
  font-size: 15px;
}

.mode-option em {
  display: block;
  margin-top: 3px;
  color: #756d99;
  font-size: 12px;
  font-style: normal;
}

.mode-option small {
  display: block;
  margin-top: 5px;
  color: #8a82aa;
  font-size: 11px;
}

.picked {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  color: #fff;
  background: linear-gradient(135deg, #8d6bff, #5b58f7);
}
</style>
