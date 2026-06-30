<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  Loader2,
  ShieldOff,
} from 'lucide-vue-next'
import CharacterScenarioRecordDialog from './CharacterScenarioRecordDialog.vue'
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
const recordOpen = ref(false)
const recordScenarioId = ref('')
const recordScenarioName = ref('')

const learnedCount = computed(() => summaries.value.filter((s) => s.learned).length)

onMounted(() => void refreshSummaries())

async function refreshSummaries() {
  summariesLoading.value = true
  try {
    summaries.value = await characterScenarioRecordService.listSummaries(props.character)
  } finally {
    summariesLoading.value = false
  }
}

function openRecord(summary: CharacterScenarioRecordSummary) {
  recordScenarioId.value = summary.scenarioId
  recordScenarioName.value = summary.scenarioName
  recordOpen.value = true
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
    <header class="record-panel__head">
      <div>
        <h2><GraduationCap :size="18" /> 场景记录</h2>
        <p>
          各场景范式下的基础演练记录。点击卡片查看发挥详情、图表与经验教训。
          已掌握 {{ learnedCount }} / {{ summaries.length }} 种场景。
        </p>
      </div>
    </header>

    <p v-if="actionError" class="record-panel__error">{{ actionError }}</p>
    <p v-if="summariesLoading" class="record-panel__loading">正在整理场景记录…</p>

    <article
      v-for="summary in summaries"
      :key="summary.scenarioId"
      class="record-card"
      @click="openRecord(summary)"
    >
      <div class="record-card__main">
        <div>
          <strong>{{ summary.scenarioName }}</strong>
          <span class="record-card__paradigm">{{ summary.paradigmShortLabel }}范式</span>
        </div>
        <ChevronRight :size="18" class="record-card__arrow" />
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
    </article>

    <CharacterScenarioRecordDialog
      v-model="recordOpen"
      :character="character"
      :scenario-id="recordScenarioId"
      :scenario-name="recordScenarioName"
    />
  </section>
</template>

<style scoped>
.record-panel__head h2 {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 6px;
  font-size: 17px;
  color: #17205a;
}

.record-panel__head p {
  margin: 0;
  color: #66709d;
  font-size: 13px;
  line-height: 1.65;
}

.record-panel__error {
  margin: 12px 0 0;
  color: #c2410c;
  font-size: 13px;
}

.record-panel__loading {
  margin: 12px 0 0;
  color: #7a85b0;
  font-size: 13px;
}

.record-card {
  margin-top: 14px;
  padding: 14px 16px;
  border: 1px solid rgba(130, 142, 207, 0.14);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.52);
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.record-card:hover {
  border-color: rgba(91, 87, 243, 0.28);
  box-shadow: 0 8px 20px rgba(91, 87, 243, 0.08);
}

.record-card__main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
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
