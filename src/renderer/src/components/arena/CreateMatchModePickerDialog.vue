<script setup lang="ts">
import { Check, X } from 'lucide-vue-next'
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
  <Teleport to="body">
    <div v-if="open" class="picker-backdrop" @click.self="open = false">
      <div class="picker-dialog" role="dialog" aria-modal="true" aria-label="选择玩法">
        <header class="picker-head">
          <div>
            <span>选择玩法</span>
            <h2>切换对局模式</h2>
          </div>
          <button type="button" class="close-btn" aria-label="关闭" @click="open = false"><X :size="18" /></button>
        </header>
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
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(22, 18, 52, 0.42);
  backdrop-filter: blur(8px);
}
.picker-dialog {
  width: min(520px, 100%);
  max-height: min(78vh, 640px);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  border-radius: 24px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.92), rgba(249, 247, 255, 0.88));
  border: 1px solid rgba(255, 255, 255, 0.82);
  box-shadow: 0 28px 64px rgba(84, 68, 160, 0.22);
}
.picker-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 18px 10px;
}
.picker-head span {
  color: #8077a5;
  font-size: 12px;
  font-weight: 650;
}
.picker-head h2 {
  margin: 5px 0 0;
  color: #151550;
  font-size: 22px;
}
.close-btn {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(126, 99, 255, 0.12);
  border-radius: 12px;
  color: #5e52d8;
  background: rgba(255, 255, 255, 0.62);
  cursor: pointer;
}
.picker-body {
  min-height: 0;
  overflow: auto;
  padding: 0 18px 18px;
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
