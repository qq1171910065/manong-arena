<script setup lang="ts">
import { computed } from 'vue'
import {
  CHARACTER_ATTRIBUTE_LABELS,
  type CharacterAttributeId,
  type CharacterAttributes,
} from '@shared/arena/character-growth'

const props = withDefaults(
  defineProps<{
    attributes: CharacterAttributes
    compareAttributes?: CharacterAttributes | null
    compareLabel?: string
    deltas?: Partial<Record<CharacterAttributeId, number>>
    maxValue?: number
  }>(),
  {
    compareAttributes: null,
    compareLabel: '',
    deltas: () => ({}),
    maxValue: 120,
  }
)

const attributeIds = computed(() => Object.keys(CHARACTER_ATTRIBUTE_LABELS) as CharacterAttributeId[])

const hasCompare = computed(() => Boolean(props.compareAttributes))

const chart = computed(() => {
  const size = 220
  const center = size / 2
  const radius = 78
  const levels = 4
  const count = attributeIds.value.length
  const angleStep = (Math.PI * 2) / count
  const startAngle = -Math.PI / 2

  function polar(angle: number, ratio: number) {
    return {
      x: center + Math.cos(angle) * radius * ratio,
      y: center + Math.sin(angle) * radius * ratio,
    }
  }

  function verticesFor(attrs: CharacterAttributes) {
    return attributeIds.value.map((id, index) => {
      const angle = startAngle + index * angleStep
      const ratio = Math.min(1, attrs[id] / props.maxValue)
      return polar(angle, ratio)
    })
  }

  const gridPolygons = Array.from({ length: levels }, (_, levelIndex) => {
    const ratio = (levelIndex + 1) / levels
    const points = attributeIds.value
      .map((_, index) => {
        const angle = startAngle + index * angleStep
        const point = polar(angle, ratio)
        return `${point.x},${point.y}`
      })
      .join(' ')
    return points
  })

  const axes = attributeIds.value.map((id, index) => {
    const angle = startAngle + index * angleStep
    const end = polar(angle, 1)
    const labelPoint = polar(angle, 1.22)
    const compareValue = props.compareAttributes?.[id]
    const compareDelta =
      compareValue != null ? compareValue - props.attributes[id] : undefined
    return {
      id,
      label: CHARACTER_ATTRIBUTE_LABELS[id],
      value: props.attributes[id],
      compareValue,
      compareDelta,
      delta: props.deltas[id],
      x1: center,
      y1: center,
      x2: end.x,
      y2: end.y,
      labelX: labelPoint.x,
      labelY: labelPoint.y,
    }
  })

  const valueVertices = verticesFor(props.attributes)
  const valuePoints = valueVertices.map((point) => `${point.x},${point.y}`).join(' ')

  const compareVertices = props.compareAttributes ? verticesFor(props.compareAttributes) : []
  const comparePoints = compareVertices.length
    ? compareVertices.map((point) => `${point.x},${point.y}`).join(' ')
    : ''

  return { size, center, gridPolygons, axes, valuePoints, valueVertices, comparePoints, compareVertices }
})
</script>

<template>
  <div class="attr-radar">
    <div class="attr-radar__chart-wrap">
      <svg
        class="attr-radar__chart"
        :viewBox="`0 0 ${chart.size} ${chart.size}`"
        role="img"
        :aria-label="`${attributeIds.map((id) => CHARACTER_ATTRIBUTE_LABELS[id]).join('、')} 雷达图`"
      >
        <polygon
          v-for="(points, index) in chart.gridPolygons"
          :key="index"
          :points="points"
          class="attr-radar__grid"
        />
        <line
          v-for="axis in chart.axes"
          :key="axis.id"
          :x1="axis.x1"
          :y1="axis.y1"
          :x2="axis.x2"
          :y2="axis.y2"
          class="attr-radar__axis"
        />
        <polygon
          v-if="chart.comparePoints"
          :points="chart.comparePoints"
          class="attr-radar__compare"
        />
        <circle
          v-for="(point, index) in chart.compareVertices"
          :key="`compare-${index}`"
          :cx="point.x"
          :cy="point.y"
          r="3"
          class="attr-radar__compare-dot"
        />
        <polygon :points="chart.valuePoints" class="attr-radar__value" />
        <circle
          v-for="(point, index) in chart.valueVertices"
          :key="index"
          :cx="point.x"
          :cy="point.y"
          r="3.5"
          class="attr-radar__dot"
        />
        <text
          v-for="axis in chart.axes"
          :key="`${axis.id}-label`"
          :x="axis.labelX"
          :y="axis.labelY"
          class="attr-radar__label"
          text-anchor="middle"
          dominant-baseline="middle"
        >
          {{ axis.label }}
        </text>
      </svg>
      <p v-if="hasCompare && compareLabel" class="attr-radar__legend">
        <i class="attr-radar__legend-current" /> 当前
        <i class="attr-radar__legend-compare" /> {{ compareLabel }}
      </p>
    </div>

    <ul class="attr-radar__stats">
      <li v-for="axis in chart.axes" :key="axis.id">
        <span>{{ axis.label }}</span>
        <strong>{{ axis.value }}</strong>
        <em v-if="hasCompare && axis.compareDelta" class="up">+{{ axis.compareDelta }}</em>
        <em v-else-if="axis.delta" class="up">+{{ axis.delta }}</em>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.attr-radar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px 12px;
  align-items: center;
}

.attr-radar__chart-wrap {
  display: grid;
  gap: 6px;
  justify-items: center;
}

.attr-radar__chart {
  width: 100%;
  max-width: 220px;
}

.attr-radar__legend {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: #9aa3c7;
  font-size: 10px;
}

.attr-radar__legend i {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  margin-right: 4px;
  vertical-align: middle;
}

.attr-radar__legend-current {
  background: #7b61ff;
}

.attr-radar__legend-compare {
  background: transparent;
  border: 2px dashed rgba(245, 158, 11, 0.75);
}

.attr-radar__grid {
  fill: rgba(112, 105, 255, 0.03);
  stroke: rgba(130, 142, 207, 0.16);
  stroke-width: 1;
}

.attr-radar__axis {
  stroke: rgba(130, 142, 207, 0.18);
  stroke-width: 1;
}

.attr-radar__compare {
  fill: rgba(245, 158, 11, 0.08);
  stroke: rgba(245, 158, 11, 0.72);
  stroke-width: 1.5;
  stroke-dasharray: 5 4;
}

.attr-radar__compare-dot {
  fill: #fff;
  stroke: rgba(245, 158, 11, 0.85);
  stroke-width: 1.5;
}

.attr-radar__value {
  fill: rgba(123, 97, 255, 0.22);
  stroke: #7b61ff;
  stroke-width: 2;
}

.attr-radar__dot {
  fill: #7b61ff;
  stroke: #fff;
  stroke-width: 1.5;
}

.attr-radar__label {
  fill: #66709d;
  font-size: 11px;
}

.attr-radar__stats {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 6px;
  min-width: 92px;
}

.attr-radar__stats li {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 6px;
  align-items: baseline;
  font-size: 11px;
  color: #66709d;
}

.attr-radar__stats strong {
  color: #17205a;
  font-size: 13px;
}

.attr-radar__stats em {
  font-style: normal;
  font-weight: 600;
  font-size: 10px;
}

.attr-radar__stats em.up {
  color: #18a765;
}

@media (max-width: 980px) {
  .attr-radar {
    grid-template-columns: 1fr;
  }

  .attr-radar__stats {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    min-width: 0;
  }

  .attr-radar__stats li {
    grid-template-columns: 1fr;
    justify-items: center;
    text-align: center;
  }
}
</style>
