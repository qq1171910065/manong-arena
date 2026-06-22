<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { AlertCircle, Check, ChevronRight, Crown, Loader2, Lock, MoonStar, Play, RefreshCw, Shield, ShieldCheck, Shuffle, Sparkles, Swords, Users, Vote, Wand2 } from 'lucide-vue-next'
import ArenaPageShell from '@renderer/components/arena/ArenaPageShell.vue'
import ArenaPageState from '@renderer/components/arena/ArenaPageState.vue'
import { characterAvatarByName, modeImageById } from '@renderer/data/arena-visual-assets'
import { navigate, route } from '../router'
import { arenaSession, billingService, characterService, formatUserMessage, gameModeService, matchService, matchWindowService, playArenaTone, settingsService } from '@renderer/services/arena'
import { formatYuan } from '@renderer/utils/id'
import type { Character, GameMode, GameModeRole, IdentityAssignMode } from '@shared/arena/types'

type SelectableCharacter = Character & { selected: boolean }

const modes = gameModeService.list()
const werewolfMode = gameModeService.get('werewolf') || modes[0]
const mode = ref<GameMode>(werewolfMode)
const settings = ref(settingsService.defaults())
const characters = ref<SelectableCharacter[]>([])
const identityMode = ref<IdentityAssignMode>('random')
const manualRoles = ref<Record<string, string>>({})
const loading = ref(true)
const refreshing = ref(false)
const starting = ref(false)
const error = ref('')
const selectedFilter = ref<'all' | 'selected' | 'unselected'>('all')

const selectedCharacters = computed(() => characters.value.filter((item) => item.selected))
const selectedCount = computed(() => selectedCharacters.value.length)
const minNeeded = computed(() => Math.max(0, mode.value.minPlayers - selectedCount.value))
const overLimit = computed(() => Math.max(0, selectedCount.value - mode.value.maxPlayers))
const canStart = computed(() => selectedCount.value >= mode.value.minPlayers && selectedCount.value <= mode.value.maxPlayers && !starting.value)
const estimatedCost = computed(() => gameModeService.estimateCost(mode.value.id, Math.max(selectedCount.value, 1)))
const filteredCharacters = computed(() => {
  if (selectedFilter.value === 'selected') return characters.value.filter((item) => item.selected)
  if (selectedFilter.value === 'unselected') return characters.value.filter((item) => !item.selected)
  return characters.value
})

const rolePlan = computed(() => buildRolePlan(selectedCount.value || mode.value.recommendedPlayers))
const roleSummary = computed(() => {
  const counts = new Map<string, number>()
  if (identityMode.value === 'manual') {
    for (const roleId of Object.values(manualRoles.value)) counts.set(roleId, (counts.get(roleId) || 0) + 1)
  } else {
    for (const roleId of rolePlan.value) counts.set(roleId, (counts.get(roleId) || 0) + 1)
  }
  return mode.value.roles.filter((role) => counts.has(role.id)).map((role) => role.name + ' x' + counts.get(role.id)).join(' · ') || '尚未生成身份结构'
})
const godRoles = computed(() => mode.value.roles.filter((role) => role.isGod))
const wolfRole = computed(() => mode.value.roles.find((role) => role.id === 'werewolf'))
const villagerRole = computed(() => mode.value.roles.find((role) => role.id === 'villager'))
const roleCards = computed(() => [wolfRole.value, ...godRoles.value, villagerRole.value].filter(Boolean) as GameModeRole[])
const warnings = computed(() => {
  const list: string[] = []
  if (!characters.value.length) list.push('还没有可用角色，请先创建并启用角色。')
  if (minNeeded.value > 0) list.push('还需要选择 ' + minNeeded.value + ' 名角色才能开局。')
  if (overLimit.value > 0) list.push('已超出人数上限 ' + overLimit.value + ' 名，请取消部分角色。')
  if (identityMode.value === 'manual') {
    const wolfCount = selectedCharacters.value.filter((item) => manualRoles.value[item.id] === 'werewolf').length
    if (selectedCount.value >= mode.value.minPlayers && wolfCount < 1) list.push('手动分配至少需要 1 名狼人。')
  }
  return list
})

const rules = computed(() => [
  { icon: Crown, title: '警长玩法', desc: mode.value.sheriffRule || '首轮竞选警长，警长拥有归票权。' },
  { icon: MoonStar, title: '夜晚技能', desc: '守卫、狼人、预言家、女巫依次行动，裁判隐藏私有信息，只公开天亮结果。' },
  { icon: Vote, title: '放逐投票', desc: '存活且有票权的角色投票，警长票按 1.5 票计算，平票无人出局。' },
  { icon: ShieldCheck, title: '胜负判定', desc: '狼人清零则好人胜；狼人数量不少于存活好人则狼人胜。' },
])
const identityOptions: Array<{ id: IdentityAssignMode; title: string; desc: string }> = [
  { id: 'random', title: '裁判随机', desc: '按人数生成标准身份结构，快速开局。' },
  { id: 'semi-random', title: '均衡随机', desc: '保留角色偏好，优先保证阵营结构。' },
  { id: 'manual', title: '手动指定', desc: '逐个指定身份，适合测试特定剧本。' },
]

function buildRolePlan(count: number): string[] {
  const plans: Record<number, string[]> = {
    6: ['werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'villager'],
    7: ['werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'guard', 'villager'],
    8: ['werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'guard', 'villager', 'villager'],
    9: ['werewolf', 'werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'guard', 'villager', 'villager'],
    10: ['werewolf', 'werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'guard', 'villager', 'villager', 'villager'],
    11: ['werewolf', 'werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'guard', 'idiot', 'villager', 'villager', 'villager'],
    12: ['werewolf', 'werewolf', 'werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'guard', 'villager', 'villager', 'villager', 'villager'],
  }
  const base = [...(plans[Math.min(12, Math.max(6, count))] || plans[10])]
  while (base.length < count) base.push(base.filter((id) => id === 'werewolf').length < Math.ceil(count / 4) ? 'werewolf' : 'villager')
  return base.slice(0, count)
}
function roleCount(roleId: string) { return rolePlan.value.filter((id) => id === roleId).length }
function syncManualRoles() {
  const next: Record<string, string> = {}
  for (const char of selectedCharacters.value) next[char.id] = manualRoles.value[char.id] || defaultRoleForIndex(Object.keys(next).length)
  manualRoles.value = next
}
function defaultRoleForIndex(index: number): string { return rolePlan.value[index] || 'villager' }
watch(selectedCharacters, () => { if (identityMode.value === 'manual') syncManualRoles() })
watch(identityMode, (value) => { if (value === 'manual') syncManualRoles() })

async function load(options: { refresh?: boolean } = {}) {
  if (options.refresh) refreshing.value = true
  else loading.value = true
  error.value = ''
  try {
    const preset = arenaSession.getCreatePreset()
    const selectedMode = preset?.gameModeId || arenaSession.getSelectedMode() || 'werewolf'
    if (selectedMode !== 'werewolf') arenaSession.setSelectedMode('werewolf')
    mode.value = werewolfMode
    settings.value = await settingsService.get()
    identityMode.value = preset?.identityAssignMode || settings.value.defaultIdentityAssignMode || 'random'
    if (preset?.manualRoles) manualRoles.value = { ...preset.manualRoles }
    const list = await characterService.list({ status: 'enabled' })
    const presetParam = route.value.path.includes('?') ? route.value.path.split('?')[1] : ''
    const queryIds = new URLSearchParams(presetParam).get('characters')?.split(',').filter(Boolean) || []
    const presetIds = preset?.characterIds?.length ? preset.characterIds : queryIds
    const autoSelectCount = Math.min(mode.value.recommendedPlayers, list.length)
    characters.value = list.map((char, index) => ({ ...char, selected: presetIds.length ? presetIds.includes(char.id) : index < autoSelectCount }))
    if (identityMode.value === 'manual') syncManualRoles()
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    loading.value = false
    refreshing.value = false
  }
}
function toggleCharacter(char: SelectableCharacter) {
  if (char.selected) { char.selected = false; error.value = ''; return }
  if (selectedCount.value >= mode.value.maxPlayers) { error.value = '最多选择 ' + mode.value.maxPlayers + ' 名角色'; playArenaTone('warn'); return }
  char.selected = true
  error.value = ''
  playArenaTone('click')
}
function selectRecommended() { const target = Math.min(mode.value.recommendedPlayers, characters.value.length); characters.value = characters.value.map((item, index) => ({ ...item, selected: index < target })); error.value = ''; playArenaTone('step') }
function selectAllPossible() { characters.value = characters.value.map((item, index) => ({ ...item, selected: index < mode.value.maxPlayers })); error.value = ''; playArenaTone('step') }
function clearSelection() { characters.value = characters.value.map((item) => ({ ...item, selected: false })); error.value = '' }
function setManualRole(characterId: string, roleId: string) { manualRoles.value = { ...manualRoles.value, [characterId]: roleId } }
async function startMatch() {
  if (!canStart.value) { error.value = warnings.value[0] || '请先完成开局配置'; playArenaTone('warn'); return }
  if (identityMode.value === 'manual') {
    syncManualRoles()
    const wolfCount = selectedCharacters.value.filter((item) => manualRoles.value[item.id] === 'werewolf').length
    if (wolfCount < 1) { error.value = '手动分配至少需要 1 名狼人'; playArenaTone('warn'); return }
  }
  starting.value = true
  error.value = ''
  try {
    if (settings.value.matchDefaults.pauseOnLowBalance || settings.value.balanceReminder) {
      const balance = await billingService.getBalanceCents(true)
      if (balance !== null && balance < settings.value.balanceReminderThresholdCents && settings.value.matchDefaults.pauseOnLowBalance) {
        error.value = '当前余额低于 ' + (settings.value.balanceReminderThresholdCents / 100).toFixed(2) + ' 元，请补充余额后再开局。'
        playArenaTone('warn')
        return
      }
    }
    const created = await matchService.create({ gameModeId: 'werewolf', characterIds: selectedCharacters.value.map((item) => item.id), identityAssignMode: identityMode.value, manualRoles: identityMode.value === 'manual' ? manualRoles.value : undefined })
    arenaSession.clearSelectedMode()
    arenaSession.clearCreatePreset()
    playArenaTone('success')
    await matchWindowService.open(created.id)
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    starting.value = false
  }
}
onMounted(() => void load())
</script>

<template>
  <ArenaPageShell class="create-page">
    <div class="create-root">
      <section class="create-hero">
        <div>
          <span class="create-eyebrow"><Swords :size="15" /> 狼人杀开局控制台</span>
          <h1>公开规则，选择角色，交给裁判开局</h1>
          <p>{{ mode.setupSummary }}</p>
        </div>
        <button type="button" class="soft-action" :disabled="refreshing" @click="load({ refresh: true })"><Loader2 v-if="refreshing" :size="15" class="spin" /><RefreshCw v-else :size="15" />刷新角色</button>
      </section>
      <ArenaPageState :loading="loading" skeleton="create-match" loading-label="正在整理开局资料..." @retry="() => load()">
        <main class="create-board">
        <aside class="mode-panel glass-panel">
          <div class="mode-cover"><img :src="modeImageById(mode.id)" :alt="mode.name" /><span><Lock :size="13" /> 当前仅开放狼人杀</span></div>
          <div class="mode-title"><span>当前玩法</span><h2>{{ mode.name }}</h2><p>{{ mode.description }}</p></div>
          <div class="mode-stats"><span><Users :size="14" /> {{ mode.minPlayers }}-{{ mode.maxPlayers }} 人</span><span>{{ mode.estimatedDurationMinutes }} 分钟</span><span>约 {{ formatYuan(mode.estimatedCostPerPlayerCents) }}/人</span></div>
          <div class="rule-list"><article v-for="item in rules" :key="item.title"><component :is="item.icon" :size="17" /><div><strong>{{ item.title }}</strong><p>{{ item.desc }}</p></div></article></div>
        </aside>
        <section class="pick-panel glass-panel">
          <div class="panel-head"><div><span>参赛角色</span><h2>{{ selectedCount }} / {{ mode.recommendedPlayers }} 推荐</h2></div><div class="quick-actions"><button type="button" @click="selectRecommended">推荐阵容</button><button type="button" @click="selectAllPossible">选满</button><button type="button" @click="clearSelection">清空</button></div></div>
          <div class="filter-tabs"><button type="button" :class="{ active: selectedFilter === 'all' }" @click="selectedFilter = 'all'">全部 {{ characters.length }}</button><button type="button" :class="{ active: selectedFilter === 'selected' }" @click="selectedFilter = 'selected'">已选 {{ selectedCount }}</button><button type="button" :class="{ active: selectedFilter === 'unselected' }" @click="selectedFilter = 'unselected'">未选 {{ characters.length - selectedCount }}</button></div>
          <div v-if="!characters.length" class="empty-pick"><AlertCircle :size="28" /><strong>还没有可用角色</strong><p>创建并启用至少 {{ mode.minPlayers }} 名角色后，就可以开始狼人杀对局。</p><button type="button" @click="navigate('/character-edit/new')">创建角色</button></div>
          <div v-else class="character-grid"><article v-for="char in filteredCharacters" :key="char.id" class="char-tile" :class="{ selected: char.selected }" @click="toggleCharacter(char)"><div class="char-avatar" :style="{ background: 'linear-gradient(135deg, ' + char.accentColor + '44, ' + char.accentColor + '16)' }"><img :src="characterAvatarByName(char.name, 0, char.modelId, char.avatarUrl)" :alt="char.name" /><span v-if="char.selected"><Check :size="16" /></span></div><div class="char-info"><strong>{{ char.name }}</strong><p>{{ char.subtitle || char.speechStyle }}</p><div><em v-for="tag in char.tags.slice(0, 2)" :key="tag">{{ tag }}</em></div></div></article></div>
        </section>
        <aside class="launch-panel glass-panel">
          <div class="panel-head launch-head"><div><span>开局配置</span><h2>{{ canStart ? '可以开局' : '还差一点' }}</h2></div><Sparkles :size="22" /></div>
          <div class="identity-switch"><button v-for="item in identityOptions" :key="item.id" type="button" :class="{ active: identityMode === item.id }" @click="identityMode = item.id"><b>{{ item.title }}</b><span>{{ item.desc }}</span></button></div>
          <div class="summary-card"><span>身份结构</span><strong>{{ roleSummary }}</strong><p>身份会在开局后写入每个 AI 的私有视角；准备阶段公开的是本局会使用的规则和技能。</p></div>
          <section class="role-config"><div class="role-config-head"><strong>公开身份与技能</strong><span>{{ selectedCount || mode.recommendedPlayers }} 人模板</span></div><article v-for="role in roleCards" :key="role.id" :class="['role-card', 'role-' + role.camp]"><div><b>{{ role.name }}</b><em v-if="roleCount(role.id)">x{{ roleCount(role.id) }}</em><small v-if="role.isGod">神职</small></div><p>{{ role.skillName }}：{{ role.skillDescription }}</p><span>{{ role.timing }} · {{ role.publicInfo }}</span></article></section>
          <div v-if="identityMode === 'manual'" class="manual-roles"><article v-for="char in selectedCharacters" :key="char.id"><span>{{ char.name }}</span><div><button v-for="role in mode.roles" :key="role.id" type="button" :class="{ active: manualRoles[char.id] === role.id }" @click="setManualRole(char.id, role.id)">{{ role.name }}</button></div></article></div>
          <div class="launch-metrics"><div><span>预计消耗</span><strong>{{ formatYuan(estimatedCost) }}</strong></div><div><span>警长玩法</span><strong>开启</strong></div><div><span>自动推进</span><strong>{{ settings.matchDefaults.autoAdvance ? '开' : '关' }}</strong></div></div>
          <div v-if="warnings.length || error" class="warning-box"><AlertCircle :size="16" /><div><p v-if="error">{{ error }}</p><p v-for="item in warnings" :key="item">{{ item }}</p></div></div>
          <button type="button" class="start-button" :disabled="!canStart" @click="startMatch"><Loader2 v-if="starting" :size="20" class="spin" /><Play v-else :size="20" />{{ starting ? '正在开局' : '开始对局' }}<ChevronRight :size="18" /></button>
        </aside>
      </main>
      </ArenaPageState>
    </div>
  </ArenaPageShell>
</template>

<style scoped>
.create-page :deep(.aa-page-inner) { max-width: none; height: 100%; padding: 30px 38px 22px; overflow: hidden; }
.create-root { height: 100%; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 16px; }
.create-hero { min-height: 104px; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.create-eyebrow { width: max-content; display: inline-flex; align-items: center; gap: 7px; padding: 6px 11px; border-radius: 999px; color: #694ff5; background: rgba(119, 88, 255, .1); font-size: 13px; font-weight: 700; }
.create-hero h1 { margin: 10px 0 8px; color: #141452; font-size: 32px; line-height: 1.08; font-weight: 720; letter-spacing: 0; }
.create-hero p { max-width: 840px; margin: 0; color: #625b8e; font-size: 14px; line-height: 1.65; }
.soft-action { height: 42px; padding: 0 16px; display: inline-flex; align-items: center; gap: 8px; border: 1px solid rgba(128, 111, 194, .15); border-radius: 15px; color: #5948d7; background: rgba(255,255,255,.64); cursor: pointer; transition: 180ms ease; }
.soft-action:hover:not(:disabled) { transform: translateY(-2px); background: rgba(255,255,255,.9); box-shadow: 0 14px 30px rgba(86,70,160,.12); }
.create-board { min-height: 0; display: grid; grid-template-columns: 294px minmax(0, 1fr) 410px; gap: 16px; align-items: stretch; }
.glass-panel { min-height: 0; border-radius: 26px; background: linear-gradient(145deg, rgba(255,255,255,.8), rgba(249,247,255,.66)); border: 1px solid rgba(255,255,255,.78); box-shadow: inset 0 1px 0 rgba(255,255,255,.86), 0 24px 58px rgba(84,68,160,.12); backdrop-filter: blur(18px) saturate(1.08); }
.mode-panel, .launch-panel { padding: 15px; overflow: hidden; }
.mode-cover { position: relative; height: 150px; border-radius: 21px; overflow: hidden; }
.mode-cover img { width: 100%; height: 100%; object-fit: cover; transition: transform 480ms cubic-bezier(.16,1,.3,1); }
.mode-panel:hover .mode-cover img { transform: scale(1.05); }
.mode-cover span { position: absolute; left: 11px; top: 11px; display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px; border-radius: 999px; color: #fff; background: rgba(42,31,96,.42); backdrop-filter: blur(10px); font-size: 12px; font-weight: 700; }
.mode-title span, .panel-head span, .summary-card span, .launch-metrics span { color: #8077a5; font-size: 12px; font-weight: 650; }
.mode-title h2, .panel-head h2 { margin: 5px 0 8px; color: #151550; font-size: 22px; line-height: 1.12; }
.mode-title p { margin: 0; color: #665f8e; font-size: 12px; line-height: 1.6; }
.mode-stats { display: grid; gap: 7px; margin: 12px 0; }
.mode-stats span { min-height: 30px; display: flex; align-items: center; gap: 7px; padding: 0 10px; border-radius: 12px; color: #5e55a3; background: rgba(126,99,255,.08); font-size: 12px; }
.rule-list { display: grid; gap: 7px; }
.rule-list article { display: grid; grid-template-columns: 30px minmax(0,1fr); gap: 9px; padding: 9px; border-radius: 15px; background: rgba(255,255,255,.52); }
.rule-list svg { margin-top: 2px; color: #755cff; }
.rule-list strong { color: #24205a; font-size: 13px; }
.rule-list p { margin: 3px 0 0; color: #746d99; font-size: 11px; line-height: 1.45; }
.pick-panel { padding: 17px; display: grid; grid-template-rows: auto auto minmax(0, 1fr); gap: 12px; overflow: hidden; }
.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.quick-actions, .filter-tabs { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.quick-actions button, .filter-tabs button { height: 33px; padding: 0 12px; border: 1px solid rgba(126,99,255,.12); border-radius: 12px; color: #5e52d8; background: rgba(255,255,255,.58); cursor: pointer; transition: 160ms ease; }
.quick-actions button:hover, .filter-tabs button:hover, .filter-tabs button.active { transform: translateY(-1px); background: rgba(126,99,255,.1); border-color: rgba(126,99,255,.24); }
.character-grid { min-height: 0; overflow: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); gap: 11px; padding: 2px 2px 8px; scrollbar-width: none; }
.character-grid::-webkit-scrollbar, .manual-roles::-webkit-scrollbar { display: none; }
.char-tile { position: relative; min-height: 196px; padding: 10px; border: 1px solid rgba(126,99,255,.1); border-radius: 21px; background: rgba(255,255,255,.52); cursor: pointer; transition: transform 220ms cubic-bezier(.16,1,.3,1), box-shadow 220ms ease, border-color 220ms ease, background 220ms ease; }
.char-tile:hover { transform: translateY(-5px); background: rgba(255,255,255,.82); box-shadow: 0 20px 38px rgba(82,65,160,.13); }
.char-tile.selected { border-color: rgba(126,99,255,.46); background: linear-gradient(145deg, rgba(255,255,255,.9), rgba(240,235,255,.78)); box-shadow: 0 0 0 2px rgba(126,99,255,.12), 0 18px 40px rgba(82,65,160,.15); }
.char-avatar { position: relative; height: 104px; border-radius: 17px; overflow: hidden; display: grid; place-items: center; }
.char-avatar img { width: 100%; height: 100%; object-fit: cover; }
.char-avatar span { position: absolute; right: 9px; top: 9px; width: 26px; height: 26px; display: grid; place-items: center; border-radius: 999px; color: #fff; background: linear-gradient(135deg, #8d6bff, #5b58f7); box-shadow: 0 8px 18px rgba(91,80,240,.26); }
.char-info { padding: 9px 3px 0; }
.char-info strong { display: block; color: #16154d; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.char-info p { min-height: 34px; margin: 5px 0 8px; color: #756d99; font-size: 12px; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.char-info div { display: flex; flex-wrap: wrap; gap: 5px; }
.char-info em { padding: 4px 7px; border-radius: 999px; color: #6a55e8; background: rgba(126,99,255,.09); font-size: 11px; font-style: normal; }
.launch-panel { display: flex; flex-direction: column; gap: 11px; }
.launch-head svg { color: #725cff; }
.identity-switch { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 7px; }
.identity-switch button { min-height: 62px; padding: 10px; border: 1px solid rgba(126,99,255,.11); border-radius: 17px; background: rgba(255,255,255,.52); text-align: left; cursor: pointer; transition: 180ms ease; }
.identity-switch button:hover { transform: translateY(-2px); background: rgba(255,255,255,.78); }
.identity-switch button.active { border-color: rgba(126,99,255,.42); background: rgba(126,99,255,.1); box-shadow: inset 0 -3px 0 #7e63ff; }
.identity-switch b { display: block; color: #1b1856; font-size: 13px; }
.identity-switch span { display: block; margin-top: 4px; color: #756d99; font-size: 11px; line-height: 1.35; }
.summary-card { padding: 13px; border-radius: 18px; background: linear-gradient(135deg, rgba(126,99,255,.12), rgba(213,139,255,.1)); border: 1px solid rgba(126,99,255,.13); }
.summary-card strong { display: block; margin-top: 6px; color: #1b1856; font-size: 14px; line-height: 1.42; }
.summary-card p { margin: 6px 0 0; color: #746d99; font-size: 12px; line-height: 1.45; }
.role-config { min-height: 0; display: grid; gap: 8px; overflow: auto; padding-right: 2px; scrollbar-width: none; }
.role-config::-webkit-scrollbar { display: none; }
.role-config-head { display: flex; align-items: center; justify-content: space-between; color: #1b1856; font-size: 13px; }
.role-config-head span { color: #8178a5; font-size: 12px; }
.role-card { padding: 10px; border-radius: 16px; background: rgba(255,255,255,.54); border: 1px solid rgba(126,99,255,.1); }
.role-card div { display: flex; align-items: center; gap: 7px; }
.role-card b { color: #17154f; font-size: 13px; }
.role-card em, .role-card small { padding: 2px 7px; border-radius: 999px; color: #7058ef; background: rgba(126,99,255,.1); font-size: 11px; font-style: normal; }
.role-card.role-wolf em { color: #d9467a; background: rgba(217,70,122,.1); }
.role-card p { margin: 6px 0 4px; color: #534a82; font-size: 12px; line-height: 1.42; }
.role-card > span { color: #8a82aa; font-size: 11px; line-height: 1.35; }
.manual-roles { max-height: 142px; overflow: auto; display: grid; gap: 8px; padding-right: 2px; scrollbar-width: none; }
.manual-roles article { padding: 9px; border-radius: 15px; background: rgba(255,255,255,.52); }
.manual-roles article > span { display: block; margin-bottom: 7px; color: #201c59; font-size: 13px; font-weight: 700; }
.manual-roles article div { display: flex; gap: 6px; flex-wrap: wrap; }
.manual-roles button { height: 27px; padding: 0 9px; border: 1px solid rgba(126,99,255,.12); border-radius: 999px; color: #665e8d; background: rgba(255,255,255,.55); cursor: pointer; }
.manual-roles button.active { color: #fff; border-color: transparent; background: linear-gradient(135deg, #8d6bff, #5b58f7); }
.launch-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.launch-metrics div { padding: 9px; border-radius: 15px; background: rgba(255,255,255,.52); }
.launch-metrics strong { display: block; margin-top: 5px; color: #191653; font-size: 15px; }
.warning-box { display: grid; grid-template-columns: 18px minmax(0,1fr); gap: 8px; padding: 10px; border-radius: 15px; color: #b64b70; background: rgba(255,241,247,.72); border: 1px solid rgba(213,88,130,.12); font-size: 12px; line-height: 1.45; }
.warning-box p { margin: 0 0 4px; }
.start-button { margin-top: auto; height: 56px; display: flex; align-items: center; justify-content: center; gap: 10px; border: 0; border-radius: 21px; color: #fff; background: linear-gradient(135deg, #8d6bff, #5b58f7); box-shadow: 0 18px 36px rgba(91,80,240,.28); font-size: 18px; font-weight: 760; cursor: pointer; transition: 180ms ease; }
.start-button:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 22px 44px rgba(91,80,240,.34); }
.start-button:disabled { opacity: .52; cursor: not-allowed; box-shadow: none; }
.empty-pick, .create-state { min-height: 0; display: grid; place-items: center; align-content: center; gap: 10px; color: #746d99; text-align: center; }
.empty-pick strong { color: #17154f; font-size: 18px; }
.empty-pick p { max-width: 360px; margin: 0; line-height: 1.7; }
.empty-pick button { height: 40px; padding: 0 16px; border: 0; border-radius: 14px; color: #fff; background: linear-gradient(135deg, #8d6bff, #5b58f7); cursor: pointer; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 1320px) { .create-board { grid-template-columns: 270px minmax(0,1fr) 370px; } .create-page :deep(.aa-page-inner) { padding-inline: 28px; } .create-hero h1 { font-size: 29px; } }
</style>
