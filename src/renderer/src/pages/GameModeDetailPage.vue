<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Download, GraduationCap, HelpCircle, Sparkles, Trash2 } from 'lucide-vue-next'
import ArenaPageShell from '@renderer/components/arena/ArenaPageShell.vue'
import ArenaPageState from '@renderer/components/arena/ArenaPageState.vue'
import GameModeEditDialog, { type GameModeEditSection } from '@renderer/components/arena/GameModeEditDialog.vue'
import GameModeQADialog from '@renderer/components/arena/GameModeQADialog.vue'
import GameModeSystemModelPickerDialog from '@renderer/components/arena/GameModeSystemModelPickerDialog.vue'
import PromptTemplateDialog from '@renderer/components/arena/PromptTemplateDialog.vue'
import PromptTemplateInlinePreview from '@renderer/components/arena/PromptTemplateInlinePreview.vue'
import DetailEditableBlock from '@renderer/components/arena/DetailEditableBlock.vue'
import DetailRailActions from '@renderer/components/arena/DetailRailActions.vue'
import DetailSectionNav from '@renderer/components/arena/DetailSectionNav.vue'
import MarkdownContent from '@renderer/components/common/MarkdownContent.vue'
import { useScrollSpySections } from '@renderer/composables/useScrollSpySections'
import { confirm } from '@renderer/composables/useAppDialog'
import { useGatewayModelLabel } from '@renderer/composables/useGatewayModelLabel'
import { modeBadges, modeImageById } from '@renderer/data/arena-visual-assets'
import { navigate, route } from '../router'
import {
  arenaSession,
  formatUserMessage,
  gameModeService,
  gameScenarioService,
  getFallbackModelId,
  isModePlayable,
  loadGameModeOverrides,
  loadGameScenarios,
  portableDataService,
} from '@renderer/services/arena'
import { splitMarkdownByH2 } from '@renderer/utils/markdown-sections'
import { resolveSpeechDisplayConfig } from '@shared/arena/speech-display'
import type { GameMode } from '@shared/arena/types'
import type { GameScenarioDefinition, PromptPack, PromptSlotId, PromptTemplate, SystemRoleConfig } from '@shared/arena/game-scenario'

type PromptContentSection = {
  id: string
  navLabel: string
  title: string
  hint: string
  templates: PromptTemplate[]
  role?: SystemRoleConfig
}

const mode = ref<GameMode | null>(null)
const scenario = ref<GameScenarioDefinition | null>(null)
const promptPack = ref<PromptPack | null>(null)
const loading = ref(true)
const error = ref('')
const qaOpen = ref(false)
const editOpen = ref(false)
const editSection = ref<GameModeEditSection>('basic')
const systemModelPickerOpen = ref(false)
const promptDialogOpen = ref(false)
const promptDialogTarget = ref<PromptTemplate | null>(null)
const scrollRoot = ref<HTMLElement | null>(null)

const modeId = computed(() => route.value.id || '')
const isAvailable = computed(() => (mode.value ? isModePlayable(mode.value) : false))
const hasCustomConfig = computed(() => (modeId.value ? gameModeService.hasOverride(modeId.value) : false))
const isCustomMode = computed(() => (modeId.value ? gameModeService.isCustom(modeId.value) : false))

const docParts = computed(() => splitMarkdownByH2(scenario.value?.contentDocument || ''))

const promptSlotLabels: Record<string, string> = {
  game_rules: '玩法规则',
  speech: '公开发言',
  vote: '投票',
  judge: '裁判审阅',
  narrator: '解说',
  host: '主持人',
  learning: '深度学习',
  exam: '玩法考试',
  post_game_review: '赛后复盘',
  behavior_adjust: '行为微调',
}

const roleKindLabel: Record<string, string> = {
  judge: '裁判',
  narrator: '解说',
  host: '主持人',
  commentator: '评论员',
}

function templatesForRole(roleId: string): PromptTemplate[] {
  const role = scenario.value?.systemRoles.find((r) => r.id === roleId)
  if (!role || !promptPack.value) return []
  return promptPack.value.templates.filter((t) => role.promptSlotIds.includes(t.slotId))
}

const promptContentSections = computed((): PromptContentSection[] => {
  if (!promptPack.value) return []
  const sections: PromptContentSection[] = []

  for (const role of scenario.value?.systemRoles || []) {
    sections.push({
      id: `prompt-${role.id}`,
      navLabel: role.name,
      title: `${role.name}提示词`,
      hint: `${roleKindLabel[role.kind] || role.kind} · 共用左侧系统模型`,
      templates: templatesForRole(role.id),
      role,
    })
  }

  const gameplaySlots: PromptSlotId[] = ['game_rules', 'speech', 'vote']
  for (const slotId of gameplaySlots) {
    const tpl = promptPack.value.templates.find((t) => t.slotId === slotId)
    if (tpl) {
      sections.push({
        id: `prompt-${tpl.id}`,
        navLabel: promptSlotLabels[slotId] || tpl.name,
        title: `${tpl.name}提示词`,
        hint: '玩家角色在对局交互环节使用',
        templates: [tpl],
      })
    }
  }

  const extraSlots: PromptSlotId[] = ['post_game_review', 'behavior_adjust']
  for (const slotId of extraSlots) {
    const tpl = promptPack.value.templates.find((t) => t.slotId === slotId)
    if (tpl) {
      sections.push({
        id: `prompt-${tpl.id}`,
        navLabel: promptSlotLabels[slotId] || tpl.name,
        title: `${tpl.name}提示词`,
        hint: '赛后复盘与角色成长环节使用',
        templates: [tpl],
      })
    }
  }

  return sections
})

const navTabs = computed(() => {
  const tabs: Array<{ id: string; label: string }> = [
    { id: 'profile', label: '玩法档案' },
    { id: 'players', label: '人数与费用' },
    { id: 'rules', label: '规则文案' },
  ]
  for (const section of promptContentSections.value) {
    tabs.push({ id: section.id, label: section.navLabel })
  }
  tabs.push({ id: 'learning-exam', label: '学习与考试' })
  return tabs
})

const { activeSection, scrollToSection, refreshSpy } = useScrollSpySections(navTabs, scrollRoot)

const { modelLabel } = useGatewayModelLabel()

const systemModelId = computed(() => {
  const roles = scenario.value?.systemRoles || []
  const judge = roles.find((role) => role.kind === 'judge')
  const narrator = roles.find((role) => role.kind === 'narrator')
  const host = roles.find((role) => role.kind === 'host')
  return (
    judge?.modelId ||
    narrator?.modelId ||
    host?.modelId ||
    roles.find((role) => role.enabled)?.modelId ||
    roles[0]?.modelId ||
    getFallbackModelId()
  )
})

const phaseSummary = computed(() => {
  if (!mode.value) return ''
  return mode.value.phases.map((p) => p.name).join(' → ')
})

const roleCount = computed(() => mode.value?.roles.length ?? 0)

const resolvedSpeechDisplay = computed(() =>
  mode.value ? resolveSpeechDisplayConfig(mode.value.id, mode.value.speechDisplay) : null
)

const learningTemplate = computed(() => promptPack.value?.templates.find((t) => t.slotId === 'learning'))
const examTemplate = computed(() => promptPack.value?.templates.find((t) => t.slotId === 'exam'))

function openEdit(section: GameModeEditSection) {
  editSection.value = section
  editOpen.value = true
}

function openPromptDialog(template: PromptTemplate) {
  promptDialogTarget.value = template
  promptDialogOpen.value = true
}

async function toggleRoleEnabled(role: SystemRoleConfig) {
  if (!scenario.value?.id) return
  try {
    await gameScenarioService.saveSystemRoleModels(scenario.value.id, [
      {
        id: role.id,
        modelId: role.modelId || systemModelId.value,
        enabled: !role.enabled,
      },
    ])
    await onModeSaved()
  } catch (err) {
    error.value = formatUserMessage(err)
  }
}

async function onModeSaved() {
  const id = modeId.value
  if (!id) return
  try {
    await loadGameModeOverrides()
    mode.value = gameModeService.get(id) || mode.value
    await loadGameScenarios()
    scenario.value = gameScenarioService.getByGameModeId(id) || scenario.value
    promptPack.value = scenario.value
      ? gameScenarioService.getPromptPack(scenario.value.defaultPromptPackId) || null
      : null
  } catch (err) {
    error.value = formatUserMessage(err)
  }
}

async function resetToBuiltin() {
  if (!mode.value || isCustomMode.value) return
  if (!(await confirm({
    title: '恢复默认配置',
    message: '确定恢复为内置默认配置吗？你的自定义修改将被清除。',
    tone: 'warning',
    confirmText: '恢复',
  }))) return
  try {
    await gameModeService.clearOverride(mode.value.id)
    if (scenario.value?.id) {
      await gameScenarioService.clearCustomScenario(scenario.value.id)
    }
    await load()
  } catch (err) {
    error.value = formatUserMessage(err)
  }
}

async function load() {
  const id = modeId.value
  if (!id) {
    mode.value = null
    scenario.value = null
    promptPack.value = null
    error.value = '玩法不存在'
    loading.value = false
    return
  }

  loading.value = true
  error.value = ''
  try {
    mode.value = gameModeService.get(id) || null
    if (!mode.value) {
      scenario.value = null
      promptPack.value = null
      error.value = '玩法不存在'
      return
    }

    try {
      await loadGameModeOverrides()
      mode.value = gameModeService.get(id) || mode.value
    } catch (overrideErr) {
      console.warn('[game-modes] overrides load failed', overrideErr)
    }

    try {
      await loadGameScenarios()
    } catch (scenarioErr) {
      console.warn('[game-scenarios] load failed', scenarioErr)
    }

    scenario.value = gameScenarioService.getByGameModeId(id) || null
    promptPack.value = scenario.value
      ? gameScenarioService.getPromptPack(scenario.value.defaultPromptPackId) || null
      : null
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    loading.value = false
    await nextTick(refreshSpy)
  }
}

function startCreate() {
  if (!mode.value || !isAvailable.value) return
  arenaSession.setSelectedMode(mode.value.id)
  navigate('/create-match')
}

async function exportGameMode() {
  if (!mode.value) return
  try {
    await portableDataService.exportGameMode(mode.value.id)
  } catch (err) {
    error.value = formatUserMessage(err)
  }
}

async function deleteCustomMode() {
  if (!mode.value || !isCustomMode.value) return
  if (!(await confirm({
    title: '删除玩法',
    message: `确定删除玩法「${mode.value.name}」吗？`,
    detail: '关联场景与提示词也会一并删除。',
    tone: 'danger',
    confirmText: '删除',
  }))) return
  try {
    await portableDataService.deleteCustomGameMode(mode.value.id)
    navigate('/game-modes')
  } catch (err) {
    error.value = formatUserMessage(err)
  }
}

function modeBadge(modeItem: GameMode): string {
  return modeBadges[modeItem.id] || modeItem.name.slice(0, 1) || '玩'
}

watch(modeId, () => void load(), { immediate: true })
</script>

<template>
  <ArenaPageShell class="detail-page" viewport-lock>
    <ArenaPageState :loading="loading" :error="error || undefined" skeleton="detail-3col" loading-label="正在打开玩法详情..." @retry="load">
      <section v-if="mode" class="detail-layout">
        <aside class="detail-layout__rail detail-layout__rail--left">
          <div class="aa-detail-float-panel sticky-rail detail-layout__panel">
          <div class="cover-frame">
            <img class="cover" :src="modeImageById(mode.id)" :alt="mode.name" />
            <span v-if="!isAvailable" class="soon-badge">筹备中</span>
          </div>

          <div class="identity-card identity-card--action">
            <span class="mode-badge">{{ mode ? modeBadge(mode) : '' }}</span>
            <button type="button" class="identity-card__copy" @click="openEdit('basic')">
              <div>
                <h2>{{ mode.name }}</h2>
                <p>{{ mode.subtitle || '点击编辑玩法名称与副标题' }}</p>
              </div>
            </button>
          </div>

          <div class="stats-row">
            <div><span>人数</span><strong>{{ mode.minPlayers }}-{{ mode.maxPlayers }}</strong></div>
            <div><span>推荐</span><strong>{{ mode.recommendedPlayers }}人</strong></div>
            <div><span>时长</span><strong>{{ mode.estimatedDurationMinutes }}分</strong></div>
          </div>

          <DetailRailActions>
            <template #hero>
              <button type="button" class="aa-rail-btn aa-rail-btn--primary aa-rail-btn--featured" :disabled="!isAvailable" @click="startCreate">
                <strong>{{ isAvailable ? '创建对局' : '暂未开放' }}</strong>
                <em>{{ isAvailable ? '以此玩法开局' : '玩法仍在筹备中' }}</em>
                <Sparkles :size="18" />
              </button>
            </template>
            <template #row>
              <button type="button" class="aa-rail-btn aa-rail-btn--accent" @click="qaOpen = true">
                <HelpCircle :size="16" />
                答疑
              </button>
            </template>
            <template v-if="scenario?.systemRoles.length" #main>
              <button type="button" class="aa-rail-btn" @click="systemModelPickerOpen = true">
                <Sparkles :size="16" />
                {{ modelLabel(systemModelId) }}
              </button>
            </template>
            <template #tools>
              <button type="button" class="aa-rail-tile" @click="exportGameMode">
                <Download :size="17" />
                导出
              </button>
            </template>
            <template v-if="isCustomMode" #danger>
              <button type="button" class="aa-rail-btn aa-rail-btn--danger-ghost" @click="deleteCustomMode">
                <Trash2 :size="15" />
                删除玩法
              </button>
            </template>
          </DetailRailActions>
          </div>
        </aside>

        <div ref="scrollRoot" class="detail-layout__main aa-detail-content-scroll">
          <div class="aa-detail-content-stack">
          <section id="section-profile" class="aa-detail-region">
            <DetailEditableBlock title="玩法档案" hint="名称、副标题与玩法描述，会展示在列表与创建对局页">
              <button type="button" class="field-preview" @click="openEdit('basic')">
                <p class="field-preview__lead">{{ mode.subtitle || '点击编辑一句话副标题' }}</p>
                <p class="field-preview__text">{{ mode.description || '点击填写玩法描述与特色说明' }}</p>
                <div class="profile-meta-grid">
                  <span><em>玩法名称</em>{{ mode.name }}</span>
                  <span><em>身份数量</em>{{ roleCount }} 个</span>
                  <span><em>推荐人数</em>{{ mode.recommendedPlayers }} 人</span>
                </div>
              </button>
              <span v-if="isCustomMode" class="custom-tag">自建玩法</span>
              <span v-else-if="hasCustomConfig" class="custom-tag">已自定义配置</span>
              <button v-if="hasCustomConfig && !isCustomMode" type="button" class="detail-reset-link" @click="resetToBuiltin">恢复默认配置</button>
            </DetailEditableBlock>
          </section>

          <section id="section-players" class="aa-detail-region">
            <DetailEditableBlock title="人数与时长" hint="对局人数范围与预估时长">
              <button type="button" class="field-preview" @click="openEdit('players')">
                <div class="profile-meta-grid">
                  <span><em>人数范围</em>{{ mode.minPlayers }}-{{ mode.maxPlayers }} 人</span>
                  <span><em>推荐人数</em>{{ mode.recommendedPlayers }} 人</span>
                  <span><em>预估时长</em>{{ mode.estimatedDurationMinutes }} 分钟</span>
                </div>
              </button>
            </DetailEditableBlock>
          </section>

          <section id="section-rules" class="aa-detail-region">
            <DetailEditableBlock title="规则文案" hint="开局说明、警长规则与要点，会写入对局提示词">
              <button type="button" class="field-preview" @click="openEdit('rules')">
                <p v-if="mode.setupSummary" class="rules-lead">{{ mode.setupSummary }}</p>
                <p v-else class="empty-hint">点击填写开局说明</p>
                <p v-if="mode.sheriffRule" class="rules-sub">警长：{{ mode.sheriffRule }}</p>
                <ul v-if="mode.ruleHighlights?.length" class="rules-list">
                  <li v-for="item in mode.ruleHighlights" :key="item">{{ item }}</li>
                </ul>
                <p v-else-if="!mode.setupSummary" class="empty-hint">点击添加规则要点</p>
              </button>
            </DetailEditableBlock>

            <DetailEditableBlock title="发言展示" hint="局内 @ 提及与玩法术语高亮">
              <button type="button" class="field-preview" @click="openEdit('speech')">
                <p class="rules-lead">
                  {{ resolvedSpeechDisplay?.highlightMentions === false ? '未启用 @ 提及高亮' : '已启用 @ 提及高亮' }}
                </p>
                <ul v-if="resolvedSpeechDisplay?.terms?.length" class="rules-list">
                  <li v-for="item in resolvedSpeechDisplay.terms.slice(0, 8)" :key="item.term">
                    {{ item.term }}<span v-if="item.label"> — {{ item.label }}</span>
                  </li>
                </ul>
                <p v-if="(resolvedSpeechDisplay?.terms?.length || 0) > 8" class="rules-sub">
                  另有 {{ (resolvedSpeechDisplay?.terms?.length || 0) - 8 }} 条术语…
                </p>
                <p v-if="!resolvedSpeechDisplay?.terms?.length" class="empty-hint">点击配置术语高亮</p>
              </button>
            </DetailEditableBlock>

            <template v-if="scenario">
              <div class="region-divider"></div>
              <DetailEditableBlock title="引擎与流程" hint="内置引擎配置，只读">
                <div class="info-grid">
                  <article><span>流程引擎</span><strong>{{ scenario.engineKind }}</strong></article>
                  <article><span>提示词包</span><strong>{{ promptPack?.name || scenario.defaultPromptPackId }}</strong></article>
                  <article><span>阶段流程</span><strong>{{ phaseSummary }}</strong></article>
                  <article><span>准入学习</span><strong>{{ scenario.requiresLearning ? '必须' : '可选' }} / 考试 {{ scenario.requiresExam ? '必须' : '可选' }}</strong></article>
                </div>
              </DetailEditableBlock>
            </template>

            <div v-if="docParts.preamble" class="region-divider"></div>
            <div v-if="docParts.preamble" class="doc-section">
              <MarkdownContent :source="docParts.preamble" />
            </div>
          </section>

          <section
            v-for="section in docParts.sections"
            :id="`section-${section.id}`"
            :key="section.id"
            class="aa-detail-region doc-section"
          >
            <h2>{{ section.title }}</h2>
            <MarkdownContent :source="section.body" />
          </section>

          <section
            v-for="section in promptContentSections"
            :id="`section-${section.id}`"
            :key="section.id"
            class="aa-detail-region"
          >
            <DetailEditableBlock :title="section.title" :hint="section.hint">
              <div v-if="section.role" class="role-enable-row">
                <span>{{ roleKindLabel[section.role.kind] || section.role.kind }}</span>
                <label class="toggle-line">
                  <input :checked="section.role.enabled" type="checkbox" @change="toggleRoleEnabled(section.role)" />
                  <em>{{ section.role.enabled ? '已启用' : '未启用' }}</em>
                </label>
              </div>
              <div v-if="section.templates.length" class="prompt-preview-list">
                <PromptTemplateInlinePreview
                  v-for="tpl in section.templates"
                  :key="tpl.id"
                  :template="tpl"
                  @edit="openPromptDialog(tpl)"
                />
              </div>
              <p v-else class="empty-hint">暂无对应提示词模板。</p>
            </DetailEditableBlock>
          </section>

          <section id="section-learning-exam" class="aa-detail-region">
            <h2><GraduationCap :size="18" /> 准入要求</h2>
            <div class="requirement-row">
              <article :class="{ required: scenario?.requiresLearning }">
                <strong>深度学习</strong>
                <p>角色须完成假设推演式学习，形成心智模型后方可参局。</p>
                <em>{{ scenario?.requiresLearning ? '必须' : '可选' }}</em>
              </article>
              <article :class="{ required: scenario?.requiresExam }">
                <strong>玩法考试</strong>
                <p>通过情景题检验是否掌握规则与边界，支持免考后门。</p>
                <em>{{ scenario?.requiresExam ? '必须' : '可选' }}</em>
              </article>
            </div>
            <template v-if="learningTemplate">
              <div class="region-divider"></div>
              <DetailEditableBlock title="深度学习提示词" hint="角色首次参局前的研读与心智模型输出">
                <PromptTemplateInlinePreview :template="learningTemplate" @edit="openPromptDialog(learningTemplate)" />
              </DetailEditableBlock>
            </template>
            <p v-else class="empty-hint">未配置深度学习提示词。</p>
            <template v-if="examTemplate">
              <div class="region-divider"></div>
              <DetailEditableBlock title="玩法考试提示词" hint="学习完成后的情景题检验">
                <PromptTemplateInlinePreview :template="examTemplate" @edit="openPromptDialog(examTemplate)" />
              </DetailEditableBlock>
            </template>
            <p v-else-if="scenario?.requiresExam" class="empty-hint">该玩法要求考试，但尚未配置考试提示词。</p>
          </section>
            </div>
          </div>
        <aside class="detail-layout__rail detail-layout__rail--right">
          <DetailSectionNav
            :tabs="navTabs"
            :active-id="activeSection"
            @select="scrollToSection"
          />
        </aside>
      </section>

      <GameModeQADialog v-if="mode" v-model="qaOpen" :mode="mode" />
      <GameModeEditDialog
        v-if="mode && editOpen"
        :key="editSection"
        v-model="editOpen"
        :mode="mode"
        :section="editSection"
        @saved="onModeSaved"
      />
      <GameModeSystemModelPickerDialog
        v-if="scenario?.systemRoles.length"
        v-model="systemModelPickerOpen"
        :scenario-id="scenario.id"
        :system-roles="scenario.systemRoles"
        :model-id="systemModelId"
        @saved="onModeSaved"
      />
      <PromptTemplateDialog
        v-if="scenario && promptPack && promptDialogTarget && promptDialogOpen"
        v-model="promptDialogOpen"
        :template="promptDialogTarget"
        :scenario="scenario"
        :prompt-pack="promptPack"
        @saved="onModeSaved"
      />
    </ArenaPageState>
  </ArenaPageShell>
</template>

<style scoped>
.profile-bio {
  margin: 0;
  color: #5e68a0;
  font-size: 14px;
  line-height: 1.75;
}

.rules-lead {
  margin: 0 0 8px;
  color: #59649b;
  font-size: 13px;
  line-height: 1.65;
}

.rules-sub {
  margin: 0 0 8px;
  color: #66709d;
  font-size: 12px;
}

.rules-list {
  margin: 8px 0 0;
  padding-left: 18px;
  color: #59649b;
  font-size: 13px;
  line-height: 1.6;
}

.model-info-card.compact {
  margin-bottom: 8px;
}

.role-enable-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(112, 105, 255, 0.06);
}

.role-enable-row > span {
  color: #66709d;
  font-size: 12px;
}

.sticky-rail {
  min-height: 0;
}

.cover-frame {
  position: relative;
  height: 108px;
  margin: 8px 8px 0;
  border-radius: 16px;
  overflow: hidden;
  background: radial-gradient(circle at 50% 8%, rgba(112, 105, 255, 0.18), transparent 58%);
}

.cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.soon-badge {
  position: absolute;
  left: 10px;
  top: 10px;
  padding: 5px 9px;
  border-radius: 999px;
  color: #fff;
  background: rgba(40, 34, 82, 0.48);
  font-size: 11px;
  font-weight: 600;
}

.identity-card {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px;
  padding: 8px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.76), rgba(112, 105, 255, 0.12));
}

.identity-card--action {
  width: calc(100% - 16px);
}

.identity-card__copy {
  flex: 1;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font: inherit;
}

.mode-badge {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: rgba(112, 105, 255, 0.12);
  color: #5b57f3;
  font-size: 18px;
  font-weight: 700;
  flex-shrink: 0;
}

.identity-card h2 {
  margin: 0 0 3px;
  color: #111a51;
  font-size: 17px;
  font-weight: 660;
}

.identity-card p {
  margin: 0;
  color: #66709d;
  font-size: 12px;
  line-height: 1.4;
}

.field-preview {
  display: block;
  width: 100%;
  padding: 12px;
  border: 1px solid transparent;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.42);
  text-align: left;
  cursor: pointer;
  font: inherit;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.field-preview:hover {
  border-color: rgba(130, 142, 207, 0.2);
  background: rgba(255, 255, 255, 0.58);
}

.field-preview.off {
  opacity: 0.72;
}

.field-preview__lead {
  margin: 0 0 8px;
  color: #17205a;
  font-size: 15px;
  line-height: 1.65;
  font-weight: 600;
}

.field-preview__text {
  margin: 0;
  color: #5e68a0;
  font-size: 14px;
  line-height: 1.75;
}

.profile-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
  margin-top: 12px;
}

.profile-meta-grid span {
  display: grid;
  gap: 2px;
  color: #17205a;
  font-size: 13px;
}

.profile-meta-grid em {
  color: #9aa3c7;
  font-style: normal;
  font-size: 11px;
}

.preview-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(112, 105, 255, 0.1);
  color: #5b57f3;
  font-size: 12px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid rgba(130, 142, 207, 0.12);
  border-bottom: 1px solid rgba(130, 142, 207, 0.12);
}

.stats-row div {
  display: grid;
  place-items: center;
  gap: 4px;
  padding: 10px 4px;
  color: #66709d;
  font-size: 11px;
}

.stats-row strong {
  color: #17205a;
  font-size: 14px;
  font-weight: 680;
}

.aa-detail-region h2 {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  color: #17205a;
  font-size: 16px;
  font-weight: 650;
}

.region-divider {
  height: 1px;
  margin: 16px 0;
  background: rgba(130, 142, 207, 0.12);
}

.card-head .eyebrow {
  color: #6c63ff;
  font-size: 12px;
  font-weight: 680;
  letter-spacing: 0.08em;
}

.card-head p {
  margin: 8px 0 0;
  color: #5e68a0;
  font-size: 14px;
  line-height: 1.75;
}

.custom-tag {
  display: inline-flex;
  margin-top: 10px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(36, 169, 103, 0.1);
  color: #1a9a62;
  font-size: 12px;
}

.meta-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.meta-strip span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 11px;
  border-radius: 999px;
  background: rgba(112, 105, 255, 0.08);
  color: #625cf0;
  font-size: 12px;
}

.doc-section :deep(.markdown-content) {
  color: #3a4578;
  font-size: 14px;
  line-height: 1.75;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.info-grid article {
  padding: 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.52);
}

.info-grid span {
  display: block;
  margin-bottom: 4px;
  color: #7a85b0;
  font-size: 11px;
}

.info-grid strong {
  color: #17205a;
  font-size: 14px;
  word-break: break-all;
}

.prompt-preview-list {
  display: grid;
  gap: 10px;
}

.rules-preview h2 {
  margin: 0 0 8px;
  color: #17205a;
  font-size: 15px;
}

.rules-preview p,
.rules-preview li {
  color: #59649b;
  font-size: 13px;
  line-height: 1.6;
}

.rules-preview ul {
  margin: 8px 0 0;
  padding-left: 18px;
}

.toggle-line {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  cursor: pointer;
}

.toggle-line em {
  color: #65709f;
  font-style: normal;
  font-size: 12px;
}

.requirement-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.requirement-row article {
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(130, 142, 207, 0.1);
}

.requirement-row article.required {
  border-color: rgba(91, 87, 243, 0.25);
  background: rgba(112, 105, 255, 0.06);
}

.requirement-row strong {
  color: #17205a;
  font-size: 14px;
}

.requirement-row p {
  margin: 6px 0;
  color: #66709d;
  font-size: 12px;
  line-height: 1.55;
}

.requirement-row em {
  color: #5b57f3;
  font-size: 11px;
  font-weight: 650;
  font-style: normal;
}

.empty-hint {
  color: #7a85b0;
  font-size: 13px;
}

@media (max-width: 960px) {
  .info-grid,
  .requirement-row {
    grid-template-columns: 1fr;
  }
}
</style>
