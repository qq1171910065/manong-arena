<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  BookOpen,
  DoorOpen,
  FastForward,
  Home,
  Monitor,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  Volume2,
  Wallet,
  X,
  Zap,
} from 'lucide-vue-next'
import { navigate } from '@renderer/router'
import MarkdownContent from '@renderer/components/common/MarkdownContent.vue'
import SettingsSegment from '@renderer/components/settings/SettingsSegment.vue'
import SettingsVolumeRow from '@renderer/components/settings/SettingsVolumeRow.vue'
import { formatUserMessage, gameModeService, matchEngine, matchService, matchWindowService, settingsService } from '@renderer/services/arena'
import type { ArenaSettings, Match } from '@shared/arena/types'

const props = defineProps<{
  match: Match | null
  viewMode: 'god' | 'player'
}>()
const emit = defineEmits<{ updated: []; 'update:viewMode': ['god' | 'player'] }>()

type EscTab = 'control' | 'display' | 'gameplay' | 'audio' | 'balance' | 'roles'

const show = ref(false)
const isMatchRoomWindow = ref(false)
const settings = ref<ArenaSettings>(settingsService.defaults())
const saving = ref(false)
const busy = ref(false)
const error = ref('')
const activeTab = ref<EscTab>('control')

const boolOptions = [
  { label: '开', value: true },
  { label: '关', value: false },
]

const layoutOptions = [
  { label: '标准分栏', value: 'classic' },
  { label: '沉浸圆桌', value: 'immersive' },
]

const viewOptions = [
  { label: '上帝视角', value: 'god' },
  { label: '玩家视角', value: 'player' },
]

const tabMeta: Record<EscTab, { title: string; desc: string }> = {
  control: {
    title: '对局控制',
    desc: '暂停、单步推进与房间进出。打开 ESC 菜单不会自动暂停对局。',
  },
  display: {
    title: '界面与视角',
    desc: '房间版式、观察视角、信息密度与表达标签显示。',
  },
  gameplay: {
    title: '推进节奏',
    desc: '自动推进、轮次衔接、快速节奏与裁判解说风格。',
  },
  audio: {
    title: '声音播报',
    desc: '发言 TTS、裁判播报音量与界面操作音效。',
  },
  balance: {
    title: '余额保护',
    desc: '低余额提醒阈值与余额不足时的暂停策略。',
  },
  roles: {
    title: '身份与规则',
    desc: '当前玩法的身份配置、流程阶段与视角说明。',
  },
}

const mode = computed(() => (props.match ? gameModeService.get(props.match.gameModeId) : null))
const isPaused = computed(() => props.match?.status === 'paused')
const aliveCount = computed(() => props.match?.participants.filter((p) => p.alive === 'alive').length || 0)
const totalCount = computed(() => props.match?.participants.length || 0)
const canControl = computed(() => Boolean(props.match && props.match.status !== 'completed' && props.match.status !== 'archived'))
const currentTab = computed(() => tabMeta[activeTab.value])

const rulesMarkdown = computed(() => {
  const m = mode.value
  if (!m) return '# 身份与规则\n\n暂无玩法规则。'
  const roles = m.roles.map((role) => '- **' + role.name + '**：' + (role.camp === 'wolf' ? '狼人阵营' : role.camp === 'good' ? '好人阵营' : '未知阵营') + '。' + (role.skillName ? '`' + role.skillName + '` ' : '') + (role.skillDescription || role.description || '根据公开发言和票型参与对局。')).join('\n')
  const phases = [...m.phases].sort((a, b) => a.order - b.order).map((phase, index) => (index + 1) + '. **' + phase.name + '**：' + phase.description).join('\n')
  return '# ' + m.name + '规则说明\n\n' + (m.description || '') + '\n\n## 身份配置\n' + roles + '\n\n## 流程阶段\n' + phases + '\n\n## 视角说明\n- 上帝视角可以查看全部身份与思考摘要。\n- 玩家视角只显示公开信息，身份判断由用户自行标记。'
})

const navItems = computed(() => [
  { id: 'control' as const, label: '对局控制', icon: Play },
  { id: 'display' as const, label: '界面与视角', icon: Monitor },
  { id: 'gameplay' as const, label: '推进节奏', icon: Zap },
  { id: 'audio' as const, label: '声音播报', icon: Volume2 },
  { id: 'balance' as const, label: '余额保护', icon: Wallet },
  { id: 'roles' as const, label: '身份与规则', icon: BookOpen },
])

function openMenu() { show.value = true; error.value = '' }
function closeMenu() { show.value = false }
async function loadSettings() { settings.value = await settingsService.get().catch(() => settingsService.defaults()) }
function onSettingsChange(event: Event) {
  const detail = (event as CustomEvent<ArenaSettings>).detail
  if (detail) {
    settings.value = detail
    return
  }
  void loadSettings()
}

async function saveSettings(next: ArenaSettings) {
  saving.value = true
  try {
    settings.value = await settingsService.save(next)
  } finally {
    saving.value = false
  }
}

async function toggleMatchDefault(key: keyof ArenaSettings['matchDefaults']) {
  if (saving.value) return
  if (key === 'judgeTtsEnabled' && !settings.value.ttsEnabled) return
  await saveSettings({
    ...settings.value,
    matchDefaults: { ...settings.value.matchDefaults, [key]: !settings.value.matchDefaults[key] },
  })
}

async function updateSetting<K extends keyof ArenaSettings>(key: K, value: ArenaSettings[K]) {
  if (saving.value) return
  await saveSettings({ ...settings.value, [key]: value })
}

async function setLayout(value: string | boolean) {
  if (saving.value) return
  const layout = value === 'immersive' ? 'immersive' : 'classic'
  const next = {
    ...settings.value,
    matchDefaults: { ...settings.value.matchDefaults, matchRoomLayout: layout },
  }
  settings.value = next
  await saveSettings(next)
}

function setViewMode(value: string | boolean) {
  emit('update:viewMode', value === 'player' ? 'player' : 'god')
}

async function pauseMatch() {
  if (!props.match || busy.value) return
  busy.value = true; error.value = ''
  try { await matchEngine.pause(props.match.id, '玩家在 ESC 菜单中暂停了对局。'); emit('updated') } catch (err) { error.value = formatUserMessage(err) } finally { busy.value = false }
}
async function resumeMatch() {
  if (!props.match || busy.value) return
  busy.value = true; error.value = ''
  try { await matchEngine.resume(props.match.id); emit('updated'); closeMenu() } catch (err) { error.value = formatUserMessage(err) } finally { busy.value = false }
}
async function stepOnce() {
  if (!props.match || busy.value || props.match.status === 'paused') return
  busy.value = true; error.value = ''
  try { await matchEngine.advanceStep(props.match.id); emit('updated') } catch (err) { error.value = formatUserMessage(err); emit('updated') } finally { busy.value = false }
}
async function goHome() {
  closeMenu()
  if (props.match?.id) {
    await matchEngine.abortAndRollback(props.match.id).catch(() => undefined)
  }
  if (isMatchRoomWindow.value && props.match?.id) {
    await matchWindowService.close(props.match.id)
    return
  }
  navigate('/home')
}
async function leaveRoom() {
  closeMenu()
  if (props.match?.id) {
    await matchEngine.abortAndRollback(props.match.id).catch(() => undefined)
  }
  if (isMatchRoomWindow.value && props.match?.id) {
    await matchWindowService.close(props.match.id)
    return
  }
  navigate('/home')
}
function onKeyDown(event: KeyboardEvent) { if (event.key === 'Escape') { event.preventDefault(); show.value = !show.value } }

onMounted(async () => {
  isMatchRoomWindow.value = (await matchWindowService.getKind()) === 'match-room'
  await loadSettings()
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('arena:settings-change', onSettingsChange)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('arena:settings-change', onSettingsChange)
})
defineExpose({ openMenu, closeMenu })
</script>

<template>
  <Teleport to="body">
    <Transition name="esc-fade">
      <div v-if="show" class="esc-overlay" @click.self="closeMenu">
        <div class="esc-menu">
          <button type="button" class="esc-menu__close" @click="closeMenu" aria-label="关闭菜单"><X :size="16" /></button>

          <aside class="esc-menu__nav">
            <button
              v-for="item in navItems"
              :key="item.id"
              type="button"
              :class="{ active: activeTab === item.id }"
              @click="activeTab = item.id"
            >
              <component :is="item.icon" :size="16" />
              {{ item.label }}
            </button>
          </aside>

          <section class="esc-menu__content">
            <header class="esc-menu__header">
              <strong>{{ currentTab.title }}</strong>
              <p>{{ currentTab.desc }}</p>
            </header>

            <!-- 对局控制 -->
            <div v-if="activeTab === 'control'" class="esc-panel esc-control">
              <div class="esc-control-hero" :class="{ 'is-paused': isPaused }">
                <div class="esc-control-hero__glow" />
                <div class="esc-control-hero__top">
                  <span class="esc-control-hero__mode">{{ match?.gameModeName || '对局' }}</span>
                  <span class="esc-control-hero__badge" :class="{ 'is-paused': isPaused }">
                    {{ isPaused ? '已暂停' : '运行中' }}
                  </span>
                </div>
                <h3 class="esc-control-hero__title">{{ match?.title || '对局房间' }}</h3>
                <div class="esc-control-hero__meta">
                  <span><Sparkles :size="13" />第 {{ match?.runtime.currentRound || 1 }} 轮</span>
                  <span><ShieldCheck :size="13" />{{ match?.runtime.currentPhaseName || '等待开始' }}</span>
                  <span>{{ aliveCount }}/{{ totalCount }} 在场</span>
                </div>
                <p class="esc-control-hero__hint">
                  {{ isPaused ? '自动推进已停止，点击继续后关闭菜单才会恢复节奏。' : '对局在后台继续运行，只有手动暂停才会停止模型调用。' }}
                </p>
              </div>

              <button
                v-if="isPaused"
                type="button"
                class="esc-control-primary"
                :disabled="busy"
                @click="resumeMatch"
              >
                <Play :size="20" />
                <span><b>继续对局</b><small>恢复自动推进与模型调用</small></span>
              </button>
              <button
                v-else
                type="button"
                class="esc-control-primary esc-control-primary--pause"
                :disabled="busy || !canControl"
                @click="pauseMatch"
              >
                <Pause :size="20" />
                <span><b>暂停对局</b><small>停止后续自动推进与模型调用</small></span>
              </button>

              <div class="esc-control-actions">
                <button type="button" class="esc-control-tile" :disabled="busy || isPaused || !canControl" @click="stepOnce">
                  <FastForward :size="18" />
                  <span><b>推进一步</b><small>手动执行下一动作</small></span>
                </button>
                <button type="button" class="esc-control-tile" @click="goHome">
                  <Home :size="18" />
                  <span><b>返回大厅</b><small>关闭房间窗口</small></span>
                </button>
                <button type="button" class="esc-control-tile esc-control-tile--danger" @click="leaveRoom">
                  <DoorOpen :size="18" />
                  <span><b>退出房间</b><small>离开当前对局</small></span>
                </button>
              </div>
            </div>

            <!-- 界面与视角 -->
            <div v-else-if="activeTab === 'display'" class="esc-panel esc-settings">
              <div class="esc-segment-row">
                <span>
                  <b>房间版式</b>
                  <small>标准分栏保留消息流，沉浸圆桌中央展示发言</small>
                </span>
                <SettingsSegment
                  class="esc-segment-row__control"
                  :model-value="settings.matchDefaults.matchRoomLayout"
                  :options="layoutOptions"
                  @update:model-value="setLayout"
                />
              </div>
              <div class="esc-segment-row">
                <span>
                  <b>观察视角</b>
                  <small>上帝视角可看思考，玩家视角仅公开信息</small>
                </span>
                <SettingsSegment
                  class="esc-segment-row__control"
                  :model-value="viewMode"
                  :options="viewOptions"
                  @update:model-value="setViewMode"
                />
              </div>
              <button type="button" class="esc-toggle" :class="{ active: settings.modelCallHints }" @click="updateSetting('modelCallHints', !settings.modelCallHints)">
                <span><b>模型调用提示</b><small>顶部状态栏显示等待与阶段提示</small></span><i></i>
              </button>
              <button type="button" class="esc-toggle" :class="{ active: settings.compactLayout }" @click="updateSetting('compactLayout', !settings.compactLayout)">
                <span><b>紧凑信息密度</b><small>减少辅助文案，适合熟悉规则的玩家</small></span><i></i>
              </button>
              <button type="button" class="esc-toggle" :class="{ active: settings.matchDefaults.showEmotionTags }" @click="toggleMatchDefault('showEmotionTags')">
                <span><b>情绪标签</b><small>发言旁显示站边、疑点等表达分析</small></span><i></i>
              </button>
            </div>

            <!-- 推进节奏 -->
            <div v-else-if="activeTab === 'gameplay'" class="esc-panel esc-settings">
              <button type="button" class="esc-toggle" :class="{ active: settings.matchDefaults.autoAdvance }" @click="toggleMatchDefault('autoAdvance')">
                <span><b>自动推进</b><small>对局继续时自动执行下一步</small></span><i></i>
              </button>
              <button type="button" class="esc-toggle" :class="{ active: settings.matchDefaults.autoNextRound }" @click="toggleMatchDefault('autoNextRound')">
                <span><b>自动下一轮</b><small>裁判复核后直接进入下一轮</small></span><i></i>
              </button>
              <button type="button" class="esc-toggle" :class="{ active: settings.matchDefaults.fastMode }" @click="toggleMatchDefault('fastMode')">
                <span><b>快速节奏</b><small>缩短自动推进间隔，适合旁观熟手</small></span><i></i>
              </button>
              <button type="button" class="esc-toggle" :class="{ active: settings.matchDefaults.narratorEnabled }" @click="toggleMatchDefault('narratorEnabled')">
                <span><b>裁判解说</b><small>保留更完整的裁判叙事与关键提醒</small></span><i></i>
              </button>
            </div>

            <!-- 声音播报 -->
            <div v-else-if="activeTab === 'audio'" class="esc-panel esc-settings">
              <button type="button" class="esc-toggle" :class="{ active: settings.ttsEnabled }" @click="updateSetting('ttsEnabled', !settings.ttsEnabled)">
                <span><b>发言播报</b><small>按角色音色朗读公开发言</small></span><i></i>
              </button>
              <SettingsVolumeRow
                class="esc-volume"
                :model-value="settings.ttsVolume"
                label="播报音量"
                :hint="`${settings.ttsVolume}%`"
                @update:model-value="(v) => updateSetting('ttsVolume', v)"
              />
              <button
                type="button"
                class="esc-toggle"
                :class="{ active: settings.matchDefaults.judgeTtsEnabled, disabled: !settings.ttsEnabled }"
                :disabled="!settings.ttsEnabled"
                @click="toggleMatchDefault('judgeTtsEnabled')"
              >
                <span><b>裁判播报</b><small>{{ settings.ttsEnabled ? '裁判裁定与阶段公告使用 TTS' : '需先开启发言播报' }}</small></span><i></i>
              </button>
              <button type="button" class="esc-toggle" :class="{ active: settings.sfxEnabled }" @click="updateSetting('sfxEnabled', !settings.sfxEnabled)">
                <span><b>界面音效</b><small>推进、按钮等操作反馈音</small></span><i></i>
              </button>
              <SettingsVolumeRow
                class="esc-volume"
                :model-value="settings.sfxVolume"
                label="音效音量"
                :hint="`${settings.sfxVolume}%`"
                @update:model-value="(v) => updateSetting('sfxVolume', v)"
              />
            </div>

            <!-- 余额保护 -->
            <div v-else-if="activeTab === 'balance'" class="esc-panel esc-settings">
              <button type="button" class="esc-toggle" :class="{ active: settings.matchDefaults.pauseOnLowBalance }" @click="toggleMatchDefault('pauseOnLowBalance')">
                <span><b>低余额暂停</b><small>余额低于阈值时暂停对局推进</small></span><i></i>
              </button>
              <button type="button" class="esc-toggle" :class="{ active: settings.balanceReminder }" @click="updateSetting('balanceReminder', !settings.balanceReminder)">
                <span><b>余额提醒</b><small>余额不足时在界面显示提醒</small></span><i></i>
              </button>
              <SettingsVolumeRow
                class="esc-volume"
                :model-value="settings.balanceReminderThresholdCents"
                label="提醒阈值"
                :hint="`${(settings.balanceReminderThresholdCents / 100).toFixed(2)} 元`"
                :min="100"
                :max="5000"
                :step="100"
                @update:model-value="(v) => updateSetting('balanceReminderThresholdCents', v)"
              />
            </div>

            <!-- 身份与规则 -->
            <div v-else class="esc-panel esc-roles esc-rules-markdown">
              <MarkdownContent :source="rulesMarkdown" />
            </div>

            <p v-if="error" class="esc-error">{{ error }}</p>
            <div class="esc-menu__hint">按 ESC 关闭 · 局内设置同步至设置中心</div>
          </section>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.esc-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  background: rgba(17, 14, 55, 0.58);
  -webkit-app-region: no-drag;
  pointer-events: auto;
}

.esc-menu {
  position: relative;
  width: min(980px, calc(100vw - 48px));
  height: min(700px, calc(100vh - 40px));
  max-height: calc(100vh - 40px);
  overflow: hidden;
  display: grid;
  grid-template-columns: 196px minmax(0, 1fr);
  gap: 18px;
  padding: 18px;
  border-radius: 30px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(244, 238, 255, 0.92));
  border: 1px solid rgba(255, 255, 255, 0.78);
  box-shadow: 0 34px 96px rgba(42, 35, 116, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.72);
  -webkit-app-region: no-drag;
}

.esc-menu *,
.esc-overlay * {
  -webkit-app-region: no-drag;
}

.esc-menu__close {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 3;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 999px;
  color: #45336f;
  background: rgba(255, 255, 255, 0.75);
  display: grid;
  place-items: center;
  cursor: pointer;
}

.esc-menu__nav {
  padding: 10px;
  border-radius: 23px;
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(126, 99, 255, 0.1);
  display: grid;
  align-content: start;
  gap: 5px;
}

.esc-menu__nav button {
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: #514977;
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 42px;
  padding: 0 11px;
  font-size: 13px;
  font-weight: 740;
  cursor: pointer;
  text-align: left;
}

.esc-menu__nav button:hover,
.esc-menu__nav button.active {
  color: #fff;
  background: linear-gradient(135deg, #9270ff, #6b5cff);
  box-shadow: 0 12px 24px rgba(105, 88, 255, 0.18);
}

.esc-menu__content {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  gap: 14px;
  padding: 8px 8px 4px;
  overflow: hidden;
}

.esc-menu__header {
  padding-right: 44px;
}

.esc-menu__header strong {
  display: block;
  color: #171145;
  font-size: 24px;
  line-height: 1.2;
}

.esc-menu__header p {
  margin: 8px 0 0;
  color: #746c97;
  font-size: 13px;
  line-height: 1.55;
  max-width: 620px;
}

.esc-panel {
  min-height: 0;
  max-height: 100%;
  overflow: auto;
  scrollbar-width: none;
  padding-right: 2px;
}

.esc-panel::-webkit-scrollbar {
  display: none;
}

/* ── 对局控制 ── */
.esc-control {
  display: grid;
  gap: 12px;
  align-content: start;
}

.esc-control-hero {
  position: relative;
  overflow: hidden;
  padding: 18px 18px 16px;
  border-radius: 24px;
  background: linear-gradient(135deg, rgba(246, 243, 255, 0.95), rgba(255, 255, 255, 0.82));
  border: 1px solid rgba(126, 99, 255, 0.14);
  box-shadow: 0 18px 44px rgba(73, 58, 130, 0.1);
}

.esc-control-hero.is-paused {
  background: linear-gradient(135deg, rgba(255, 248, 235, 0.95), rgba(255, 255, 255, 0.84));
  border-color: rgba(235, 166, 65, 0.22);
}

.esc-control-hero__glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 88% 12%, rgba(141, 107, 255, 0.14), transparent 42%);
  pointer-events: none;
}

.esc-control-hero.is-paused .esc-control-hero__glow {
  background: radial-gradient(circle at 88% 12%, rgba(235, 166, 65, 0.12), transparent 42%);
}

.esc-control-hero__top {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.esc-control-hero__mode {
  color: #7b739e;
  font-size: 12px;
  font-weight: 700;
}

.esc-control-hero__badge {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(124, 92, 255, 0.12);
  color: #6d54d8;
  font-size: 11px;
  font-weight: 800;
}

.esc-control-hero__badge.is-paused {
  background: rgba(235, 166, 65, 0.16);
  color: #9b6410;
}

.esc-control-hero__title {
  position: relative;
  margin: 10px 0 0;
  color: #171145;
  font-size: 22px;
  line-height: 1.25;
}

.esc-control-hero__meta {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.esc-control-hero__meta span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(126, 99, 255, 0.1);
  color: #5f5780;
  font-size: 11px;
  font-weight: 700;
}

.esc-control-hero__hint {
  position: relative;
  margin: 12px 0 0;
  color: #6b638a;
  font-size: 12px;
  line-height: 1.55;
}

.esc-control-primary {
  width: 100%;
  min-height: 64px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 18px;
  border: 0;
  border-radius: 20px;
  color: #fff;
  background: linear-gradient(135deg, #8d6bff, #5c5cff);
  box-shadow: 0 18px 38px rgba(99, 88, 255, 0.28);
  cursor: pointer;
  text-align: left;
}

.esc-control-primary--pause {
  background: linear-gradient(135deg, #ffb347, #e8941a);
  box-shadow: 0 18px 38px rgba(210, 140, 40, 0.24);
}

.esc-control-primary:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.esc-control-primary span {
  display: grid;
  gap: 3px;
}

.esc-control-primary b {
  font-size: 16px;
}

.esc-control-primary small {
  color: rgba(255, 255, 255, 0.82);
  font-size: 12px;
}

.esc-control-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.esc-control-tile {
  min-height: 88px;
  display: grid;
  justify-items: start;
  align-content: center;
  gap: 10px;
  padding: 14px;
  border: 1px solid rgba(125, 107, 178, 0.14);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.62);
  color: #27205a;
  cursor: pointer;
  text-align: left;
  transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
}

.esc-control-tile:hover:not(:disabled) {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 12px 28px rgba(73, 58, 130, 0.1);
}

.esc-control-tile:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.esc-control-tile svg {
  color: #7a5cff;
}

.esc-control-tile span {
  display: grid;
  gap: 3px;
}

.esc-control-tile b {
  font-size: 13px;
  color: #211950;
}

.esc-control-tile small {
  color: #7f779f;
  font-size: 11px;
  line-height: 1.4;
}

.esc-control-tile--danger svg {
  color: #d05888;
}

.esc-control-tile--danger b {
  color: #b63f6f;
}

/* ── 设置项 ── */
.esc-roles {
  padding: 14px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.54);
  border: 1px solid rgba(126, 99, 255, 0.1);
}

.esc-rules-markdown :deep(.markdown-content) {
  font-size: 13px;
}

.esc-rules-markdown :deep(.markdown-content__heading) {
  color: #211950;
}

.esc-rules-markdown :deep(.markdown-content__paragraph),
.esc-rules-markdown :deep(.markdown-content__list) {
  color: #5f5780;
}

.esc-settings {
  display: grid;
  gap: 8px;
  align-content: start;
}

.esc-segment-row {
  width: 100%;
  min-height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 12px;
  border-radius: 17px;
  background: rgba(255, 255, 255, 0.58);
  color: #27205a;
}

.esc-segment-row span {
  display: grid;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.esc-segment-row b {
  font-size: 13px;
  color: #211950;
}

.esc-segment-row small {
  display: block;
  color: #7f779f;
  font-size: 12px;
  line-height: 1.45;
}

.esc-segment-row__control {
  flex: 0 0 auto;
}

.esc-volume {
  padding: 0 4px;
}

.esc-toggle {
  width: 100%;
  min-height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 12px;
  border: 0;
  border-radius: 17px;
  background: rgba(255, 255, 255, 0.58);
  color: #27205a;
  text-align: left;
  cursor: pointer;
}

.esc-toggle.disabled,
.esc-toggle:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.esc-toggle span {
  display: grid;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.esc-toggle b {
  font-size: 13px;
}

.esc-toggle small {
  display: block;
  color: #7f779f;
  font-size: 12px;
  line-height: 1.45;
}

.esc-toggle i {
  position: relative;
  width: 42px;
  height: 24px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: rgba(121, 112, 160, 0.22);
}

.esc-toggle i::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 4px 10px rgba(40, 30, 90, 0.16);
  transition: transform 180ms ease;
}

.esc-toggle.active i {
  background: linear-gradient(135deg, #8f69ff, #5e5af7);
}

.esc-toggle.active i::after {
  transform: translateX(18px);
}

.esc-error,
.esc-menu__hint {
  color: #8b83aa;
  font-size: 12px;
}

.esc-error {
  color: #bd3f72;
}

.esc-menu__hint {
  text-align: center;
}

.esc-fade-enter-active,
.esc-fade-leave-active {
  transition: opacity 180ms ease;
}

.esc-fade-enter-active .esc-menu,
.esc-fade-leave-active .esc-menu {
  transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 180ms ease;
}

.esc-fade-enter-from,
.esc-fade-leave-to {
  opacity: 0;
}

.esc-fade-enter-from .esc-menu,
.esc-fade-leave-to .esc-menu {
  transform: translateY(10px) scale(0.96);
  opacity: 0;
}

@media (max-width: 820px) {
  .esc-control-actions {
    grid-template-columns: 1fr;
  }
}
</style>
