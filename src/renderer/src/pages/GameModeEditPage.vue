<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Loader2, RotateCcw } from 'lucide-vue-next'
import ArenaPageShell from '@renderer/components/arena/ArenaPageShell.vue'
import ArenaPageState from '@renderer/components/arena/ArenaPageState.vue'
import { modeBadges, modeImageById } from '@renderer/data/arena-visual-assets'
import { goBack, navigate, route } from '../router'
import {
  formatUserMessage,
  gameModeService,
  getBuiltinGameMode,
  loadGameModeOverrides,
} from '@renderer/services/arena'
import type { GameModeOverride } from '@shared/arena/types'

const loading = ref(true)
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

const modeId = computed(() => route.value.id || '')
const builtin = computed(() => (modeId.value ? getBuiltinGameMode(modeId.value) : null))

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
}

async function load() {
  if (!modeId.value) return
  loading.value = true
  error.value = ''
  try {
    await loadGameModeOverrides()
    const mode = gameModeService.get(modeId.value)
    if (!mode) {
      error.value = '玩法不存在'
      return
    }
    fillFromMode(mode)
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    loading.value = false
  }
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
  }
}

async function saveMode() {
  if (!modeId.value) return
  if (!name.value.trim()) {
    error.value = '玩法名称不能为空'
    return
  }
  if (minPlayers.value > maxPlayers.value) {
    error.value = '最少人数不能大于最多人数'
    return
  }
  saving.value = true
  error.value = ''
  try {
    await gameModeService.saveOverride(modeId.value, buildOverride())
    navigate(`/game-mode-detail/${modeId.value}`)
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    saving.value = false
  }
}

async function resetToBuiltin() {
  if (!modeId.value || !builtin.value) return
  if (!window.confirm('确定恢复为内置默认配置吗？你的自定义修改将被清除。')) return
  saving.value = true
  error.value = ''
  try {
    await gameModeService.clearOverride(modeId.value)
    fillFromMode(builtin.value)
    navigate(`/game-mode-detail/${modeId.value}`)
  } catch (err) {
    error.value = formatUserMessage(err)
    saving.value = false
  }
}

watch(modeId, () => void load())
onMounted(() => void load())
</script>

<template>
  <ArenaPageShell class="edit-page">
    <ArenaPageState :loading="loading" skeleton="edit-2col" loading-label="正在打开玩法配置..." @retry="load">
      <section class="edit-layout">
      <aside class="visual-panel">
        <div class="cover-frame">
          <img class="cover" :src="modeImageById(modeId)" :alt="name" />
        </div>
        <div class="identity-card">
          <span class="mode-badge">{{ modeBadges[modeId] || '玩' }}</span>
          <div>
            <h2>{{ name || '玩法名称' }}</h2>
            <p>{{ subtitle || '副标题' }}</p>
          </div>
        </div>
      </aside>

      <main class="edit-panel">
        <div class="editor-command-bar">
          <div>
            <strong>编辑玩法</strong>
            <span>更改会保存到本地玩法配置</span>
          </div>
          <div class="sticky-actions sticky-actions--top">
            <button type="button" :disabled="saving" @click="resetToBuiltin">
              <RotateCcw :size="16" />
              恢复默认
            </button>
            <button type="button" @click="goBack()">取消</button>
            <button class="primary" type="button" :disabled="saving" @click="saveMode">
              {{ saving ? '保存中…' : '保存配置' }}
            </button>
          </div>
        </div>

        <div v-if="error" class="error-box">{{ error }}</div>

        <section class="composer-card">
          <div class="section-title"><span>基础信息</span></div>
          <div class="field-line">
            <label><span>玩法名称</span><input v-model="name" class="field" maxlength="20" /></label>
            <label><span>副标题</span><input v-model="subtitle" class="field" maxlength="36" /></label>
          </div>
          <label class="wide-line"><span>玩法描述</span><textarea v-model="description" class="field" rows="3" /></label>
        </section>

        <section class="composer-card">
          <div class="section-title"><span>人数与费用</span></div>
          <div class="field-line">
            <label><span>最少人数</span><input v-model.number="minPlayers" class="field compact-field" type="number" min="2" max="30" /></label>
            <label><span>最多人数</span><input v-model.number="maxPlayers" class="field compact-field" type="number" min="2" max="30" /></label>
            <label><span>推荐人数</span><input v-model.number="recommendedPlayers" class="field compact-field" type="number" min="2" max="30" /></label>
          </div>
          <div class="field-line">
            <label><span>每人预估费用（分）</span><input v-model.number="estimatedCostPerPlayerCents" class="field compact-field" type="number" min="1" /></label>
            <label><span>预估时长（分钟）</span><input v-model.number="estimatedDurationMinutes" class="field compact-field" type="number" min="5" /></label>
          </div>
        </section>

        <section class="composer-card">
          <div class="section-title"><span>规则文案</span><small>会用于玩法详情展示与对局说明</small></div>
          <label class="wide-line"><span>开局说明</span><textarea v-model="setupSummary" class="field" rows="3" /></label>
          <label class="wide-line"><span>警长规则</span><textarea v-model="sheriffRule" class="field" rows="2" /></label>
          <label class="wide-line"><span>规则要点（每行一条）</span><textarea v-model="ruleHighlightsText" class="field" rows="8" /></label>
        </section>

        <footer class="sticky-actions sticky-actions--bottom">
          <button type="button" :disabled="saving" @click="resetToBuiltin">
            <RotateCcw :size="16" />
            恢复默认
          </button>
          <button type="button" @click="goBack()">取消</button>
          <button class="primary" type="button" :disabled="saving" @click="saveMode">
            {{ saving ? '保存中…' : '保存配置' }}
          </button>
        </footer>
      </main>
    </section>
    </ArenaPageState>
  </ArenaPageShell>
</template>

<style scoped>
.edit-page :deep(.aa-page-inner) {
  max-width: none;
  height: 100%;
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  padding: 26px 34px 16px;
  overflow: hidden;
}

.edit-layout {
  min-height: 0;
  overflow: hidden;
  display: grid;
  grid-template-columns: 354px minmax(0, 1fr);
  gap: 18px;
}

.visual-panel,
.edit-panel,
.composer-card {
  border: 1px solid rgba(255, 255, 255, 0.74);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.66);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 24px 52px rgba(91, 101, 174, 0.11);
  backdrop-filter: blur(22px);
}

.visual-panel {
  min-height: 0;
  overflow: hidden;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
}

.cover-frame {
  position: relative;
  overflow: hidden;
  margin: 14px;
  border-radius: 21px;
  background: radial-gradient(circle at 50% 8%, rgba(112, 105, 255, 0.18), transparent 58%);
}

.cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.03);
}

.identity-card {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 14px 14px;
  padding: 12px;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.76), rgba(112, 105, 255, 0.12));
}

.mode-badge {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: rgba(112, 105, 255, 0.12);
  color: #5b57f3;
  font-size: 20px;
  font-weight: 700;
  flex-shrink: 0;
}

.identity-card h2 {
  margin: 0 0 5px;
  color: #111a51;
  font-size: 21px;
  font-weight: 660;
}

.identity-card p {
  margin: 0;
  color: #66709d;
  font-size: 13px;
}

.edit-panel {
  min-height: 0;
  overflow: auto;
  padding: 16px 18px 0;
  scrollbar-width: none;
}

.edit-panel::-webkit-scrollbar {
  display: none;
}

.editor-command-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 14px;
}

.editor-command-bar strong {
  display: block;
  color: #17205a;
  font-size: 18px;
}

.editor-command-bar span {
  color: #7a85b0;
  font-size: 12px;
}

.sticky-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.sticky-actions button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 0 13px;
  border: 1px solid rgba(130, 142, 207, 0.15);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.58);
  color: #26305e;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.sticky-actions .primary {
  color: #fff;
  border-color: transparent;
  background: linear-gradient(180deg, #7774ff, #5b57f3);
}

.sticky-actions--bottom {
  position: sticky;
  bottom: 0;
  margin-top: 16px;
  padding: 12px 0 16px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.82) 28%);
}

.error-box {
  margin-bottom: 12px;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(239, 68, 68, 0.08);
  color: #c2410c;
  font-size: 13px;
}

.composer-card {
  padding: 16px 18px;
  margin-bottom: 12px;
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
}

.section-title span {
  color: #17205a;
  font-weight: 680;
}

.section-title small {
  color: #7a85b0;
  font-size: 12px;
}

.field-line {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.wide-line {
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
}

.field-line label,
.wide-line {
  display: grid;
  gap: 6px;
}

.field-line span,
.wide-line span {
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

.compact-field {
  min-width: 0;
}

.edit-state {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #65709f;
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
