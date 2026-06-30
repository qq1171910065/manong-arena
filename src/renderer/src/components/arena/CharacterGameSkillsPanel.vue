<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Loader2,
  ShieldOff,
} from 'lucide-vue-next'
import CharacterScenarioRecordPanel from './CharacterScenarioRecordPanel.vue'
import {
  characterLearningService,
  characterScenarioRecordService,
  characterService,
  formatUserMessage,
  gameScenarioService,
} from '@renderer/services/arena'
import type { Character } from '@shared/arena/types'
import type { CharacterScenarioRecordSummary } from '@shared/arena/character-scenario-record'
import { formatTimeLabel } from '@renderer/utils/id'

const props = defineProps<{
  character: Character
}>()

const emit = defineEmits<{
  updated: [Character]
}>()

const busyScenarioId = ref('')
const actionError = ref('')
const summaries = ref<CharacterScenarioRecordSummary[]>([])
const summariesLoading = ref(true)
const expandedScenarioId = ref('')

onMounted(() => void refreshSummaries())

async function refreshSummaries() {
  summariesLoading.value = true
  try {
    summaries.value = await characterScenarioRecordService.listSummaries(props.character)
  } finally {
    summariesLoading.value = false
  }
}

function toggleRecord(summary: CharacterScenarioRecordSummary) {
  expandedScenarioId.value =
    expandedScenarioId.value === summary.scenarioId ? '' : summary.scenarioId
}

async function runLearn(scenarioId: string) {
  busyScenarioId.value = scenarioId
  actionError.value = ''
  try {
    await characterLearningService.learn(props.character.id, scenarioId)
    const updated = await characterService.get(props.character.id)
    emit('updated', updated)
    await refreshSummaries()
  } catch (err) {
    actionError.value = formatUserMessage(err)
  } finally {
    busyScenarioId.value = ''
  }
}

async function runExam(scenarioId: string) {
  busyScenarioId.value = scenarioId
  actionError.value = ''
  try {
    await characterLearningService.exam(props.character.id, scenarioId)
    const updated = await characterService.get(props.character.id)
    emit('updated', updated)
    await refreshSummaries()
  } catch (err) {
    actionError.value = formatUserMessage(err)
  } finally {
    busyScenarioId.value = ''
  }
}

async function runBypass(scenarioId: string) {
  busyScenarioId.value = scenarioId
  actionError.value = ''
  try {
    await characterLearningService.bypassExam(props.character.id, scenarioId)
    const updated = await characterService.get(props.character.id)
    emit('updated', updated)
    await refreshSummaries()
  } catch (err) {
    actionError.value = formatUserMessage(err)
  } finally {
    busyScenarioId.value = ''
  }
}

function scenarioRequiresExam(scenarioId: string): boolean {
  return Boolean(gameScenarioService.get(scenarioId)?.requiresExam)
}

function learnLabel(summary: CharacterScenarioRecordSummary): string {
  return summary.learned ? '再次学习' : '开始学习'
}
</script>

<template>
  <section class="record-panel">
    <p v-if="actionError" class="record-panel__error">{{ actionError }}</p>
    <p v-if="summariesLoading" class="record-panel__loading">加载中…</p>

    <template v-else>
      <article
        v-for="summary in summaries"
        :key="summary.scenarioId"
        class="record-card"
        :class="{ 'record-card--expanded': expandedScenarioId === summary.scenarioId }"
      >
        <div class="record-card__main" @click="toggleRecord(summary)">
          <div>
            <strong>{{ summary.scenarioName }}</strong>
            <span class="record-card__paradigm">{{ summary.paradigmShortLabel }}范式</span>
          </div>
          <ChevronDown
            :size="18"
            class="record-card__arrow"
            :class="{ 'record-card__arrow--open': expandedScenarioId === summary.scenarioId }"
          />
        </div>

        <div class="record-card__stats">
          <span>演练 {{ summary.matchCount }} 次</span>
          <span v-if="summary.winCount">胜 {{ summary.winCount }}</span>
          <span v-if="summary.mvpCount">MVP {{ summary.mvpCount }}</span>
          <span>{{ summary.statusLabel }}</span>
          <span v-if="summary.lastMatchAt">最近 {{ formatTimeLabel(summary.lastMatchAt) }}</span>
        </div>

        <div class="record-card__actions" @click.stop>
          <button type="button" :disabled="busyScenarioId === summary.scenarioId" @click="runLearn(summary.scenarioId)">
            <Loader2 v-if="busyScenarioId === summary.scenarioId" :size="14" class="spin" />
            <BookOpen v-else :size="14" />
            {{ learnLabel(summary) }}
          </button>
          <button
            v-if="scenarioRequiresExam(summary.scenarioId)"
            type="button"
            :disabled="busyScenarioId === summary.scenarioId || !summary.learned || summary.examPassed || summary.examBypassed"
            @click="runExam(summary.scenarioId)"
          >
            <CheckCircle2 :size="14" />
            校验
          </button>
          <button
            v-if="scenarioRequiresExam(summary.scenarioId)"
            type="button"
            class="ghost"
            :disabled="busyScenarioId === summary.scenarioId || !summary.learned || summary.examPassed || summary.examBypassed"
            @click="runBypass(summary.scenarioId)"
          >
            <ShieldOff :size="14" />
            免考
          </button>
        </div>

        <CharacterScenarioRecordPanel
          v-if="expandedScenarioId === summary.scenarioId"
          :character="character"
          :scenario-id="summary.scenarioId"
          :scenario-name="summary.scenarioName"
        />
      </article>

      <p v-if="!summaries.length" class="record-panel__empty">暂无场景演练记录。</p>
    </template>
  </section>
</template>

<style scoped>
.record-panel__error {
  margin: 0 0 12px;
  color: #c2410c;
  font-size: 13px;
}

.record-panel__loading,
.record-panel__empty {
  margin: 0;
  color: #7a85b0;
  font-size: 13px;
}

.record-card {
  margin-top: 14px;
  padding: 14px 16px;
  border: 1px solid rgba(130, 142, 207, 0.14);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.52);
}

.record-card:first-child {
  margin-top: 0;
}

.record-card--expanded {
  border-color: rgba(91, 87, 243, 0.28);
  box-shadow: 0 8px 20px rgba(91, 87, 243, 0.08);
}

.record-card__main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
}

.record-card__main strong {
  display: block;
  color: #17205a;
  font-size: 15px;
}

.record-card__paradigm {
  display: inline-block;
  margin-top: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(112, 105, 255, 0.1);
  color: #5b57f3;
  font-size: 10px;
  font-weight: 650;
}

.record-card__arrow {
  flex: none;
  color: #9aa3c7;
  transition: transform 0.2s ease;
}

.record-card__arrow--open {
  transform: rotate(180deg);
  color: #5b57f3;
}

.record-card__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
  color: #7a85b0;
  font-size: 12px;
}

.record-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(130, 142, 207, 0.1);
}

.record-card__actions button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid rgba(130, 142, 207, 0.15);
  border-radius: 999px;
  background: #fff;
  color: #26305e;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.record-card__actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.record-card__actions .ghost {
  background: transparent;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
