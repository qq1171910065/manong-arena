<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { AlertCircle, ChevronDown, Info, Loader2, Lock, Play, Sparkles, Users, X } from 'lucide-vue-next'
import ArenaPageShell from '@renderer/components/arena/ArenaPageShell.vue'
import ArenaPageState from '@renderer/components/arena/ArenaPageState.vue'
import CharacterPickCard from '@renderer/components/arena/CharacterPickCard.vue'
import CreateMatchModeInfoDialog from '@renderer/components/arena/CreateMatchModeInfoDialog.vue'
import CreateMatchModePickerDialog from '@renderer/components/arena/CreateMatchModePickerDialog.vue'
import CreateMatchDlcPickerDialog from '@renderer/components/arena/CreateMatchDlcPickerDialog.vue'
import { modeImageById } from '@renderer/data/arena-visual-assets'
import {
  buildWerewolfRolePlanWithExpansions,
  defaultWerewolfExpansionsForCount,
  normalizeWerewolfExpansions,
  normalizeWerewolfRuleModules,
  WEREWOLF_EXPANSION_ROLES,
  type WerewolfExpansionRoleId,
  type WerewolfRuleModuleId,
} from '@shared/arena/werewolf-dlc'
import {
  DEFAULT_WEREWOLF_WIN_CONDITION,
  werewolfWinConditionDesc,
  type WerewolfWinCondition,
} from '@shared/arena/werewolf-win-condition'
import { navigate, route } from '../router'
import { confirm } from '@renderer/composables/useAppDialog'
import {
  arenaSession,
  billingService,
  canJoinScenario,
  characterService,
  formatUserMessage,
  gameModeService,
  gameScenarioService,
  isModePlayable,
  matchService,
  matchCostEstimator,
  matchWindowService,
  playArenaTone,
  settingsService,
  getFallbackModelId,
} from '@renderer/services/arena'
import { formatYuan } from '@renderer/utils/id'
import { resolveSpeechDisplayConfig } from '@shared/arena/speech-display'
import { ROUNDTABLE_TOPIC_PRESETS } from '@shared/arena/social-paradigm'
import { isBrainstormGameModeId } from '@shared/arena/builtin-game-mode-registry'
import type { Character, GameMode, IdentityAssignMode } from '@shared/arena/types'
import type { MatchCostEstimate } from '@renderer/services/arena/match-cost-estimator'

type SelectableCharacter = Character & { selected: boolean }
type RoleGroupTone = 'wolf' | 'god' | 'good'
interface RoleGroupItem {
  name: string
  count: number
  roleId: string
}
interface RoleGroup {
  label: string
  tone: RoleGroupTone
  items: RoleGroupItem[]
}

const WEREWOLF_COUNT_MIN = 6
const WEREWOLF_COUNT_MAX = 16

const playableModes = gameModeService.list().filter((m) => isModePlayable(m))
const defaultMode = gameModeService.get('werewolf') || playableModes[0]
const mode = ref<GameMode>(defaultMode)
const targetPlayerCount = ref(defaultMode.recommendedPlayers)
const enabledExpansions = ref<WerewolfExpansionRoleId[]>(
  defaultWerewolfExpansionsForCount(defaultMode.recommendedPlayers)
)
const enabledRuleModules = ref<WerewolfRuleModuleId[]>([])
const sheriffEnabled = ref(true)
const winCondition = ref<WerewolfWinCondition>(DEFAULT_WEREWOLF_WIN_CONDITION)
const discussionTopic = ref<string>(ROUNDTABLE_TOPIC_PRESETS[0])
const designTarget = ref('')
const roundtableRounds = ref(3)
const isBrainstormMode = computed(() => isBrainstormGameModeId(mode.value.id))
const showModeInfo = ref(false)
const showModePicker = ref(false)
const showDlcPicker = ref(false)
const settings = ref(settingsService.defaults())
const characters = ref<SelectableCharacter[]>([])
const identityMode = ref<IdentityAssignMode>('random')
const manualRoles = ref<Record<string, string>>({})
const loading = ref(true)
const starting = ref(false)
const error = ref('')
const activeSpeech = ref<{ charId: string; text: string; side: 'left' | 'right' } | null>(null)
const costEstimate = ref<MatchCostEstimate>({
  totalCents: 0,
  perPlayerCents: 0,
  sampleCount: 0,
  source: 'default',
})
const costEstimateLoading = ref(false)
let costEstimateTimer: ReturnType<typeof setTimeout> | null = null

const selectedCharacters = computed(() => characters.value.filter((item) => item.selected))
const selectedCount = computed(() => selectedCharacters.value.length)
const speechDisplayConfig = computed(() => resolveSpeechDisplayConfig(mode.value.id, mode.value.speechDisplay))
const speechPreviewParticipants = computed(() => {
  const pool = selectedCharacters.value.length
    ? selectedCharacters.value
    : characters.value.slice(0, targetPlayerCount.value)
  return pool.map((char, index) => ({
    characterId: char.id,
    characterName: char.name,
    seatOrder: index + 1,
  }))
})
const playerCountMin = computed(() => (isWerewolf.value ? WEREWOLF_COUNT_MIN : mode.value.minPlayers))
const playerCountMax = computed(() => (isWerewolf.value ? WEREWOLF_COUNT_MAX : mode.value.maxPlayers))
const slotsRemaining = computed(() => Math.max(0, targetPlayerCount.value - selectedCount.value))
const slotsOver = computed(() => Math.max(0, selectedCount.value - targetPlayerCount.value))
const canStart = computed(
  () =>
    selectedCount.value === targetPlayerCount.value &&
    targetPlayerCount.value >= playerCountMin.value &&
    targetPlayerCount.value <= playerCountMax.value &&
    !starting.value
)
const launchHeadline = computed(() => {
  if (starting.value) return '正在启动'
  if (canStart.value) return '可以开始'
  return '配置未完成'
})
const estimatedCost = computed(() => costEstimate.value.totalCents)
const costSourceLabel = computed(() => {
  if (costEstimateLoading.value) return '正在估算…'
  if (costEstimate.value.source === 'pricing') return '按所选模型单价估算'
  if (costEstimate.value.source === 'history') return `基于 ${costEstimate.value.sampleCount} 场历史`
  return '默认估算'
})
const selectedExpansionRoles = computed(() =>
  WEREWOLF_EXPANSION_ROLES.filter((role) => enabledExpansions.value.includes(role.id))
)

const isWerewolf = computed(() => mode.value.id === 'werewolf' || mode.value.engineKind === 'werewolf')
const isRoundtable = computed(() => mode.value.id === 'roundtable' || mode.value.engineKind === 'roundtable')
const isRoundtableFamily = computed(
  () => isRoundtable.value || mode.value.engineKind === 'brainstorm' || isBrainstormGameModeId(mode.value.id)
)
const winConditionHint = computed(() => werewolfWinConditionDesc(winCondition.value))
const rolePlan = computed(() =>
  isWerewolf.value ? buildWerewolfRolePlanWithExpansions(targetPlayerCount.value, enabledExpansions.value) : []
)
const activeRoleIds = computed(() => new Set(rolePlan.value))
const rolesInPlan = computed(() => mode.value.roles.filter((role) => activeRoleIds.value.has(role.id)))
const roleStructureGroups = computed((): RoleGroup[] => {
  if (!isWerewolf.value) return []
  const counts = new Map<string, number>()
  const source = identityMode.value === 'manual' ? Object.values(manualRoles.value) : rolePlan.value
  for (const roleId of source) counts.set(roleId, (counts.get(roleId) || 0) + 1)
  const wolves: RoleGroupItem[] = []
  const gods: RoleGroupItem[] = []
  const goods: RoleGroupItem[] = []
  for (const role of mode.value.roles) {
    const count = counts.get(role.id)
    if (!count) continue
    const item = { name: role.name, count, roleId: role.id }
    if (role.camp === 'wolf') wolves.push(item)
    else if (role.isGod) gods.push(item)
    else goods.push(item)
  }
  const groups: RoleGroup[] = []
  if (wolves.length) groups.push({ label: '狼人阵营', tone: 'wolf', items: wolves })
  if (gods.length) groups.push({ label: '神职', tone: 'god', items: gods })
  if (goods.length) groups.push({ label: '平民', tone: 'good', items: goods })
  return groups
})
const roleSummaryLine = computed(() =>
  roleStructureGroups.value
    .flatMap((group) => group.items.map((item) => item.name + '×' + item.count))
    .join(' · ')
)
const gameBriefText = computed(() => {
  if (isRoundtableFamily.value) {
    const label = isBrainstormMode.value ? '头脑风暴' : '圆桌讨论'
    const focus = designTarget.value.trim() ? `，焦点「${designTarget.value.trim()}」` : ''
    return `${targetPlayerCount.value} 人${label}，议题「${discussionTopic.value}」${focus}，共 ${roundtableRounds.value} 轮发言。`
  }
  const lines: string[] = []
  lines.push(
    `${targetPlayerCount.value} 人 ${mode.value.name}，身份${identityMode.value === 'manual' ? '由你指定' : '开局后随机分配'}。`
  )
  lines.push(sheriffEnabled.value ? '开启警长竞选，警长票按 1.5 票计入放逐。' : '不启用警长，首局直接从夜晚阶段开始。')
  lines.push(`胜负条件：${winCondition.value === 'side_slaughter' ? '屠边（杀光平民或神职）' : '屠城（杀光所有好人）'}。`)
  if (selectedExpansionRoles.value.length) {
    lines.push('扩展身份：' + selectedExpansionRoles.value.map((role) => role.name).join('、') + '。')
  } else {
    lines.push('未启用扩展身份，使用标准板子。')
  }
  if (mode.value.setupSummary) {
    const brief = mode.value.setupSummary.split('。')[0]
    if (brief) lines.push(brief + '。')
  }
  return lines.join('')
})
const warnings = computed(() => {
  const list: string[] = []
  if (!characters.value.length) list.push('还没有可用角色，请先创建并启用角色。')
  if (slotsRemaining.value > 0) list.push('还需要选择 ' + slotsRemaining.value + ' 名角色（目标 ' + targetPlayerCount.value + ' 人）。')
  if (slotsOver.value > 0) list.push('已超出目标人数 ' + slotsOver.value + ' 名，请取消部分角色。')
  if (identityMode.value === 'manual' && isWerewolf.value && selectedCount.value === targetPlayerCount.value) {
    const wolfCount = selectedCharacters.value.filter((item) => manualRoles.value[item.id] === 'werewolf').length
    if (wolfCount < 1) list.push('指定分配至少需要 1 名狼人。')
  }
  return list
})

const identityOptions: Array<{ id: IdentityAssignMode; title: string; desc: string }> = [
  { id: 'random', title: '随机', desc: '按人数与扩展包生成标准身份结构。' },
  { id: 'manual', title: '指定', desc: '为每位参赛角色逐个指定身份。' },
]

function clampPlayerCount(count: number) {
  return Math.min(playerCountMax.value, Math.max(playerCountMin.value, Math.floor(count)))
}
function syncManualRoles() {
  const next: Record<string, string> = {}
  for (const char of selectedCharacters.value) next[char.id] = manualRoles.value[char.id] || defaultRoleForIndex(Object.keys(next).length)
  manualRoles.value = next
}
function defaultRoleForIndex(index: number): string {
  return rolePlan.value[index] || 'villager'
}
function removeExpansion(id: WerewolfExpansionRoleId) {
  enabledExpansions.value = enabledExpansions.value.filter((item) => item !== id)
  playArenaTone('click')
}
function pickCharacterLine(char: Character): string {
  if (char.commonPhrases?.length) {
    return char.commonPhrases[Math.floor(Math.random() * char.commonPhrases.length)]
  }
  if (char.subtitle?.trim()) return char.subtitle
  return `我是${char.name}，可以上场了。`
}
function resolveSystemRoleModelIds(): Record<string, string> {
  const scenario = gameScenarioService.getByGameModeId(mode.value.id)
  const models: Record<string, string> = {}
  for (const role of scenario?.systemRoles || []) {
    models[role.kind] = role.modelId || getFallbackModelId()
  }
  return models
}
function resolveParticipantModelIds(): string[] {
  if (selectedCharacters.value.length) {
    return selectedCharacters.value.map((item) => item.modelId)
  }
  return characters.value.slice(0, targetPlayerCount.value).map((item) => item.modelId)
}
async function syncCostEstimate() {
  costEstimateLoading.value = true
  try {
    await gameScenarioService.refresh().catch(() => null)
    const scenario = gameScenarioService.getByGameModeId(mode.value.id)
    costEstimate.value = await matchCostEstimator.estimateAsync(
      mode.value.id,
      Math.max(targetPlayerCount.value, 1),
      {
        participantModelIds: resolveParticipantModelIds(),
        systemRoleModelIds: resolveSystemRoleModelIds(),
        sheriffEnabled: isWerewolf.value ? sheriffEnabled.value : undefined,
        roundtableRounds: isRoundtable.value ? roundtableRounds.value : undefined,
        roundtableHostEnabled: scenario?.systemRoles.some((role) => role.kind === 'host' && role.enabled) ?? true,
        roundtableNarratorEnabled: scenario?.systemRoles.some((role) => role.kind === 'narrator' && role.enabled) ?? false,
      }
    )
  } finally {
    costEstimateLoading.value = false
  }
}
function scheduleCostEstimate() {
  if (costEstimateTimer) clearTimeout(costEstimateTimer)
  costEstimateTimer = setTimeout(() => {
    void syncCostEstimate()
  }, 200)
}
function showSpeechBubble(char: Character, index: number) {
  activeSpeech.value = {
    charId: char.id,
    text: pickCharacterLine(char),
    side: index % 3 >= 1 ? 'left' : 'right',
  }
}
function clearSpeechBubble() {
  activeSpeech.value = null
}
function switchMode(nextMode: GameMode) {
  if (mode.value.id === nextMode.id) return
  mode.value = nextMode
  targetPlayerCount.value = clampPlayerCount(nextMode.recommendedPlayers)
  enabledExpansions.value = isWerewolfMode(nextMode)
    ? defaultWerewolfExpansionsForCount(targetPlayerCount.value)
    : []
  sheriffEnabled.value = true
  winCondition.value = DEFAULT_WEREWOLF_WIN_CONDITION
  trimSelectionToTarget()
  playArenaTone('step')
}
function isWerewolfMode(nextMode: GameMode) {
  return nextMode.id === 'werewolf' || nextMode.engineKind === 'werewolf'
}
function trimSelectionToTarget() {
  let selected = 0
  characters.value = characters.value.map((item) => {
    if (!item.selected) return item
    selected += 1
    return selected > targetPlayerCount.value ? { ...item, selected: false } : item
  })
}
function normalizeIdentityMode(value?: IdentityAssignMode): IdentityAssignMode {
  return value === 'manual' ? 'manual' : 'random'
}

watch(selectedCharacters, () => {
  if (identityMode.value === 'manual') syncManualRoles()
})
watch(identityMode, (value) => {
  if (value === 'manual') syncManualRoles()
})
watch(targetPlayerCount, (count) => {
  const clamped = clampPlayerCount(count)
  if (clamped !== count) {
    targetPlayerCount.value = clamped
    return
  }
  trimSelectionToTarget()
  enabledExpansions.value = enabledExpansions.value.filter((id) => {
    const role = WEREWOLF_EXPANSION_ROLES.find((entry) => entry.id === id)
    return role && count >= role.minPlayers
  })
})
watch(rolePlan, () => {
  if (identityMode.value === 'manual') syncManualRoles()
})
watch([() => mode.value.id, targetPlayerCount, sheriffEnabled, roundtableRounds], () => scheduleCostEstimate())
watch(selectedCharacters, () => scheduleCostEstimate(), { deep: true })

async function load() {
  loading.value = true
  error.value = ''
  try {
    const preset = arenaSession.getCreatePreset()
    const selectedMode = preset?.gameModeId || arenaSession.getSelectedMode() || 'werewolf'
    const picked = gameModeService.get(selectedMode)
    mode.value = picked && isModePlayable(picked) ? picked : defaultMode
    targetPlayerCount.value = clampPlayerCount(preset?.targetPlayerCount || mode.value.recommendedPlayers)
    enabledExpansions.value = normalizeWerewolfExpansions(preset?.werewolfDlcs, targetPlayerCount.value)
    enabledRuleModules.value = normalizeWerewolfRuleModules(preset?.werewolfRuleModules)
    sheriffEnabled.value = preset?.sheriffEnabled !== false
    winCondition.value = preset?.werewolfWinCondition === 'side_slaughter' ? 'side_slaughter' : DEFAULT_WEREWOLF_WIN_CONDITION
    settings.value = await settingsService.get()
    identityMode.value = normalizeIdentityMode(preset?.identityAssignMode || settings.value.defaultIdentityAssignMode)
    if (preset?.manualRoles) manualRoles.value = { ...preset.manualRoles }
    const list = await characterService.list({ status: 'enabled' })
    const presetParam = route.value.path.includes('?') ? route.value.path.split('?')[1] : ''
    const queryIds = new URLSearchParams(presetParam).get('characters')?.split(',').filter(Boolean) || []
    const presetIds = preset?.characterIds?.length ? preset.characterIds : queryIds
    const autoSelectCount = Math.min(targetPlayerCount.value, list.length)
    characters.value = list.map((char, index) => ({
      ...char,
      selected: presetIds.length ? presetIds.includes(char.id) : index < autoSelectCount,
    }))
    trimSelectionToTarget()
    if (identityMode.value === 'manual') syncManualRoles()
    await matchCostEstimator.refresh().catch(() => null)
    syncCostEstimate()
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    loading.value = false
  }
}
function toggleCharacter(char: SelectableCharacter, index: number) {
  if (char.selected) {
    char.selected = false
    if (activeSpeech.value?.charId === char.id) clearSpeechBubble()
    error.value = ''
    return
  }
  if (selectedCount.value >= targetPlayerCount.value) {
    error.value = '本局目标 ' + targetPlayerCount.value + ' 人，已达上限'
    playArenaTone('warn')
    return
  }
  char.selected = true
  error.value = ''
  showSpeechBubble(char, index)
  playArenaTone('click')
}
function selectLastUsed() {
  const ids = arenaSession.getLastCreateSelection(mode.value.id)
  if (!ids.length) {
    error.value = '暂无上次选用记录'
    playArenaTone('warn')
    return
  }
  const idSet = new Set(ids.slice(0, targetPlayerCount.value))
  characters.value = characters.value.map((item) => ({ ...item, selected: idSet.has(item.id) }))
  error.value = ''
  playArenaTone('step')
}
function selectAllPossible() {
  characters.value = characters.value.map((item, index) => ({ ...item, selected: index < targetPlayerCount.value }))
  error.value = ''
  playArenaTone('step')
}
function clearSelection() {
  characters.value = characters.value.map((item) => ({ ...item, selected: false }))
  clearSpeechBubble()
  error.value = ''
}
function setManualRole(characterId: string, roleId: string) {
  manualRoles.value = { ...manualRoles.value, [characterId]: roleId }
}
async function checkLearningBeforeStart(): Promise<boolean | null> {
  await gameScenarioService.refresh()
  const scenario = gameScenarioService.getByGameModeId(mode.value.id)
  if (!scenario?.requiresLearning) return false
  const issues: string[] = []
  for (const character of selectedCharacters.value) {
    const check = canJoinScenario(character, scenario.id)
    if (!check.ok) issues.push(check.reason || character.name)
  }
  if (!issues.length) return false
  const confirmed = await confirm({
    title: '跳过玩法检查',
    message: '以下角色尚未完成玩法学习或考试：',
    detail: issues.join('\n') + '\n\n是否跳过检查并继续开局？',
    tone: 'warning',
    confirmText: '继续启动',
  })
  return confirmed ? true : null
}
async function createMatch(skipLearningCheck: boolean) {
  const created = await matchService.create({
    gameModeId: mode.value.id,
    characterIds: selectedCharacters.value.map((item) => item.id),
    identityAssignMode: identityMode.value,
    manualRoles: identityMode.value === 'manual' ? manualRoles.value : undefined,
    werewolfDlcs: isWerewolf.value ? enabledExpansions.value : undefined,
    werewolfRuleModules: isWerewolf.value ? enabledRuleModules.value : undefined,
    sheriffEnabled: isWerewolf.value ? sheriffEnabled.value : undefined,
    werewolfWinCondition: isWerewolf.value ? winCondition.value : undefined,
    discussionTopic: isRoundtableFamily.value ? discussionTopic.value : undefined,
    roundtableRounds: isRoundtableFamily.value ? roundtableRounds.value : undefined,
    designTarget: isBrainstormMode.value && designTarget.value.trim() ? designTarget.value.trim() : undefined,
    skipLearningCheck,
  })
  arenaSession.clearSelectedMode()
  arenaSession.clearCreatePreset()
  arenaSession.setLastCreateSelection(
    mode.value.id,
    selectedCharacters.value.map((item) => item.id)
  )
  playArenaTone('success')
  await matchWindowService.open(created.id)
}
async function startMatch() {
  if (!canStart.value) {
    error.value = warnings.value[0] || '请先完成场景配置'
    playArenaTone('warn')
    return
  }
  if (identityMode.value === 'manual' && isWerewolf.value) {
    syncManualRoles()
    const wolfCount = selectedCharacters.value.filter((item) => manualRoles.value[item.id] === 'werewolf').length
    if (wolfCount < 1) {
      error.value = '指定分配至少需要 1 名狼人'
      playArenaTone('warn')
      return
    }
  }
  starting.value = true
  error.value = ''
  try {
    if (settings.value.matchDefaults.pauseOnLowBalance || settings.value.balanceReminder) {
      const balance = await billingService.getBalanceCents(true)
      if (balance !== null && balance < settings.value.balanceReminderThresholdCents && settings.value.matchDefaults.pauseOnLowBalance) {
        error.value = '当前余额低于 ' + (settings.value.balanceReminderThresholdCents / 100).toFixed(2) + ' 元，请补充余额后再启动场景。'
        playArenaTone('warn')
        return
      }
    }
    const skipLearning = await checkLearningBeforeStart()
    if (skipLearning === null) return
    await createMatch(skipLearning)
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    starting.value = false
  }
}
onMounted(() => void load())
</script>

<template>
  <ArenaPageShell class="create-page" viewport-lock>
    <div class="create-root">
      <ArenaPageState :loading="loading" skeleton="create-match" loading-label="正在整理场景配置..." @retry="() => load()">
        <main class="create-board">
          <aside class="setup-panel glass-panel">
            <button type="button" class="mode-cover" @click="showModePicker = true">
              <img :src="modeImageById(mode.id)" :alt="mode.name" />
              <span><Lock :size="13" /> {{ mode.name }}</span>
            </button>
            <div class="mode-title">
              <span>当前场景</span>
              <div class="mode-title-row">
                <h2>{{ mode.name }}</h2>
                <button type="button" class="info-btn" aria-label="查看玩法说明" @click.stop="showModeInfo = true">
                  <Info :size="16" />
                </button>
              </div>
              <p>{{ mode.subtitle }}</p>
              <button type="button" class="link-action" @click="showModePicker = true">切换场景<ChevronDown :size="14" /></button>
            </div>
            <div class="mode-stats">
              <span><Users :size="14" /> {{ playerCountMin }}-{{ playerCountMax }} 人</span>
              <span>{{ mode.estimatedDurationMinutes }} 分钟</span>
            </div>

            <div v-if="isRoundtableFamily" class="setup-block roundtable-setup">
              <label>{{ isBrainstormMode ? '头脑风暴议题' : '讨论议题' }}</label>
              <p class="setup-hint">
                {{ isBrainstormMode ? '讨论后将归纳产物（规则草案 / 角色清单），无经验教训沉淀。' : '纯讨论，无胜负、无产物。' }}
              </p>
              <select v-model="discussionTopic" class="topic-select">
                <option v-for="topic in ROUNDTABLE_TOPIC_PRESETS" :key="topic" :value="topic">{{ topic }}</option>
              </select>
              <input v-model="discussionTopic" type="text" placeholder="或输入自定义议题" />
              <template v-if="isBrainstormMode">
                <label class="setup-sub-label">设计焦点</label>
                <input v-model="designTarget" type="text" placeholder="如：6 人狼人杀开局配置、某角色人设草案…" />
              </template>
              <label class="setup-sub-label">发言轮数</label>
              <input v-model.number="roundtableRounds" type="number" min="1" max="8" />
            </div>

            <div class="setup-block">
              <label>参与人数</label>
              <div class="slider-head">
                <strong>{{ targetPlayerCount }} 人</strong>
                <em>推荐 {{ mode.recommendedPlayers }} 人</em>
              </div>
              <input
                v-model.number="targetPlayerCount"
                class="count-slider"
                type="range"
                :min="playerCountMin"
                :max="playerCountMax"
                step="1"
              />
              <div class="slider-scale"><span>{{ playerCountMin }}</span><span>{{ playerCountMax }}</span></div>
            </div>

            <div v-if="isWerewolf" class="setup-block">
              <div class="expansion-head">
                <label>身份扩展</label>
                <button type="button" class="link-action" @click="showDlcPicker = true">
                  {{ selectedExpansionRoles.length ? '编辑' : '选择' }}
                </button>
              </div>
              <div v-if="selectedExpansionRoles.length" class="selected-expansions">
                <span
                  v-for="role in selectedExpansionRoles"
                  :key="role.id"
                  class="expansion-tag"
                  :class="'camp-' + role.camp"
                >
                  {{ role.name }}
                  <button type="button" aria-label="移除" @click.stop="removeExpansion(role.id)"><X :size="11" /></button>
                </span>
              </div>
              <button v-else type="button" class="expansion-empty" @click="showDlcPicker = true">
                未选择扩展 · 使用标准身份
              </button>
            </div>

            <div v-if="isWerewolf" class="setup-block">
              <label>警长玩法</label>
              <div class="toggle-row">
                <button type="button" :class="{ active: sheriffEnabled }" @click="sheriffEnabled = true">开启</button>
                <button type="button" :class="{ active: !sheriffEnabled }" @click="sheriffEnabled = false">关闭</button>
              </div>
              <small>{{ sheriffEnabled ? '首轮竞选警长，警长票按 1.5 票计算。' : '跳过警上发言与警长投票，直接从夜晚开始。' }}</small>
              <label class="setup-sub-label">胜负条件</label>
              <div class="toggle-row">
                <button type="button" :class="{ active: winCondition === 'side_slaughter' }" @click="winCondition = 'side_slaughter'">屠边</button>
                <button type="button" :class="{ active: winCondition === 'city_slaughter' }" @click="winCondition = 'city_slaughter'">屠城</button>
              </div>
              <small>{{ winConditionHint }}</small>
            </div>

          </aside>

          <section class="pick-panel glass-panel">
            <div class="panel-head">
              <div>
                <span>参赛角色</span>
                <h2>已选 {{ selectedCount }} / {{ targetPlayerCount }} 人</h2>
              </div>
              <div class="quick-actions">
                <button type="button" @click="selectLastUsed">选用上次</button>
                <button type="button" @click="selectAllPossible">全选</button>
                <button type="button" class="danger" @click="clearSelection">清空</button>
              </div>
            </div>
            <div v-if="!characters.length" class="empty-pick">
              <AlertCircle :size="28" />
              <strong>还没有可用角色</strong>
              <p>创建并启用至少 {{ targetPlayerCount }} 名角色后，就可以开始 {{ mode.name }} 场景演练。</p>
              <button type="button" @click="navigate('/characters?create=1')">创建角色</button>
            </div>
            <div v-else class="character-grid">
              <CharacterPickCard
                v-for="(char, index) in characters"
                :key="char.id"
                :character="char"
                :selected="char.selected"
                :disabled="!char.selected && selectedCount >= targetPlayerCount"
                :speaking="activeSpeech?.charId === char.id"
                :speech-text="activeSpeech?.charId === char.id ? activeSpeech.text : ''"
                :speech-side="activeSpeech?.charId === char.id ? activeSpeech.side : 'right'"
                :speech-config="speechDisplayConfig"
                :speech-participants="speechPreviewParticipants"
                compact
                @click="toggleCharacter(char, index)"
              />
            </div>
          </section>

          <aside class="launch-panel glass-panel">
            <div class="panel-head launch-head">
              <div>
                <span>开局配置</span>
                <h2>{{ launchHeadline }}</h2>
              </div>
              <Sparkles :size="22" />
            </div>

            <div v-if="isWerewolf" class="identity-switch">
              <button
                v-for="item in identityOptions"
                :key="item.id"
                type="button"
                :class="{ active: identityMode === item.id }"
                @click="identityMode = item.id"
              >
                <b>{{ item.title }}</b>
                <span>{{ item.desc }}</span>
              </button>
            </div>

            <div v-if="isWerewolf" class="role-structure-simple">
              <div class="role-structure-head">
                <span>身份结构</span>
                <strong>{{ targetPlayerCount }} 人</strong>
              </div>
              <p class="role-line">{{ roleSummaryLine }}</p>
              <ul class="role-breakdown">
                <li v-for="group in roleStructureGroups" :key="group.label">
                  <span>{{ group.label }}</span>
                  <em>{{ group.items.map((item) => item.name + '×' + item.count).join(' ') }}</em>
                </li>
              </ul>
            </div>

            <section class="game-brief">
              <span>场景说明</span>
              <p>{{ gameBriefText }}</p>
            </section>

            <div v-if="identityMode === 'manual' && isWerewolf" class="manual-roles">
              <article v-for="char in selectedCharacters" :key="char.id">
                <span>{{ char.name }}</span>
                <div>
                  <button
                    v-for="role in rolesInPlan"
                    :key="role.id"
                    type="button"
                    :class="{ active: manualRoles[char.id] === role.id }"
                    @click="setManualRole(char.id, role.id)"
                  >
                    {{ role.name }}
                  </button>
                </div>
              </article>
            </div>

            <div class="launch-metrics">
              <div>
                <span>预估总费用</span>
                <strong>{{ costEstimateLoading ? '…' : formatYuan(estimatedCost) }}</strong>
                <em>{{ costSourceLabel }}</em>
              </div>
              <div><span>自动推进</span><strong>{{ settings.matchDefaults.autoAdvance ? '开' : '关' }}</strong></div>
            </div>
            <div v-if="warnings.length || error" class="warning-box">
              <AlertCircle :size="16" />
              <div>
                <p v-if="error">{{ error }}</p>
                <p v-for="item in warnings" :key="item">{{ item }}</p>
              </div>
            </div>
            <button type="button" class="start-button" :disabled="!canStart" @click="startMatch">
              <Loader2 v-if="starting" :size="20" class="spin" />
              <Play v-else :size="20" />
              {{ starting ? '正在启动' : '开始场景' }}
            </button>
          </aside>
        </main>
      </ArenaPageState>
    </div>

    <CreateMatchModeInfoDialog v-model:open="showModeInfo" :mode="mode" />
    <CreateMatchModePickerDialog v-model:open="showModePicker" :modes="playableModes" :current-id="mode.id" @pick="switchMode" />
    <CreateMatchDlcPickerDialog
      v-model:open="showDlcPicker"
      v-model:enabled="enabledExpansions"
      v-model:enabled-rules="enabledRuleModules"
      :player-count="targetPlayerCount"
    />
  </ArenaPageShell>
</template>

<style scoped>
.create-page :deep(.aa-page-inner) {
  max-width: none;
  padding: 10px 24px 14px;
  height: 100%;
}
.create-root {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.create-board {
  flex: 1;
  min-height: 0;
  max-height: calc(100vh - 108px);
  display: grid;
  grid-template-columns: 294px minmax(0, 1fr) 390px;
  gap: 14px;
  align-items: stretch;
}
.glass-panel {
  min-height: 0;
  border-radius: 24px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.8), rgba(249, 247, 255, 0.66));
  border: 1px solid rgba(255, 255, 255, 0.78);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.86), 0 20px 48px rgba(84, 68, 160, 0.1);
  backdrop-filter: blur(18px) saturate(1.08);
}
.setup-panel,
.launch-panel {
  padding: 13px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mode-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  max-height: 228px;
  padding: 0;
  border: 0;
  border-radius: 20px;
  overflow: hidden;
  cursor: pointer;
  background: rgba(126, 99, 255, 0.06);
}
.mode-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
  transition: transform 480ms cubic-bezier(0.16, 1, 0.3, 1);
}
.setup-panel:hover .mode-cover img {
  transform: scale(1.05);
}
.mode-cover span {
  position: absolute;
  left: 10px;
  top: 10px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  border-radius: 999px;
  color: #fff;
  background: rgba(42, 31, 96, 0.42);
  backdrop-filter: blur(10px);
  font-size: 12px;
  font-weight: 700;
}
.mode-title span,
.panel-head span,
.summary-card span,
.launch-metrics span,
.setup-block > label,
.role-structure-head span {
  color: #8077a5;
  font-size: 12px;
  font-weight: 650;
}
.mode-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.mode-title h2,
.panel-head h2 {
  margin: 4px 0;
  color: #151550;
  font-size: 20px;
  line-height: 1.12;
}
.mode-title p {
  margin: 0;
  color: #665f8e;
  font-size: 12px;
  line-height: 1.5;
}
.link-action {
  margin-top: 6px;
  padding: 0;
  border: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #5e52d8;
  background: transparent;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}
.info-btn {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(126, 99, 255, 0.14);
  border-radius: 10px;
  color: #5e52d8;
  background: rgba(255, 255, 255, 0.62);
  cursor: pointer;
}
.mode-stats {
  display: grid;
  gap: 6px;
}
.mode-stats span {
  min-height: 28px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 10px;
  border-radius: 11px;
  color: #5e55a3;
  background: rgba(126, 99, 255, 0.08);
  font-size: 12px;
}
.setup-block {
  display: grid;
  gap: 7px;
}
.setup-sub-label {
  margin-top: 4px;
  color: #8077a5;
  font-size: 12px;
  font-weight: 650;
}
.slider-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.slider-head strong {
  color: #1b1856;
  font-size: 18px;
}
.slider-head em {
  color: #8a82aa;
  font-size: 11px;
  font-style: normal;
}
.count-slider {
  width: 100%;
  accent-color: #7e63ff;
}
.slider-scale {
  display: flex;
  justify-content: space-between;
  color: #8a82aa;
  font-size: 11px;
}
.setup-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid rgba(126, 99, 255, 0.11);
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.52);
  text-align: left;
  cursor: pointer;
}
.setup-picker b {
  display: block;
  color: #1b1856;
  font-size: 13px;
}
.expansion-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.selected-expansions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.expansion-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  border-radius: 999px;
  color: #5e52d8;
  background: rgba(126, 99, 255, 0.1);
  border: 1px solid rgba(126, 99, 255, 0.14);
  font-size: 11px;
  font-weight: 650;
}
.expansion-tag.camp-wolf {
  color: #c73568;
  background: rgba(217, 70, 122, 0.1);
  border-color: rgba(217, 70, 122, 0.16);
}
.expansion-tag button {
  width: 16px;
  height: 16px;
  padding: 0;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 999px;
  color: inherit;
  background: rgba(255, 255, 255, 0.55);
  cursor: pointer;
}
.expansion-empty {
  width: 100%;
  padding: 10px 12px;
  border: 1px dashed rgba(126, 99, 255, 0.2);
  border-radius: 14px;
  color: #8a82aa;
  background: rgba(255, 255, 255, 0.42);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.setup-picker em {
  display: block;
  margin-top: 3px;
  color: #756d99;
  font-size: 11px;
  font-style: normal;
}
.toggle-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
}
.toggle-row button {
  height: 34px;
  border: 1px solid rgba(126, 99, 255, 0.11);
  border-radius: 12px;
  color: #665e8d;
  background: rgba(255, 255, 255, 0.52);
  cursor: pointer;
}
.toggle-row button.active {
  color: #fff;
  border-color: transparent;
  background: linear-gradient(135deg, #8d6bff, #5b58f7);
}
.setup-block small {
  color: #8a82aa;
  font-size: 11px;
  line-height: 1.45;
}
.roundtable-setup label {
  display: grid;
  gap: 6px;
  color: #5e55a3;
  font-size: 12px;
}
.roundtable-setup .setup-hint {
  margin: 0 0 8px;
  color: #8a82aa;
  font-size: 11px;
  line-height: 1.45;
}
.roundtable-setup .topic-select,
.roundtable-setup input {
  height: 34px;
  padding: 0 10px;
  border: 1px solid rgba(126, 99, 255, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.62);
  color: #243066;
  font: inherit;
  font-size: 13px;
}
.roundtable-setup .setup-sub-label {
  margin-top: 8px;
}
.session-kind-row {
  display: grid;
  gap: 8px;
}
.session-kind-row button {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid rgba(126, 99, 255, 0.14);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.62);
  text-align: left;
  cursor: pointer;
}
.session-kind-row button.active {
  border-color: rgba(91, 87, 243, 0.4);
  background: rgba(112, 105, 255, 0.1);
}
.session-kind-row strong {
  color: #17205a;
  font-size: 13px;
}
.session-kind-row em {
  color: #7a85b0;
  font-size: 11px;
  font-style: normal;
  line-height: 1.45;
}
.setup-stats.bottom {
  margin-top: auto;
}
.setup-stats span {
  min-height: 28px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  border-radius: 11px;
  color: #5e55a3;
  background: rgba(126, 99, 255, 0.08);
  font-size: 12px;
}
.pick-panel {
  padding: 15px;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 10px;
  min-height: 0;
  overflow: hidden;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.quick-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.quick-actions button {
  height: 31px;
  padding: 0 12px;
  border: 1px solid rgba(126, 99, 255, 0.12);
  border-radius: 12px;
  color: #5e52d8;
  background: rgba(255, 255, 255, 0.58);
  cursor: pointer;
}
.quick-actions button.danger {
  color: #d9467a;
  border-color: rgba(217, 70, 122, 0.18);
  background: rgba(255, 241, 247, 0.72);
}
.character-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(228px, 1fr));
  gap: 14px;
  min-height: 0;
  overflow: auto;
  padding: 8px 12px 4px;
  scrollbar-width: none;
  align-content: start;
}
.character-grid::-webkit-scrollbar {
  display: none;
}
.launch-panel {
  gap: 10px;
}
.launch-head svg {
  color: #725cff;
}
.identity-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
}
.identity-switch button {
  min-height: 58px;
  padding: 10px;
  border: 1px solid rgba(126, 99, 255, 0.11);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.52);
  text-align: left;
  cursor: pointer;
}
.identity-switch button.active {
  border-color: rgba(126, 99, 255, 0.42);
  background: rgba(126, 99, 255, 0.1);
  box-shadow: inset 0 -3px 0 #7e63ff;
}
.identity-switch b {
  display: block;
  color: #1b1856;
  font-size: 13px;
}
.identity-switch span {
  display: block;
  margin-top: 4px;
  color: #756d99;
  font-size: 11px;
  line-height: 1.35;
}
.role-structure-simple {
  padding: 10px 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(126, 99, 255, 0.1);
}
.role-structure-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.role-structure-head strong {
  color: #1b1856;
  font-size: 14px;
}
.role-line {
  margin: 6px 0 8px;
  color: #534a82;
  font-size: 12px;
  line-height: 1.5;
}
.role-breakdown {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 6px;
}
.role-breakdown li {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  font-size: 11px;
  line-height: 1.45;
}
.role-breakdown span {
  color: #8077a5;
  font-weight: 650;
}
.role-breakdown em {
  color: #1b1856;
  font-style: normal;
}
.game-brief {
  padding: 10px 12px;
  border-radius: 16px;
  background: rgba(126, 99, 255, 0.06);
  border: 1px solid rgba(126, 99, 255, 0.1);
}
.game-brief span {
  color: #8077a5;
  font-size: 12px;
  font-weight: 650;
}
.game-brief p {
  margin: 6px 0 0;
  color: #534a82;
  font-size: 12px;
  line-height: 1.6;
}
.manual-roles {
  max-height: 130px;
  overflow: auto;
  display: grid;
  gap: 8px;
}
.manual-roles article {
  padding: 8px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.52);
}
.manual-roles article > span {
  display: block;
  margin-bottom: 6px;
  color: #201c59;
  font-size: 12px;
  font-weight: 700;
}
.manual-roles article div {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.manual-roles button {
  height: 26px;
  padding: 0 8px;
  border: 1px solid rgba(126, 99, 255, 0.12);
  border-radius: 999px;
  color: #665e8d;
  background: rgba(255, 255, 255, 0.55);
  cursor: pointer;
  font-size: 11px;
}
.manual-roles button.active {
  color: #fff;
  border-color: transparent;
  background: linear-gradient(135deg, #8d6bff, #5b58f7);
}
.launch-metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.launch-metrics div {
  padding: 8px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.52);
}
.launch-metrics strong {
  display: block;
  margin-top: 4px;
  color: #191653;
  font-size: 14px;
}
.launch-metrics em {
  display: block;
  margin-top: 3px;
  color: #8a82aa;
  font-size: 11px;
  font-style: normal;
}
.warning-box {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 8px;
  padding: 9px;
  border-radius: 14px;
  color: #b64b70;
  background: rgba(255, 241, 247, 0.72);
  font-size: 12px;
}
.start-button {
  margin-top: auto;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 0;
  border-radius: 18px;
  color: #fff;
  background: linear-gradient(135deg, #8d6bff, #5b58f7);
  font-size: 17px;
  font-weight: 760;
  cursor: pointer;
}
.start-button:disabled {
  opacity: 0.52;
  cursor: not-allowed;
}
.empty-pick {
  display: grid;
  place-items: center;
  gap: 10px;
  color: #746d99;
  text-align: center;
}
.empty-pick button {
  height: 38px;
  padding: 0 16px;
  border: 0;
  border-radius: 14px;
  color: #fff;
  background: linear-gradient(135deg, #8d6bff, #5b58f7);
  cursor: pointer;
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 1320px) {
  .create-board {
    grid-template-columns: 270px minmax(0, 1fr) 350px;
  }
}
</style>
