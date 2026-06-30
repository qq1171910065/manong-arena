<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CharacterGrowthSnapshot } from '@shared/arena/types'
import { CHARACTER_ATTRIBUTE_LABELS, type CharacterAttributeId } from '@shared/arena/character-growth'
import { normalizeCharacterAttributes } from '@shared/arena/character-model-params'

const props = defineProps<{
  snapshots: CharacterGrowthSnapshot[]
}>()

type RangeKey = '7d' | '30d' | '90d'

const range = ref<RangeKey>('30d')
const metric = ref<CharacterAttributeId>('precision')

const rangeDays: Record<RangeKey, number> = { '7d': 7, '30d': 30, '90d': 90 }

const filtered = computed(() => {
  const days = rangeDays[range.value]
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return props.snapshots
    .filter((item) => new Date(item.createdAt).getTime() >= cutoff)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
})

const chartPoints = computed(() => {
  const items = filtered.value
  if (!items.length) return []
  const values = items.map((item) => normalizeCharacterAttributes(item.attributes)[metric.value])
  const min = Math.max(20, Math.min(...values) - 8)
  const max = Math.min(120, Math.max(...values) + 8)
  const span = Math.max(max - min, 1)
  const width = 320
  const height = 120
  return items.map((item, index) => {
    const x = items.length === 1 ? width / 2 : (index / (items.length - 1)) * width
    const attrs = normalizeCharacterAttributes(item.attributes)
    const y = height - ((attrs[metric.value] - min) / span) * (height - 12) - 6
    return { x, y, value: attrs[metric.value], date: item.createdAt }
  })
})

const latestValue = computed(() => {
  const points = chartPoints.value
  return points.length ? points[points.length - 1].value : null
})

const polyline = computed(() => chartPoints.value.map((p) => `${p.x},${p.y}`).join(' '))
const areaPath = computed(() => {
  const points = chartPoints.value
  if (!points.length) return ''
  const first = points[0]
  const last = points[points.length - 1]
  return `M ${first.x} 120 L ${points.map((p) => `${p.x} ${p.y}`).join(' L ')} L ${last.x} 120 Z`
})

const metricOptions = Object.entries(CHARACTER_ATTRIBUTE_LABELS) as Array<[CharacterAttributeId, string]>
</script>

<template>
  <div class="growth-chart">
    <header class="growth-chart__head">
      <div class="growth-chart__title">
        <strong>成长趋势</strong>
        <span v-if="latestValue !== null">当前 {{ latestValue }}</span>
      </div>
      <div class="growth-chart__tabs">
        <button
          v-for="key in (['7d', '30d', '90d'] as RangeKey[])"
          :key="key"
          type="button"
          :class="{ active: range === key }"
          @click="range = key"
        >
          {{ key === '7d' ? '7 天' : key === '30d' ? '30 天' : '90 天' }}
        </button>
      </div>
    </header>

    <div class="growth-chart__metric">
      <button
        v-for="[id, label] in metricOptions"
        :key="id"
        type="button"
        :class="{ active: metric === id }"
        @click="metric = id"
      >
        {{ label }}
      </button>
    </div>

    <div v-if="chartPoints.length" class="growth-chart__canvas">
      <svg viewBox="0 0 320 120" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="growthArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(123, 97, 255, 0.28)" />
            <stop offset="100%" stop-color="rgba(123, 97, 255, 0.02)" />
          </linearGradient>
        </defs>
        <path v-if="areaPath" :d="areaPath" fill="url(#growthArea)" />
        <polyline v-if="polyline" :points="polyline" fill="none" stroke="#7b61ff" stroke-width="2.5" stroke-linecap="round" />
        <circle
          v-for="(point, index) in chartPoints"
          :key="index"
          :cx="point.x"
          :cy="point.y"
          r="3.5"
          fill="#fff"
          stroke="#7b61ff"
          stroke-width="2"
        />
      </svg>
    </div>
    <p v-else class="growth-chart__empty">暂无趋势数据，完成对局后会自动记录。</p>
  </div>
</template>

<style scoped>
.growth-chart {
  display: grid;
  gap: 10px;
}

.growth-chart__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.growth-chart__title {
  display: grid;
  gap: 2px;
}

.growth-chart__title span {
  color: #9aa3c7;
  font-size: 11px;
}

.growth-chart__head strong {
  color: #17205a;
  font-size: 14px;
}

.growth-chart__tabs,
.growth-chart__metric {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.growth-chart__tabs button,
.growth-chart__metric button {
  border: 0;
  border-radius: 999px;
  padding: 4px 10px;
  background: rgba(130, 142, 207, 0.1);
  color: #66709d;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.growth-chart__tabs button.active,
.growth-chart__metric button.active {
  background: rgba(112, 105, 255, 0.14);
  color: #5b57f3;
  font-weight: 600;
}

.growth-chart__canvas {
  height: 140px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.45);
  padding: 10px;
}

.growth-chart__canvas svg {
  width: 100%;
  height: 100%;
}

.growth-chart__empty {
  margin: 0;
  padding: 16px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.42);
  color: #9aa3c7;
  font-size: 12px;
}
</style>
