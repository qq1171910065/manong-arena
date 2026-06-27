<script setup lang="ts">
import { computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import type { ECBasicOption } from 'echarts/types/dist/shared'
import { mergeChartTheme } from './chart-theme'

use([
  CanvasRenderer,
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
])

const props = withDefaults(
  defineProps<{
    option: ECBasicOption
    height?: string
    loading?: boolean
  }>(),
  {
    height: '280px',
    loading: false,
  }
)

const themedOption = computed(() => mergeChartTheme(props.option))

const chartStyle = computed(() => ({
  height: props.height,
  width: '100%',
}))
</script>

<template>
  <VChart
    class="mntools-chart"
    :option="themedOption"
    :style="chartStyle"
    autoresize
    :loading="loading"
  />
</template>

<style scoped>
.mntools-chart {
  min-height: 160px;
}
</style>
