<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { lineupService } from '@renderer/services/arena'
import type { Character, CharacterLineup, LineupGrowthRecord } from '@shared/arena/types'
import DetailFeedPreview from './DetailFeedPreview.vue'

const props = defineProps<{ character: Character }>()

const lineups = ref<CharacterLineup[]>([])
const records = ref<LineupGrowthRecord[]>([])
const loading = ref(true)

const previewItems = computed(() =>
  records.value.slice(0, 6).map((item) => {
    const lineup = lineups.value.find((entry) => entry.id === item.lineupId)
    return {
      id: item.id,
      label: item.won ? '胜' : '记录',
      title: lineup?.name || '阵容',
      text: `${item.gameModeName} · ${item.summary}`,
      time: new Date(item.createdAt).toLocaleString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    }
  })
)

const moreCount = computed(() => Math.max(0, records.value.length - previewItems.value.length))

onMounted(async () => {
  loading.value = true
  try {
    lineups.value = await lineupService.list()
    const related = lineups.value.filter((lineup) => lineup.characterIds.includes(props.character.id))
    const batches = await Promise.all(related.map((lineup) => lineupService.listGrowth(lineup.id)))
    records.value = batches
      .flat()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } catch {
    lineups.value = []
    records.value = []
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <DetailFeedPreview
    :items="previewItems"
    :more-count="moreCount"
    :loading="loading"
    :clamp="2"
  />
</template>
