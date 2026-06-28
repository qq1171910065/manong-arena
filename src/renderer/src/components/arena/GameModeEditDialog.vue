<script setup lang="ts">
import { ref, watch } from 'vue'
import { RotateCcw } from 'lucide-vue-next'
import DetailEditDialog from '@renderer/components/arena/DetailEditDialog.vue'
import { confirm } from '@renderer/composables/useAppDialog'
import {
  formatUserMessage,
  gameModeService,
  gameScenarioService,
  getBuiltinGameMode,
  loadGameModeOverrides,
  loadGameScenarios,
} from '@renderer/services/arena'
import type { GameMode, GameModeOverride } from '@shared/arena/types'
import { formatSpeechTermsText, parseSpeechTermsText, resolveSpeechDisplayConfig } from '@shared/arena/speech-display'

export type GameModeEditSection = 'basic' | 'players' | 'rules' | 'speech'

const show = defineModel<boolean>({ default: false })

const props = defineProps<{
  mode: GameMode
  section: GameModeEditSection
}>()

const emit = defineEmits<{
  saved: []
}>()

const saving = ref(false)
const error = ref('')

const name = ref('')
const subtitle = ref('')
const description = ref('')
const minPlayers = ref(6)
const maxPlayers = ref(18)
const recommendedPlayers = ref(10)
const estimatedCostPerPlayerCents = ref(180)
const estimatedDurationMinutes = ref(40)
const setupSummary = ref('')
const sheriffRule = ref('')
const ruleHighlightsText = ref('')
const highlightMentions = ref(true)
const speechTermsText = ref('')

const sectionMeta: Record<GameModeEditSection, { title: string; subtitle: string }> = {
  basic: { title: '编辑基础信息', subtitle: '玩法名称与描述' },
  players: { title: '编辑人数与费用', subtitle: '人数范围与预估成本' },
  rules: { title: '编辑规则文案', subtitle: '开局说明与规则要点' },
  speech: { title: '编辑发言展示', subtitle: '局内 @ 提及与术语高亮' },
}

function fillFromMode(source: Partial<GameModeOverride> & { name?: string }) {
  name.value = source.name || ''
  subtitle.value = source.subtitle || ''
  description.value = source.description || ''
  minPlayers.value = source.minPlayers ?? 6
  maxPlayers.value = source.maxPlayers ?? 18
  recommendedPlayers.value = source.recommendedPlayers ?? 10
  estimatedCostPerPlayerCents.value = source.estimatedCostPerPlayerCents ?? 180
  estimatedDurationMinutes.value = source.estimatedDurationMinutes ?? 40
  setupSummary.value = source.setupSummary || ''
  sheriffRule.value = source.sheriffRule || ''
  ruleHighlightsText.value = (source.ruleHighlights || []).join('\n')
  const resolvedSpeech = resolveSpeechDisplayConfig(props.mode.id, source.speechDisplay)
  highlightMentions.value = resolvedSpeech?.highlightMentions !== false
  speechTermsText.value = formatSpeechTermsText(resolvedSpeech?.terms || [])
}

async function loadDraft() {
  await loadGameModeOverrides()
  const mode = gameModeService.get(props.mode.id)
  if (mode) fillFromMode(mode)
}

function buildOverride(): GameModeOverride {
  const highlights = ruleHighlightsText.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  return {
    name: name.value.trim(),
    subtitle: subtitle.value.trim(),
    description: description.value.trim(),
    minPlayers: minPlayers.value,
    maxPlayers: maxPlayers.value,
    recommendedPlayers: recommendedPlayers.value,
    estimatedCostPerPlayerCents: estimatedCostPerPlayerCents.value,
    estimatedDurationMinutes: estimatedDurationMinutes.value,
    setupSummary: setupSummary.value.trim(),
    sheriffRule: sheriffRule.value.trim(),
    ruleHighlights: highlights,
    speechDisplay: {
      highlightMentions: highlightMentions.value,
      terms: parseSpeechTermsText(speechTermsText.value),
    },
  }
}

async function save() {
  if (!name.value.trim()) {
    error.value = '玩法名称不能为空'
    return
  }
  if (props.section === 'players' && minPlayers.value > maxPlayers.value) {
    error.value = '最少人数不能大于最多人数'
    return
  }
  saving.value = true
  error.value = ''
  try {
    await gameModeService.saveOverride(props.mode.id, buildOverride())
    show.value = false
    emit('saved')
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    saving.value = false
  }
}

async function resetToBuiltin() {
  const builtin = getBuiltinGameMode(props.mode.id)
  if (!builtin) return
  if (!(await confirm({
    title: '恢复默认配置',
    message: '确定恢复为内置默认配置吗？你的自定义修改将被清除。',
    tone: 'warning',
    confirmText: '恢复',
  }))) return
  saving.value = true
  error.value = ''
  try {
    await gameModeService.clearOverride(props.mode.id)
    await loadGameScenarios()
    const scenario = gameScenarioService.getByGameModeId(props.mode.id)
    if (scenario?.id) {
      await gameScenarioService.clearCustomScenario(scenario.id)
    }
    await loadDraft()
    show.value = false
    emit('saved')
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    saving.value = false
  }
}

watch(show, (open) => {
  if (open) {
    error.value = ''
    void loadDraft()
  }
}, { immediate: true })
</script>

<template>
  <DetailEditDialog
    v-model="show"
    :title="sectionMeta[section].title"
    :subtitle="sectionMeta[section].subtitle"
    :saving="saving"
    @save="save"
  >
    <p v-if="error" class="edit-error">{{ error }}</p>

    <template v-if="section === 'basic'">
      <label class="edit-field"><span>玩法名称</span><input v-model="name" class="field" maxlength="20" /></label>
      <label class="edit-field"><span>副标题</span><input v-model="subtitle" class="field" maxlength="36" /></label>
      <label class="edit-field"><span>玩法描述</span><textarea v-model="description" class="field field-tall" rows="4" /></label>
    </template>

    <template v-else-if="section === 'players'">
      <div class="edit-grid-3">
        <label class="edit-field"><span>最少人数</span><input v-model.number="minPlayers" class="field" type="number" min="2" max="30" /></label>
        <label class="edit-field"><span>最多人数</span><input v-model.number="maxPlayers" class="field" type="number" min="2" max="30" /></label>
        <label class="edit-field"><span>推荐人数</span><input v-model.number="recommendedPlayers" class="field" type="number" min="2" max="30" /></label>
      </div>
      <div class="edit-grid-2">
        <label class="edit-field"><span>每人预估费用（分）</span><input v-model.number="estimatedCostPerPlayerCents" class="field" type="number" min="1" /></label>
        <label class="edit-field"><span>预估时长（分钟）</span><input v-model.number="estimatedDurationMinutes" class="field" type="number" min="5" /></label>
      </div>
    </template>

    <template v-else-if="section === 'rules'">
      <label class="edit-field"><span>开局说明</span><textarea v-model="setupSummary" class="field field-tall" rows="4" /></label>
      <label class="edit-field"><span>警长规则</span><textarea v-model="sheriffRule" class="field field-tall" rows="3" /></label>
      <label class="edit-field"><span>规则要点（每行一条）</span><textarea v-model="ruleHighlightsText" class="field field-tall" rows="8" /></label>
    </template>

    <template v-else-if="section === 'speech'">
      <label class="edit-setting-row">
        <span>
          <strong>高亮 @ 提及</strong>
          <small>例如 @3号、@3号张三、@角色名</small>
        </span>
        <input v-model="highlightMentions" type="checkbox" />
      </label>
      <label class="edit-field">
        <span>术语高亮（每行一个，可选「术语|说明」）</span>
        <textarea
          v-model="speechTermsText"
          class="field field-tall"
          rows="12"
          placeholder="警长|拥有 1.5 票归票权&#10;刀口|狼人夜晚袭击目标"
        />
      </label>
      <p class="edit-hint">这些配置只影响局内公开频道的发言展示，不会修改 AI 输出内容。</p>
    </template>

    <template #footer-left>
      <button type="button" class="reset-btn" :disabled="saving" @click="resetToBuiltin">
        <RotateCcw :size="15" />
        恢复默认
      </button>
    </template>
  </DetailEditDialog>
</template>

<style scoped>
.edit-error {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(239, 68, 68, 0.08);
  color: #c2410c;
  font-size: 13px;
}

.edit-field {
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
}

.edit-field span {
  color: #6b759f;
  font-size: 12px;
}

.field {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(130, 142, 207, 0.2);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.8);
  color: #243066;
  font: inherit;
  font-size: 14px;
  box-sizing: border-box;
}

.field-tall {
  min-height: 96px;
  resize: vertical;
}

.edit-grid-2,
.edit-grid-3 {
  display: grid;
  gap: 12px;
  margin-bottom: 4px;
}

.edit-grid-2 {
  grid-template-columns: 1fr 1fr;
}

.edit-grid-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.reset-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid rgba(130, 142, 207, 0.15);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.58);
  color: #66709d;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.edit-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(130, 142, 207, 0.12);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.45);
}

.edit-setting-row strong {
  display: block;
  color: #26305e;
  font-size: 14px;
  font-weight: 600;
}

.edit-setting-row small {
  display: block;
  margin-top: 3px;
  color: #7280b2;
  font-size: 12px;
}

.edit-hint {
  margin: 0;
  color: #9aa3c7;
  font-size: 12px;
  line-height: 1.55;
}
</style>
