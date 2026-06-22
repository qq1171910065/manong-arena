<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { DoorOpen, FastForward, Home, Pause, Play, Settings2, Sparkles, Users, X } from 'lucide-vue-next'
import { navigate } from '@renderer/router'
import MarkdownContent from '@renderer/components/common/MarkdownContent.vue'
import { formatUserMessage, gameModeService, matchEngine, matchService, matchWindowService, settingsService } from '@renderer/services/arena'
import type { ArenaSettings, Match } from '@shared/arena/types'

const props = defineProps<{
  match: Match | null
}>()
const emit = defineEmits<{ updated: [] }>()

const show = ref(false)
const isMatchRoomWindow = ref(false)
const settings = ref<ArenaSettings>(settingsService.defaults())
const saving = ref(false)
const busy = ref(false)
const error = ref('')
const activeTab = ref<'control' | 'roles' | 'settings'>('control')

const title = computed(() => props.match?.title || '对局菜单')
const mode = computed(() => (props.match ? gameModeService.get(props.match.gameModeId) : null))
const isPaused = computed(() => props.match?.status === 'paused')
const aliveCount = computed(() => props.match?.participants.filter((p) => p.alive === 'alive').length || 0)
const canControl = computed(() => Boolean(props.match && props.match.status !== 'completed' && props.match.status !== 'archived'))
const rulesMarkdown = computed(() => {
  const m = mode.value
  if (!m) return '# 身份与规则\n\n暂无玩法规则。'
  const roles = m.roles.map((role) => '- **' + role.name + '**：' + (role.camp === 'wolf' ? '狼人阵营' : role.camp === 'good' ? '好人阵营' : '未知阵营') + '。' + (role.skillName ? '`' + role.skillName + '` ' : '') + (role.skillDescription || role.description || '根据公开发言和票型参与对局。')).join('\n')
  const phases = [...m.phases].sort((a, b) => a.order - b.order).map((phase, index) => (index + 1) + '. **' + phase.name + '**：' + phase.description).join('\n')
  return '# ' + m.name + '规则说明\n\n' + (m.description || '') + '\n\n## 身份配置\n' + roles + '\n\n## 流程阶段\n' + phases + '\n\n## 视角说明\n- 上帝视角可以查看全部身份与思考摘要。\n- 玩家视角只显示公开信息，身份判断由用户自行标记。'
})
const toggles = computed(() => [
  { key: 'autoAdvance', label: '自动推进', desc: '对局继续时自动执行下一步；暂停后不会继续调用模型。' },
  { key: 'autoNextRound', label: '自动下一轮', desc: '裁判复核后直接进入下一轮，不在轮次交界停留。' },
  { key: 'narratorEnabled', label: '裁判解说', desc: '保留更完整的裁判叙事与关键提醒。' },
  { key: 'fastMode', label: '快速节奏', desc: '缩短自动推进间隔，适合熟悉规则的玩家旁观。' },
  { key: 'showEmotionTags', label: '情绪标签', desc: '在玩家发言右侧显示站边、确定性、疑点和信息量等表达分析。' },
] as const)

function openMenu() { show.value = true; error.value = '' }
function closeMenu() { show.value = false }
async function loadSettings() { settings.value = await settingsService.get().catch(() => settingsService.defaults()) }
async function toggleSetting(key: keyof ArenaSettings['matchDefaults']) {
  if (saving.value) return
  saving.value = true
  try {
    const next = { ...settings.value, matchDefaults: { ...settings.value.matchDefaults, [key]: !settings.value.matchDefaults[key] } }
    settings.value = await settingsService.save(next)
  } finally { saving.value = false }
}
async function pauseMatch() {
  if (!props.match || busy.value) return
  busy.value = true; error.value = ''
  try { await matchService.pause(props.match.id, '玩家在 ESC 菜单中暂停了对局。'); emit('updated') } catch (err) { error.value = formatUserMessage(err) } finally { busy.value = false }
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
  if (isMatchRoomWindow.value && props.match?.id) { await matchWindowService.focusMain(); await matchWindowService.close(props.match.id); return }
  navigate('/home')
}
async function leaveRoom() {
  closeMenu()
  if (isMatchRoomWindow.value && props.match?.id) { await matchWindowService.close(props.match.id); return }
  navigate('/match-records')
}
function onKeyDown(event: KeyboardEvent) { if (event.key === 'Escape') { event.preventDefault(); show.value = !show.value } }

onMounted(async () => { isMatchRoomWindow.value = (await matchWindowService.getKind()) === 'match-room'; await loadSettings(); window.addEventListener('keydown', onKeyDown) })
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
defineExpose({ openMenu, closeMenu })
</script>

<template>
  <Teleport to="body">
    <Transition name="esc-fade">
      <div v-if="show" class="esc-overlay" @click.self="closeMenu">
        <div class="esc-menu">
          <button type="button" class="esc-menu__close" @click="closeMenu" aria-label="关闭菜单"><X :size="16" /></button>
          <aside class="esc-menu__nav">
            <div class="esc-room-mark"><Sparkles :size="20" /><span>{{ isPaused ? '已暂停' : '进行中' }}</span></div>
            <button :class="{ active: activeTab === 'control' }" @click="activeTab = 'control'"><Play :size="16" />对局控制</button>
            <button :class="{ active: activeTab === 'roles' }" @click="activeTab = 'roles'"><Users :size="16" />身份与规则</button>
            <button :class="{ active: activeTab === 'settings' }" @click="activeTab = 'settings'"><Settings2 :size="16" />局内设置</button>
          </aside>

          <section class="esc-menu__content">
            <header class="esc-menu__header">
              <span>{{ props.match?.gameModeName || '对局' }} · 第 {{ props.match?.runtime.currentRound || 1 }} 轮</span>
              <strong>{{ title }}</strong>
              <p>{{ props.match?.runtime.currentPhaseName || '等待开始' }} · {{ aliveCount }}/{{ props.match?.participants.length || 0 }} 人在场</p>
            </header>

            <div v-if="activeTab === 'control'" class="esc-panel esc-control">
              <div class="esc-status-card" :class="{ paused: isPaused }">
                <b>{{ isPaused ? '对局已暂停' : '对局正在运行' }}</b>
                <p>{{ isPaused ? '模型调用和自动推进已停止。点击继续后，关闭菜单才会恢复对局节奏。' : '打开 ESC 不会暂停；只有点击暂停才会停止后续自动会话。' }}</p>
              </div>
              <div class="esc-action-grid">
                <button v-if="isPaused" type="button" class="esc-menu__item esc-menu__item--primary" :disabled="busy" @click="resumeMatch"><Play :size="17" />继续对局</button>
                <button v-else type="button" class="esc-menu__item esc-menu__item--primary" :disabled="busy || !canControl" @click="pauseMatch"><Pause :size="17" />暂停对局</button>
                <button type="button" class="esc-menu__item" :disabled="busy || isPaused || !canControl" @click="stepOnce"><FastForward :size="17" />推进一步</button>
                <button type="button" class="esc-menu__item" @click="goHome"><Home :size="17" />返回大厅</button>
                <button type="button" class="esc-menu__item esc-menu__item--danger" @click="leaveRoom"><DoorOpen :size="17" />退出房间</button>
              </div>
            </div>

            <div v-else-if="activeTab === 'roles'" class="esc-panel esc-roles esc-rules-markdown">
              <MarkdownContent :source="rulesMarkdown" />
            </div>

            <div v-else class="esc-panel esc-settings">
              <button v-for="item in toggles" :key="item.key" type="button" class="esc-toggle" :class="{ active: settings.matchDefaults[item.key] }" @click="toggleSetting(item.key)">
                <span><b>{{ item.label }}</b><small>{{ item.desc }}</small></span><i></i>
              </button>
            </div>

            <p v-if="error" class="esc-error">{{ error }}</p>
            <div class="esc-menu__hint">按 ESC 关闭菜单 · 暂停后需要在这里点击继续</div>
          </section>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.esc-overlay { position: fixed; inset: 0; z-index: 9999; display: grid; place-items: center; background: radial-gradient(circle at 48% 35%, rgba(132,95,255,.22), transparent 34%), rgba(17,14,55,.5); backdrop-filter: blur(18px) saturate(1.08); }
.esc-menu { position: relative; width: min(920px, calc(100vw - 56px)); height: min(660px, calc(100vh - 48px)); max-height: calc(100vh - 48px); overflow: hidden; display: grid; grid-template-columns: 210px minmax(0,1fr); gap: 18px; padding: 18px; border-radius: 30px; background: linear-gradient(145deg, rgba(255,255,255,.96), rgba(244,238,255,.92)); border: 1px solid rgba(255,255,255,.78); box-shadow: 0 34px 96px rgba(42,35,116,.32), inset 0 1px 0 rgba(255,255,255,.72); }
.esc-menu__close { position: absolute; top: 18px; right: 18px; z-index: 3; width: 34px; height: 34px; border: 0; border-radius: 999px; color: #45336f; background: rgba(255,255,255,.75); display: grid; place-items: center; cursor: pointer; }
.esc-menu__nav { padding: 12px; border-radius: 23px; background: rgba(255,255,255,.58); border: 1px solid rgba(126,99,255,.1); display: grid; grid-template-rows: auto repeat(3, 46px) 1fr; gap: 8px; }
.esc-room-mark { display: grid; gap: 8px; place-items: start; margin-bottom: 8px; color: #211950; font-weight: 800; } .esc-room-mark svg { width: 42px; height: 42px; padding: 10px; border-radius: 16px; color: #fff; background: linear-gradient(135deg,#8d6bff,#5d5af7); }
.esc-menu__nav button { border: 0; border-radius: 15px; background: transparent; color: #514977; display: flex; align-items: center; gap: 9px; padding: 0 12px; font-weight: 740; cursor: pointer; } .esc-menu__nav button:hover, .esc-menu__nav button.active { color: #fff; background: linear-gradient(135deg,#9270ff,#6b5cff); box-shadow: 0 12px 24px rgba(105,88,255,.18); }
.esc-menu__content { min-width: 0; min-height: 0; display: grid; grid-template-rows: auto minmax(0,1fr) auto auto; gap: 12px; padding: 8px 8px 4px; overflow: hidden; }
.esc-menu__header { padding-right: 44px; } .esc-menu__header span { color: #7b739e; font-size: 12px; font-weight: 700; } .esc-menu__header strong { display: block; margin-top: 5px; color: #171145; font-size: 25px; line-height: 1.2; } .esc-menu__header p { margin: 7px 0 0; color: #746c97; font-size: 13px; }
.esc-panel { min-height: 0; max-height: 100%; overflow: auto; scrollbar-width: none; padding-right: 2px; } .esc-panel::-webkit-scrollbar { display: none; }
.esc-status-card { padding: 15px; border-radius: 22px; background: rgba(246,243,255,.86); border: 1px solid rgba(126,99,255,.12); } .esc-status-card.paused { background: rgba(255,246,232,.86); border-color: rgba(235,166,65,.22); } .esc-status-card b { font-size: 19px; color: #211950; } .esc-status-card p { margin: 8px 0 0; color: #6b638a; line-height: 1.65; }
.esc-action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
.esc-menu__item { height: 48px; display: flex; align-items: center; justify-content: center; gap: 10px; border: 1px solid rgba(125,107,178,.16); border-radius: 16px; background: rgba(255,255,255,.68); color: #27205a; font-size: 14px; font-weight: 740; cursor: pointer; } .esc-menu__item:disabled { opacity: .48; cursor: not-allowed; } .esc-menu__item--primary { grid-column: 1 / -1; border: 0; color: #fff; background: linear-gradient(135deg,#8d6bff,#5c5cff); box-shadow: 0 16px 34px rgba(99,88,255,.24); } .esc-menu__item--danger { color: #c24c7b; }
.esc-roles { padding: 14px; border-radius: 20px; background: rgba(255,255,255,.54); border: 1px solid rgba(126,99,255,.1); } .esc-rules-markdown :deep(.markdown-content) { font-size: 13px; } .esc-rules-markdown :deep(.markdown-content__heading) { color: #211950; } .esc-rules-markdown :deep(.markdown-content__paragraph), .esc-rules-markdown :deep(.markdown-content__list) { color: #5f5780; }
.esc-settings { display: grid; gap: 8px; align-content: start; } .esc-toggle { width: 100%; min-height: 62px; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 10px 12px; border: 0; border-radius: 17px; background: rgba(255,255,255,.58); color: #27205a; text-align: left; cursor: pointer; } .esc-toggle span { display: grid; gap: 4px; } .esc-toggle b { font-size: 13px; } .esc-toggle small { color: #7f779f; font-size: 12px; line-height: 1.45; } .esc-toggle i { position: relative; width: 42px; height: 24px; flex: 0 0 auto; border-radius: 999px; background: rgba(121,112,160,.22); } .esc-toggle i::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 4px 10px rgba(40,30,90,.16); transition: transform 180ms ease; } .esc-toggle.active i { background: linear-gradient(135deg,#8f69ff,#5e5af7); } .esc-toggle.active i::after { transform: translateX(18px); }
.esc-empty, .esc-error, .esc-menu__hint { color: #8b83aa; font-size: 12px; } .esc-error { color: #bd3f72; } .esc-menu__hint { text-align: center; }
.esc-fade-enter-active, .esc-fade-leave-active { transition: opacity 180ms ease; } .esc-fade-enter-active .esc-menu, .esc-fade-leave-active .esc-menu { transition: transform 220ms cubic-bezier(.2,.8,.2,1), opacity 180ms ease; } .esc-fade-enter-from, .esc-fade-leave-to { opacity: 0; } .esc-fade-enter-from .esc-menu, .esc-fade-leave-to .esc-menu { transform: translateY(10px) scale(.96); opacity: 0; }
</style>
