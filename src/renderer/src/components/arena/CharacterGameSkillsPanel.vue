<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  AlertTriangle,
  BookOpen,
  Brain,
  CheckCircle2,
  GraduationCap,
  Loader2,
  ShieldOff,
  Sparkles,
  Swords,
} from 'lucide-vue-next'
import { characterService, characterLearningService, formatUserMessage, gameScenarioService } from '@renderer/services/arena'
import type { Character, CharacterGameSkill, SkillLearningEntry } from '@shared/arena/types'

const props = defineProps<{
  character: Character
}>()

const emit = defineEmits<{
  updated: [Character]
}>()

const busyScenarioId = ref('')
const actionError = ref('')

const scenarios = computed(() => gameScenarioService.list().filter((s) => s.isAvailable && s.requiresLearning))

const learnedCount = computed(() => (props.character.gameSkills || []).filter((s) => s.learned).length)

function skillFor(scenarioId: string): CharacterGameSkill | undefined {
  return props.character.gameSkills?.find((s) => s.scenarioId === scenarioId)
}

function statusLabel(scenarioId: string): string {
  const skill = skillFor(scenarioId)
  const scenario = gameScenarioService.get(scenarioId)
  if (!skill?.learned) return '未学习'
  if (scenario?.requiresExam && !skill.examPassed && !skill.examBypassed) return '待考试'
  if (skill.examBypassed && !skill.examPassed) return '已免考'
  return '可带入局'
}

function learnLabel(scenarioId: string): string {
  return skillFor(scenarioId)?.learned ? '再次学习' : '开始学习'
}

function entrySourceLabel(entry: SkillLearningEntry): string {
  if (entry.source === 'post_match') return '赛后沉淀'
  if (entry.source === 'relearn') return '再次学习'
  return '初次学习'
}

function formatDate(value?: string | null): string {
  if (!value) return ''
  return new Date(value).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

async function runLearn(scenarioId: string) {
  busyScenarioId.value = scenarioId
  actionError.value = ''
  try {
    await characterLearningService.learn(props.character.id, scenarioId)
    emit('updated', await characterService.get(props.character.id))
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
    emit('updated', await characterService.get(props.character.id))
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
    emit('updated', await characterService.get(props.character.id))
  } catch (err) {
    actionError.value = formatUserMessage(err)
  } finally {
    busyScenarioId.value = ''
  }
}
</script>

<template>
  <section class="experience-panel">
    <header class="experience-panel__head">
      <div>
        <h2><GraduationCap :size="18" /> 玩法经验</h2>
        <p>
          每个玩法的理解、策略与误区会<strong>带入对局提示词</strong>，与角色人设叠加生效。
          已学会 {{ learnedCount }} / {{ scenarios.length }} 种玩法。
        </p>
      </div>
    </header>

    <p v-if="actionError" class="experience-panel__error">{{ actionError }}</p>

    <article v-for="scenario in scenarios" :key="scenario.id" class="experience-card">
      <div class="experience-card__head">
        <div>
          <strong>{{ scenario.name }}</strong>
          <span v-if="scenario.subtitle" class="experience-card__subtitle">{{ scenario.subtitle }}</span>
        </div>
        <span
          class="experience-card__status"
          :class="{ ready: statusLabel(scenario.id) === '可带入局' || statusLabel(scenario.id) === '已免考' }"
        >
          {{ statusLabel(scenario.id) }}
        </span>
      </div>

      <p v-if="!skillFor(scenario.id)?.learned" class="experience-card__empty">
        尚未学习此玩法。学习后会结合角色人设形成专属理解，并在开局时注入对局。
      </p>

      <template v-else>
        <div v-if="skillFor(scenario.id)?.learnedAt" class="experience-card__meta">
          <span>最近学习 {{ formatDate(skillFor(scenario.id)?.learnedAt) }}</span>
          <span v-if="skillFor(scenario.id)?.examPassedAt"> · 通过考试 {{ formatDate(skillFor(scenario.id)?.examPassedAt) }}</span>
        </div>

        <section v-if="skillFor(scenario.id)?.mentalModel || skillFor(scenario.id)?.initialUnderstanding" class="experience-block">
          <h3><Brain :size="14" /> 心智模型</h3>
          <p>{{ skillFor(scenario.id)?.mentalModel || skillFor(scenario.id)?.initialUnderstanding }}</p>
        </section>

        <section v-if="skillFor(scenario.id)?.initialStrategy" class="experience-block">
          <h3><Swords :size="14" /> 实战策略倾向</h3>
          <p>{{ skillFor(scenario.id)?.initialStrategy }}</p>
        </section>

        <section v-if="skillFor(scenario.id)?.hypotheses?.length" class="experience-block">
          <h3><Sparkles :size="14" /> 入局前假设</h3>
          <ul>
            <li v-for="(item, index) in skillFor(scenario.id)!.hypotheses" :key="index">{{ item }}</li>
          </ul>
        </section>

        <div v-if="skillFor(scenario.id)?.edgeCases?.length || skillFor(scenario.id)?.commonMistakes?.length" class="experience-card__tags">
          <div v-if="skillFor(scenario.id)?.edgeCases?.length">
            <em>易错边界</em>
            <span v-for="(item, index) in skillFor(scenario.id)!.edgeCases" :key="'edge-' + index">{{ item }}</span>
          </div>
          <div v-if="skillFor(scenario.id)?.commonMistakes?.length">
            <em>常见误区</em>
            <span v-for="(item, index) in skillFor(scenario.id)!.commonMistakes" :key="'mistake-' + index">{{ item }}</span>
          </div>
        </div>

        <section v-if="skillFor(scenario.id)?.learningLog?.length" class="experience-block">
          <h3><BookOpen :size="14" /> 经验沉淀</h3>
          <ul class="learning-log">
            <li v-for="entry in skillFor(scenario.id)!.learningLog" :key="entry.id">
              <span class="learning-log__source">{{ entrySourceLabel(entry) }}</span>
              <strong>{{ entry.summary }}</strong>
              <p v-if="entry.understanding">{{ entry.understanding }}</p>
            </li>
          </ul>
        </section>

        <p v-if="skillFor(scenario.id)?.notes" class="experience-card__notes">
          <AlertTriangle :size="13" />
          {{ skillFor(scenario.id)?.notes }}
        </p>
      </template>

      <div class="experience-card__actions">
        <button type="button" :disabled="busyScenarioId === scenario.id" @click="runLearn(scenario.id)">
          <Loader2 v-if="busyScenarioId === scenario.id" :size="14" class="spin" />
          <BookOpen v-else :size="14" />
          {{ learnLabel(scenario.id) }}
        </button>
        <button
          v-if="scenario.requiresExam"
          type="button"
          :disabled="busyScenarioId === scenario.id || !skillFor(scenario.id)?.learned || skillFor(scenario.id)?.examPassed || skillFor(scenario.id)?.examBypassed"
          @click="runExam(scenario.id)"
        >
          <CheckCircle2 :size="14" />
          考试
        </button>
        <button
          v-if="scenario.requiresExam"
          type="button"
          class="ghost"
          :disabled="busyScenarioId === scenario.id || !skillFor(scenario.id)?.learned || skillFor(scenario.id)?.examPassed || skillFor(scenario.id)?.examBypassed"
          @click="runBypass(scenario.id)"
        >
          <ShieldOff :size="14" />
          免考
        </button>
      </div>
    </article>
  </section>
</template>

<style scoped>
.experience-panel__head h2 {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 6px;
  font-size: 17px;
  color: #17205a;
}

.experience-panel__head p {
  margin: 0;
  color: #66709d;
  font-size: 13px;
  line-height: 1.65;
}

.experience-panel__head strong {
  color: #5b57f3;
  font-weight: 650;
}

.experience-panel__error {
  margin: 12px 0 0;
  color: #c2410c;
  font-size: 13px;
}

.experience-card {
  margin-top: 14px;
  padding: 14px 16px;
  border: 1px solid rgba(130, 142, 207, 0.14);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.52);
}

.experience-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.experience-card__head strong {
  display: block;
  color: #17205a;
  font-size: 15px;
}

.experience-card__subtitle {
  display: block;
  margin-top: 4px;
  color: #7a85b0;
  font-size: 12px;
}

.experience-card__status {
  flex: none;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(251, 146, 60, 0.12);
  color: #c2410c;
  font-size: 11px;
  font-weight: 600;
}

.experience-card__status.ready {
  background: rgba(36, 169, 103, 0.12);
  color: #1a9a62;
}

.experience-card__empty {
  margin: 12px 0 0;
  color: #7a85b0;
  font-size: 13px;
  line-height: 1.65;
}

.experience-card__meta {
  margin-top: 10px;
  color: #9aa3c7;
  font-size: 11px;
}

.experience-block {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.58);
}

.experience-block h3 {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 8px;
  color: #17205a;
  font-size: 13px;
  font-weight: 650;
}

.experience-block p {
  margin: 0;
  color: #59649b;
  font-size: 13px;
  line-height: 1.7;
}

.experience-block ul {
  margin: 0;
  padding-left: 18px;
  color: #59649b;
  font-size: 13px;
  line-height: 1.65;
}

.experience-card__tags {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.experience-card__tags div {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.experience-card__tags em {
  margin-right: 2px;
  color: #66709d;
  font-style: normal;
  font-size: 11px;
  font-weight: 650;
}

.experience-card__tags span {
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(130, 142, 207, 0.1);
  color: #59649b;
  font-size: 11px;
  line-height: 1.4;
}

.learning-log {
  margin: 0;
  padding: 0;
  list-style: none;
}

.learning-log li {
  padding: 8px 0;
  border-top: 1px solid rgba(130, 142, 207, 0.1);
}

.learning-log li:first-child {
  padding-top: 0;
  border-top: 0;
}

.learning-log__source {
  display: inline-block;
  margin-right: 6px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(112, 105, 255, 0.1);
  color: #5b57f3;
  font-size: 10px;
  font-weight: 600;
}

.learning-log strong {
  display: block;
  margin-top: 4px;
  color: #17205a;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.55;
}

.learning-log p {
  margin: 4px 0 0;
  color: #7a85b0;
  font-size: 12px;
  line-height: 1.6;
}

.experience-card__notes {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 12px 0 0;
  color: #9a7b2e;
  font-size: 12px;
  line-height: 1.55;
}

.experience-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid rgba(130, 142, 207, 0.1);
}

.experience-card__actions button {
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

.experience-card__actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.experience-card__actions .ghost {
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
