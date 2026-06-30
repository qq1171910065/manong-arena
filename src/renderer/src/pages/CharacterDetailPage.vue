<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { BookOpen, Brain, Ban, Code2, Download, FolderOpen, History, MessageCircle, MoreVertical, Shield, Sparkles, Star, Trash2, UserRound, Users, Volume2 } from 'lucide-vue-next'
import ArenaPageShell from '@renderer/components/arena/ArenaPageShell.vue'
import ArenaPageState from '@renderer/components/arena/ArenaPageState.vue'
import CharacterVisualEditorDialog from '@renderer/components/arena/CharacterVisualEditorDialog.vue'
import CharacterChatDialog from '@renderer/components/arena/CharacterChatDialog.vue'
import CharacterEditDialog, { type CharacterEditSection } from '@renderer/components/arena/CharacterEditDialog.vue'
import CharacterAgentPanelDialog from '@renderer/components/arena/CharacterAgentPanelDialog.vue'
import CharacterMemoryPanel from '@renderer/components/arena/CharacterMemoryPanel.vue'
import CharacterMemoryPreview from '@renderer/components/arena/CharacterMemoryPreview.vue'
import CharacterAgentSkillsPanel from '@renderer/components/arena/CharacterAgentSkillsPanel.vue'
import CharacterAgentSkillsPreview from '@renderer/components/arena/CharacterAgentSkillsPreview.vue'
import CharacterWorkspacePanel from '@renderer/components/arena/CharacterWorkspacePanel.vue'
import CharacterWorkspacePreview from '@renderer/components/arena/CharacterWorkspacePreview.vue'
import CharacterSceneRecordsDialog from '@renderer/components/arena/CharacterSceneRecordsDialog.vue'
import CharacterDevParamsDialog from '@renderer/components/arena/CharacterDevParamsDialog.vue'
import CharacterLevelStars from '@renderer/components/arena/CharacterLevelStars.vue'
import CharacterGrowthLogDialog from '@renderer/components/arena/CharacterGrowthLogDialog.vue'
import CharacterGrowthOverview from '@renderer/components/arena/CharacterGrowthOverview.vue'
import DetailFeedPreview from '@renderer/components/arena/DetailFeedPreview.vue'
import CharacterLineupPreview from '@renderer/components/arena/CharacterLineupPreview.vue'
import CharacterLineupRecordsPreview from '@renderer/components/arena/CharacterLineupRecordsPreview.vue'
import CharacterModelPickerDialog from '@renderer/components/arena/CharacterModelPickerDialog.vue'
import CharacterTtsConfigDialog from '@renderer/components/arena/CharacterTtsConfigDialog.vue'
import CharacterStatsDialog, { type CharacterStatsTab } from '@renderer/components/arena/CharacterStatsDialog.vue'
import DetailContentGroup from '@renderer/components/arena/DetailContentGroup.vue'
import DetailEditableBlock from '@renderer/components/arena/DetailEditableBlock.vue'
import DetailRailActions from '@renderer/components/arena/DetailRailActions.vue'
import DetailSectionNav from '@renderer/components/arena/DetailSectionNav.vue'
import { useGatewayModelLabel } from '@renderer/composables/useGatewayModelLabel'
import {
  flattenScrollSpyGroups,
  useScrollSpySections,
  type ScrollSpyGroup,
} from '@renderer/composables/useScrollSpySections'
import { confirm } from '@renderer/composables/useAppDialog'
import { characterAvatarUrl, characterPortraitUrl } from '@renderer/data/arena-visual-assets'
import { navigate, route } from '../router'
import {
  characterChatService,
  characterAgentService,
  characterGrowthService,
  characterService,
  formatUserMessage,
  lineupService,
  portableDataService,
  postGameReviewService,
} from '@renderer/services/arena'
import { getCharacterTtsSummary } from '@shared/arena/voice-presets'
import type { Character, CharacterGrowthRecord, CharacterGrowthSnapshot, CharacterLineup, LineupGrowthRecord } from '@shared/arena/types'
import {
  buildCharacterGrowthLogItems,
} from '@shared/arena/growth-display'

const character = ref<Character | null>(null)
const loading = ref(true)
const error = ref('')
const saving = ref(false)
const chatOpen = ref(false)
const editOpen = ref(false)
const visualEditorOpen = ref(false)
const editSection = ref<CharacterEditSection>('profile')
const modelPickerOpen = ref(false)
const ttsConfigOpen = ref(false)
const statsOpen = ref(false)
const statsTab = ref<CharacterStatsTab>('overview')
const scrollRoot = ref<HTMLElement | null>(null)
const railMenuOpen = ref(false)
const memoryDialogOpen = ref(false)
const skillsDialogOpen = ref(false)
const workspaceDialogOpen = ref(false)
const workspacePreviewRef = ref<InstanceType<typeof CharacterWorkspacePreview> | null>(null)
const sceneRecordsOpen = ref(false)
const growthLogOpen = ref(false)
const devParamsOpen = ref(false)
const isDev = import.meta.env.DEV

const characterId = computed(() => route.value.id || '')
const learnedSkillCount = computed(() => (character.value?.gameSkills || []).filter((s) => s.learned).length)
const { modelLabel } = useGatewayModelLabel()
const behaviorChanges = ref<Awaited<ReturnType<typeof postGameReviewService.listBehaviorChanges>>>([])
const growthRecords = ref<CharacterGrowthRecord[]>([])
const growthSnapshots = ref<CharacterGrowthSnapshot[]>([])
const chatMessageCount = ref(0)
const workspaceFileCount = ref(0)
const relatedLineups = ref<CharacterLineup[]>([])
const lineupGrowthRecords = ref<LineupGrowthRecord[]>([])

const genderLabel = computed(() => {
  if (!character.value) return '未设定'
  if (character.value.gender === 'female') return '女'
  if (character.value.gender === 'male') return '男'
  return '其他'
})

const ttsRailLabel = computed(() => {
  if (!character.value) return 'TTS'
  const summary = getCharacterTtsSummary(character.value)
  return summary.length > 8 ? `${summary.slice(0, 8)}…` : summary
})

const modelRailLabel = computed(() => {
  if (!character.value) return '模型'
  const label = modelLabel(character.value.modelId)
  return label.length > 10 ? `${label.slice(0, 10)}…` : label
})

const navGroups = computed<ScrollSpyGroup[]>(() => {
  return [
    {
      id: 'overview',
      label: '概览',
      icon: BookOpen,
      items: [
        { id: 'profile', label: '角色档案' },
        { id: 'growth', label: '成长体系' },
      ],
    },
    {
      id: 'behavior',
      label: '行为',
      icon: Brain,
      items: [
        { id: 'principles', label: '行为原则', badge: character.value?.behaviorPrinciples.length || undefined },
        { id: 'taboos', label: '禁忌行为', badge: character.value?.tabooBehaviors.length || undefined },
        { id: 'strategy', label: '决策风格' },
        { id: 'traits', label: '擅长短板' },
      ],
    },
    {
      id: 'lineup',
      label: '阵容',
      icon: Users,
      items: [
        { id: 'lineups', label: '所属阵容', badge: relatedLineups.value.length || undefined },
        { id: 'lineup-records', label: '组队记录', badge: lineupGrowthRecords.value.length || undefined },
      ],
    },
    {
      id: 'advanced',
      label: '进阶',
      icon: MessageCircle,
      items: [
        { id: 'memory', label: '长期记忆', badge: character.value?.agentMemories?.length || undefined },
        { id: 'skills', label: '技能库', badge: character.value?.agentSkills?.filter((s) => s.enabled).length || undefined },
        { id: 'workspace', label: '文件空间', badge: workspaceFileCount.value || undefined },
        { id: 'evolution', label: '经验沉淀', badge: personaEvolutionItems.value.length || undefined },
      ],
    },
  ]
})

const growthLogTotal = computed(() =>
  buildCharacterGrowthLogItems(growthSnapshots.value, growthRecords.value, behaviorChanges.value).length
)

const personaEvolutionItems = computed(() => {
  const items: Array<{ id: string; createdAt: string; source: string; summary: string }> = []
  for (const record of behaviorChanges.value.filter((item) => item.applied)) {
    items.push({
      id: record.id,
      createdAt: record.createdAt,
      source: '复盘领悟',
      summary: record.summary,
    })
  }
  for (const record of growthRecords.value.filter((item) => item.applied)) {
    items.push({
      id: record.id,
      createdAt: record.createdAt,
      source: record.source === 'chat' ? '私聊沉淀' : '复盘领悟',
      summary: record.summary,
    })
  }
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6)
})

const profileEmpty = computed(() => {
  const c = character.value
  if (!c) return true
  return (
    !c.subtitle?.trim()
    && !c.bio?.trim()
    && !c.ageLabel?.trim()
    && !c.speechStyle
    && !c.commonPhrases.length
    && !c.tags.length
  )
})

const evolutionFeedItems = computed(() =>
  personaEvolutionItems.value.map((item) => ({
    id: item.id,
    label: item.source,
    text: item.summary,
    time: formatEvolutionDate(item.createdAt),
  }))
)

const memoryCountLabel = computed(() => {
  const count = character.value?.agentMemories?.length || 0
  return count ? `${count} 条` : undefined
})

const skillsCountLabel = computed(() => {
  const count = character.value?.agentSkills?.filter((s) => s.enabled).length || 0
  return count ? `${count} 个已启用` : undefined
})

const navTabs = computed(() => flattenScrollSpyGroups(navGroups.value))

function closeRailMenu() {
  railMenuOpen.value = false
}

async function handleRailMenuAction(action: 'toggle' | 'export' | 'delete' | 'devParams') {
  closeRailMenu()
  if (action === 'toggle') await toggleCharacterStatus()
  if (action === 'export') await exportCharacter()
  if (action === 'delete') await removeCharacter()
  if (action === 'devParams') devParamsOpen.value = true
}

function onNavSelect(id: string) {
  scrollToSection(id)
}

function openSceneRecords() {
  sceneRecordsOpen.value = true
}

function formatEvolutionDate(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function leanLabel(value: number, left: string, right: string): string {
  if (value <= 35) return `偏${left}`
  if (value >= 65) return `偏${right}`
  return '均衡'
}

const strategyAxes = computed(() => {
  if (!character.value) return []
  const strategy = character.value.strategy
  return [
    {
      id: 'empathyVsLogic',
      left: '共情',
      right: '逻辑',
      value: strategy.empathyVsLogic,
      lean: leanLabel(strategy.empathyVsLogic, '共情', '逻辑'),
    },
    {
      id: 'cautiousVsBold',
      left: '谨慎',
      right: '冒险',
      value: strategy.cautiousVsBold,
      lean: leanLabel(strategy.cautiousVsBold, '谨慎', '冒险'),
    },
    {
      id: 'leadVsFollow',
      left: '主导',
      right: '跟随',
      value: strategy.leadVsFollow,
      lean: leanLabel(strategy.leadVsFollow, '主导', '跟随'),
    },
  ]
})

const { activeSection, scrollToSection, refreshSpy } = useScrollSpySections(navTabs, scrollRoot)

function onCharacterUpdated(c: Character) {
  character.value = c
}

async function refreshWorkspaceCount() {
  if (!characterId.value) return
  workspaceFileCount.value = (await characterAgentService.listWorkspaceFiles(characterId.value).catch(() => [])).length
  await workspacePreviewRef.value?.refresh?.()
}

async function refreshGrowthData() {
  if (!characterId.value) return
  growthSnapshots.value = await characterGrowthService.listSnapshots(characterId.value)
  growthRecords.value = await characterChatService.listGrowth(characterId.value)
  behaviorChanges.value = await postGameReviewService.listBehaviorChanges(characterId.value)
}

async function refreshLineupData() {
  if (!characterId.value) return
  try {
    const lineups = await lineupService.list()
    relatedLineups.value = lineups.filter((lineup) => lineup.characterIds.includes(characterId.value))
    const batches = await Promise.all(relatedLineups.value.map((lineup) => lineupService.listGrowth(lineup.id)))
    lineupGrowthRecords.value = batches.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } catch {
    relatedLineups.value = []
    lineupGrowthRecords.value = []
  }
}

function openEdit(section: CharacterEditSection) {
  editSection.value = section
  editOpen.value = true
}

function openVisualEditor() {
  visualEditorOpen.value = true
}

function openStats(tab: CharacterStatsTab) {
  statsTab.value = tab
  statsOpen.value = true
}

async function load() {
  if (!characterId.value) return
  loading.value = true
  error.value = ''
  try {
    character.value = await characterService.get(characterId.value)
    character.value = characterAgentService.ensureAgentDefaults(character.value)
    character.value = await characterGrowthService.ensureInitialized(character.value)
    behaviorChanges.value = await postGameReviewService.listBehaviorChanges(characterId.value)
    growthRecords.value = await characterChatService.listGrowth(characterId.value)
    growthSnapshots.value = await characterGrowthService.listSnapshots(characterId.value)
    const messages = await characterChatService.listMessages(characterId.value)
    chatMessageCount.value = messages.length
    workspaceFileCount.value = (await characterAgentService.listWorkspaceFiles(characterId.value).catch(() => [])).length
    await refreshLineupData()
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    loading.value = false
    await nextTick(refreshSpy)
  }
}

async function toggleCharacterStatus() {
  if (!character.value) return
  saving.value = true
  try {
    character.value = await characterService.toggleStatus(character.value.id)
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    saving.value = false
  }
}

async function removeCharacter() {
  if (!character.value) return
  if (!(await confirm({
    title: '删除角色',
    message: `确定删除角色「${character.value.name}」吗？`,
    detail: '此操作不可恢复。',
    tone: 'danger',
    confirmText: '删除',
  }))) return
  saving.value = true
  try {
    await characterService.remove(character.value.id)
    navigate('/characters')
  } catch (err) {
    error.value = formatUserMessage(err)
    saving.value = false
  }
}

async function exportCharacter() {
  if (!character.value) return
  try {
    await portableDataService.exportCharacter(character.value.id)
  } catch (err) {
    error.value = formatUserMessage(err)
  }
}

onMounted(() => void load())
watch(characterId, () => void load())
</script>

<template>
  <ArenaPageShell class="detail-page" viewport-lock>
    <ArenaPageState :loading="loading" :error="error || undefined" skeleton="detail-3col" loading-label="正在打开角色档案..." @retry="load">
      <section v-if="character" class="detail-layout" @click="closeRailMenu">
        <aside class="detail-layout__rail detail-layout__rail--left">
          <div
            class="aa-detail-float-panel sticky-rail detail-layout__panel character-rail-panel"
            :style="{ '--accent': character.accentColor }"
          >
            <div class="portrait-hero">
              <div class="portrait-hero__stage" aria-hidden="true">
                <div class="portrait-hero__glow" />
              </div>
              <img
                class="portrait-hero__img"
                :src="characterPortraitUrl(character)"
                :alt="character.name"
                title="编辑形象素材"
                @click="openVisualEditor"
              />
              <div class="portrait-hero__top">
                <div class="portrait-hero__menu" @click.stop>
                  <button
                    type="button"
                    class="portrait-hero__menu-btn"
                    aria-label="更多操作"
                    @click.stop="railMenuOpen = !railMenuOpen"
                  >
                    <MoreVertical :size="16" />
                  </button>
                  <div v-if="railMenuOpen" class="portrait-hero__menu-panel">
                    <button type="button" :disabled="saving" @click="handleRailMenuAction('toggle')">
                      <Star :size="14" />
                      {{ character.status === 'enabled' ? '停用' : '启用' }}
                    </button>
                    <button type="button" @click="handleRailMenuAction('export')">
                      <Download :size="14" />
                      导出
                    </button>
                    <button v-if="isDev" type="button" @click="handleRailMenuAction('devParams')">
                      <Code2 :size="14" />
                      预览开发参数
                    </button>
                    <button type="button" class="danger" :disabled="saving" @click="handleRailMenuAction('delete')">
                      <Trash2 :size="14" />
                      删除
                    </button>
                  </div>
                </div>
              </div>
              <div class="portrait-hero__footer">
                <div class="portrait-hero__identity">
                  <button type="button" class="portrait-hero__avatar" title="编辑形象素材" @click="openVisualEditor">
                    <img :src="characterAvatarUrl(character)" alt="" />
                  </button>
                  <button type="button" class="portrait-hero__copy" @click="openEdit('basics')">
                    <h2>{{ character.name }}</h2>
                    <CharacterLevelStars :character="character" variant="portrait" />
                  </button>
                </div>
              </div>
            </div>

            <DetailRailActions class="character-rail-actions">
              <template #hero>
                <button type="button" class="aa-rail-btn aa-rail-btn--hero" @click="chatOpen = true">
                  <MessageCircle :size="18" />
                  <strong>对话</strong>
                </button>
              </template>
              <template #main>
                <button type="button" class="aa-rail-btn growth-rail-btn" @click="growthLogOpen = true">
                  <History :size="16" />
                  <span class="aa-rail-btn__text">成长记录</span>
                  <span v-if="growthLogTotal" class="growth-rail-btn__badge">{{ growthLogTotal }}</span>
                </button>
              </template>
              <template #row>
                <button type="button" class="aa-rail-btn aa-rail-btn--compact" @click="modelPickerOpen = true">
                  <Sparkles :size="15" />
                  <span class="aa-rail-btn__text">{{ modelRailLabel }}</span>
                </button>
                <button type="button" class="aa-rail-btn aa-rail-btn--compact" @click="ttsConfigOpen = true">
                  <Volume2 :size="15" />
                  <span class="aa-rail-btn__text">{{ ttsRailLabel }}</span>
                </button>
              </template>
            </DetailRailActions>
          </div>
        </aside>

        <div ref="scrollRoot" class="detail-layout__main aa-detail-content-scroll">
          <div class="aa-detail-content-stack">
            <DetailContentGroup title="概览" :icon="BookOpen">
              <section id="section-profile" class="aa-detail-anchor">
                <DetailEditableBlock
                  title="角色档案"
                  :empty="profileEmpty"
                  empty-description="填写定位、背景、说话方式与人设标签"
                  :empty-icon="UserRound"
                  flat
                  @edit="openEdit('profile')"
                >
                  <p
                    v-if="character.subtitle?.trim()"
                    class="field-preview__lead profile-subsection--clickable"
                    data-no-edit
                    @click.stop="openEdit('basics')"
                  >
                    {{ character.subtitle }}
                  </p>
                  <p v-if="character.bio?.trim()" class="field-preview__text">{{ character.bio }}</p>
                  <div class="profile-meta-grid">
                    <span><em>性别</em>{{ genderLabel }}</span>
                    <span><em>年龄感</em>{{ character.ageLabel || '未设定' }}</span>
                    <span><em>绑定模型</em>{{ modelLabel(character.modelId) }}</span>
                    <span><em>说话风格</em>{{ character.speechStyle || '未设定' }}</span>
                  </div>
                  <div
                    v-if="character.speechStyle || character.commonPhrases.length"
                    class="profile-subsection profile-subsection--clickable"
                    data-no-edit
                    @click.stop="openEdit('voice')"
                  >
                    <h4 class="profile-subsection__title">说话方式</h4>
                    <span v-if="character.speechStyle" class="preview-chip">{{ character.speechStyle }}</span>
                    <ul v-if="character.commonPhrases.length" class="phrase-list phrase-list--compact">
                      <li v-for="(phrase, index) in character.commonPhrases" :key="phrase + index">“{{ phrase }}”</li>
                    </ul>
                  </div>
                  <div
                    v-if="character.tags.length"
                    class="profile-subsection profile-subsection--clickable"
                    data-no-edit
                    @click.stop="openEdit('tags')"
                  >
                    <h4 class="profile-subsection__title">人设标签</h4>
                    <div class="trait-cloud">
                      <span v-for="tag in character.tags" :key="tag">{{ tag }}</span>
                    </div>
                  </div>
                </DetailEditableBlock>
              </section>

              <section id="section-growth" class="aa-detail-anchor">
                <CharacterGrowthOverview :character="character" :snapshots="growthSnapshots" />
              </section>
            </DetailContentGroup>

            <DetailContentGroup title="行为" :icon="Brain">
              <div class="behavior-grid">
                <section id="section-principles" class="aa-detail-anchor">
                  <DetailEditableBlock
                    title="行为原则"
                    :empty="!character.behaviorPrinciples.length"
                    empty-description="添加对局中的判断准则"
                    :empty-icon="Shield"
                    flat
                    @edit="openEdit('principles')"
                  >
                    <ul class="behavior-list">
                      <li v-for="item in character.behaviorPrinciples" :key="item" class="behavior-list__item">
                        <i aria-hidden="true"></i>
                        <span>{{ item }}</span>
                      </li>
                    </ul>
                  </DetailEditableBlock>
                </section>

                <section id="section-taboos" class="aa-detail-anchor">
                  <DetailEditableBlock
                    title="禁忌行为"
                    :empty="!character.tabooBehaviors.length"
                    empty-description="标注角色应当避免的做法"
                    :empty-icon="Ban"
                    flat
                    @edit="openEdit('taboos')"
                  >
                    <ul class="behavior-list behavior-list--danger">
                      <li v-for="item in character.tabooBehaviors" :key="item" class="behavior-list__item">
                        <i aria-hidden="true"></i>
                        <span>{{ item }}</span>
                      </li>
                    </ul>
                  </DetailEditableBlock>
                </section>
              </div>

              <section id="section-strategy" class="aa-detail-anchor">
                <DetailEditableBlock
                  title="决策风格"
                  hint="对局中的判断、站队与发言节奏"
                  :editable="false"
                  flat
                >
                  <ul class="decision-style">
                    <li v-for="axis in strategyAxes" :key="axis.id" class="decision-style__row">
                      <div class="decision-style__poles">
                        <span :class="{ on: axis.value <= 35 }">{{ axis.left }}</span>
                        <em>{{ axis.lean }}</em>
                        <span :class="{ on: axis.value >= 65 }">{{ axis.right }}</span>
                      </div>
                      <div class="decision-style__track" aria-hidden="true">
                        <i class="decision-style__marker" :style="{ left: `${axis.value}%` }" />
                      </div>
                    </li>
                  </ul>
                </DetailEditableBlock>
              </section>

              <section id="section-traits" class="aa-detail-anchor">
                <div class="behavior-grid">
                  <DetailEditableBlock
                    title="擅长"
                    :empty="!character.strengths.length"
                    empty-description="标注角色的优势领域"
                    :empty-icon="Sparkles"
                    flat
                    @edit="openEdit('strengths')"
                  >
                    <div class="trait-cloud trait-cloud--fill">
                      <span v-for="item in character.strengths" :key="item">{{ item }}</span>
                    </div>
                  </DetailEditableBlock>
                  <DetailEditableBlock
                    title="短板"
                    :empty="!character.weaknesses.length"
                    empty-description="标注角色的局限或弱点"
                    :empty-icon="Ban"
                    flat
                    @edit="openEdit('weaknesses')"
                  >
                    <div class="trait-cloud trait-cloud--fill muted">
                      <span v-for="item in character.weaknesses" :key="item">{{ item }}</span>
                    </div>
                  </DetailEditableBlock>
                </div>
              </section>
            </DetailContentGroup>

            <DetailContentGroup title="阵容" :icon="Users">
              <section id="section-lineups" class="aa-detail-anchor">
                <DetailEditableBlock
                  title="所属阵容"
                  hint="角色被编入的阵容与组队战绩"
                  :empty="!relatedLineups.length"
                  empty-description="在角色库中把该角色编入阵容后，会在这里展示"
                  :empty-icon="Users"
                  :editable="false"
                  flat
                >
                  <CharacterLineupPreview :character="character" />
                </DetailEditableBlock>
              </section>

              <section id="section-lineup-records" class="aa-detail-anchor advanced-block">
                <DetailEditableBlock
                  title="组队记录"
                  hint="阵容全员参战的对局会留下记录"
                  :empty="!lineupGrowthRecords.length"
                  empty-description="当阵容成员全员参与对局后，记录会出现在这里"
                  :empty-icon="History"
                  :editable="false"
                  flat
                >
                  <CharacterLineupRecordsPreview :character="character" />
                </DetailEditableBlock>
              </section>
            </DetailContentGroup>

            <DetailContentGroup title="进阶" :icon="MessageCircle">
              <section id="section-memory" class="aa-detail-anchor advanced-block">
                <DetailEditableBlock
                  title="长期记忆"
                  :empty="!character.agentMemories?.length"
                  empty-description="添加角色应长期记住的事实与偏好"
                  :empty-icon="Brain"
                  flat
                  @edit="memoryDialogOpen = true"
                >
                  <CharacterMemoryPreview :character="character" />
                </DetailEditableBlock>
              </section>

              <section id="section-skills" class="aa-detail-anchor advanced-block">
                <DetailEditableBlock
                  title="技能库"
                  :empty="!character.agentSkills?.some((s) => s.enabled)"
                  empty-description="定义角色的能力与触发规则"
                  :empty-icon="Sparkles"
                  flat
                  @edit="skillsDialogOpen = true"
                >
                  <CharacterAgentSkillsPreview :character="character" />
                </DetailEditableBlock>
              </section>

              <section id="section-workspace" class="aa-detail-anchor advanced-block">
                <DetailEditableBlock
                  title="文件空间"
                  :empty="workspaceFileCount === 0"
                  empty-description="存放笔记、设定稿与参考资料"
                  :empty-icon="FolderOpen"
                  flat
                  @edit="workspaceDialogOpen = true"
                >
                  <CharacterWorkspacePreview ref="workspacePreviewRef" :character="character" />
                </DetailEditableBlock>
              </section>

              <section id="section-evolution" class="aa-detail-anchor advanced-block">
                <DetailEditableBlock
                  title="经验沉淀"
                  :empty="!personaEvolutionItems.length && !learnedSkillCount"
                  empty-description="与角色互动或完成场景复盘后，经验会沉淀在这里"
                  :empty-icon="MessageCircle"
                  flat
                  @edit="openSceneRecords"
                >
                  <DetailFeedPreview
                    v-if="evolutionFeedItems.length"
                    :items="evolutionFeedItems"
                    :clamp="2"
                  />
                </DetailEditableBlock>
              </section>
            </DetailContentGroup>
          </div>
        </div>
        <aside class="detail-layout__rail detail-layout__rail--right">
          <DetailSectionNav
            :groups="navGroups"
            :active-id="activeSection"
            @select="onNavSelect"
          />
        </aside>
      </section>
    </ArenaPageState>

    <CharacterVisualEditorDialog
      v-if="character && visualEditorOpen"
      v-model="visualEditorOpen"
      :character="character"
      @saved="onCharacterUpdated"
    />
    <CharacterChatDialog
      v-if="character && chatOpen"
      v-model="chatOpen"
      :character="character"
      @updated="(c) => { onCharacterUpdated(c); void refreshGrowthData(); void refreshWorkspaceCount() }"
    />
    <CharacterEditDialog
      v-if="character && editOpen"
      v-model="editOpen"
      :character="character"
      :section="editSection"
      @saved="onCharacterUpdated"
    />
    <CharacterModelPickerDialog
      v-if="character && modelPickerOpen"
      v-model="modelPickerOpen"
      :character="character"
      @saved="onCharacterUpdated"
    />
    <CharacterTtsConfigDialog
      v-if="character && ttsConfigOpen"
      v-model="ttsConfigOpen"
      :character="character"
      @saved="onCharacterUpdated"
    />
    <CharacterStatsDialog
      v-if="character && statsOpen"
      v-model="statsOpen"
      :character="character"
      :growth-records="growthRecords"
      :behavior-changes="behaviorChanges"
      :chat-message-count="chatMessageCount"
      :initial-tab="statsTab"
    />
    <CharacterAgentPanelDialog
      v-if="character"
      v-model="memoryDialogOpen"
      title="长期记忆"
      :subtitle="memoryCountLabel"
    >
      <CharacterMemoryPanel embedded :character="character" @updated="onCharacterUpdated" />
    </CharacterAgentPanelDialog>
    <CharacterAgentPanelDialog
      v-if="character"
      v-model="skillsDialogOpen"
      title="技能库"
      wide
      :subtitle="skillsCountLabel"
    >
      <CharacterAgentSkillsPanel embedded :character="character" @updated="onCharacterUpdated" />
    </CharacterAgentPanelDialog>
    <CharacterAgentPanelDialog
      v-if="character"
      v-model="workspaceDialogOpen"
      title="文件空间"
      wide
    >
      <CharacterWorkspacePanel embedded :character="character" @updated="refreshWorkspaceCount" />
    </CharacterAgentPanelDialog>
    <CharacterSceneRecordsDialog
      v-if="character"
      v-model="sceneRecordsOpen"
      :character="character"
      @updated="onCharacterUpdated"
    />
    <CharacterGrowthLogDialog
      v-if="character && growthLogOpen"
      v-model="growthLogOpen"
      :character="character"
    />
    <CharacterDevParamsDialog
      v-if="character && devParamsOpen"
      v-model="devParamsOpen"
      :character="character"
    />
  </ArenaPageShell>
</template>

<style scoped>
.detail-layout {
  --detail-rail-left: 248px;
}

.sticky-rail {
  --accent: #7568ff;
  min-height: 0;
}

.character-rail-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.portrait-hero {
  position: relative;
  flex: none;
  min-height: 300px;
  overflow: hidden;
  background: color-mix(in srgb, var(--accent) 8%, #f4f6ff);
}

.portrait-hero__stage {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.portrait-hero__glow {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 50% 18%, color-mix(in srgb, var(--accent) 22%, white), transparent 58%),
    linear-gradient(180deg, color-mix(in srgb, var(--accent) 10%, white), transparent 42%);
}

.portrait-hero__img {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  min-height: 300px;
  object-fit: contain;
  object-position: center bottom;
  cursor: pointer;
  transition: transform 0.35s ease, filter 0.3s ease;
}

.portrait-hero:hover .portrait-hero__img {
  transform: scale(1.02);
  filter: saturate(1.04);
}

.portrait-hero__top {
  position: absolute;
  top: 10px;
  left: 10px;
  right: 10px;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.portrait-hero__menu {
  position: relative;
}

.portrait-hero__menu-btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.82);
  color: #5f6a9e;
  cursor: pointer;
  backdrop-filter: blur(10px);
  box-shadow: 0 6px 16px rgba(34, 42, 88, 0.12);
}

.portrait-hero__menu-btn:hover {
  background: rgba(255, 255, 255, 0.94);
  color: #4338ca;
}

.portrait-hero__menu-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 5;
  display: grid;
  gap: 2px;
  min-width: 120px;
  padding: 6px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 12px 32px rgba(34, 42, 88, 0.16);
}

.portrait-hero__menu-panel button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #17205a;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
}

.portrait-hero__menu-panel button:hover:not(:disabled) {
  background: rgba(112, 105, 255, 0.08);
}

.portrait-hero__menu-panel button.danger {
  color: #dc2626;
}

.portrait-hero__menu-panel button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.portrait-hero__footer {
  position: absolute;
  inset: auto 0 0;
  z-index: 2;
  padding: 14px 12px 12px;
  background: linear-gradient(
    to top,
    rgba(14, 18, 46, 0.82) 0%,
    rgba(14, 18, 46, 0.58) 52%,
    transparent 100%
  );
}

.portrait-hero__identity {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  min-width: 0;
}

.portrait-hero__avatar {
  flex: none;
  width: 48px;
  height: 48px;
  padding: 0;
  border: 2px solid rgba(255, 255, 255, 0.88);
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.22);
}

.portrait-hero__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.portrait-hero__copy {
  flex: 1;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font: inherit;
  display: grid;
  gap: 0;
}

.portrait-hero__copy h2 {
  margin: 0;
  color: #fff;
  font-size: 18px;
  font-weight: 680;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.character-rail-actions :deep(.aa-rail-btn--hero) {
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
}

.character-rail-actions :deep(.growth-rail-btn) {
  justify-content: flex-start;
  gap: 8px;
}

.growth-rail-btn__badge {
  margin-left: auto;
  min-width: 20px;
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(112, 105, 255, 0.12);
  color: #5b57f3;
  font-size: 11px;
  font-weight: 650;
  line-height: 1.5;
  text-align: center;
}

.agent-region {
  padding-top: 4px;
}

.advanced-block + .advanced-block {
  margin-top: 2px;
  padding-top: 10px;
  border-top: 1px solid rgba(130, 142, 207, 0.1);
}

.character-rail-actions :deep(.aa-detail-rail-actions) {
  border-top: 0;
  padding-top: 8px;
}

.character-rail-actions :deep(.aa-detail-rail-actions__row > *) {
  flex: 1 1 calc(50% - 4px);
  min-width: 0;
}

.character-rail-actions :deep(.aa-rail-btn--compact) {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 8px 10px;
}

.character-rail-actions :deep(.aa-rail-btn__text) {
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  line-height: 1.35;
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

.profile-subsection {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid rgba(130, 142, 207, 0.1);
}

.profile-subsection--clickable {
  cursor: pointer;
}

.profile-subsection--clickable:hover .profile-subsection__title {
  color: #5b57f3;
}

.profile-subsection__title {
  margin: 0 0 8px;
  color: #17205a;
  font-size: 12px;
  font-weight: 650;
}

.field-preview__lead {
  margin: 0;
  color: #17205a;
  font-size: 15px;
  line-height: 1.65;
  font-weight: 600;
}

.decision-style {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.decision-style__row {
  display: grid;
  gap: 8px;
}

.decision-style__poles {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 10px;
  color: #9aa3c7;
  font-size: 12px;
}

.decision-style__poles span {
  color: #9aa3c7;
  font-weight: 600;
  transition: color 0.15s ease;
}

.decision-style__poles span:first-child {
  text-align: left;
}

.decision-style__poles span:last-child {
  text-align: right;
}

.decision-style__poles span.on {
  color: #5b57f3;
}

.decision-style__poles em {
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(112, 105, 255, 0.1);
  color: #5b57f3;
  font-style: normal;
  font-size: 11px;
  font-weight: 650;
  white-space: nowrap;
}

.decision-style__track {
  position: relative;
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    rgba(139, 132, 255, 0.35) 0%,
    rgba(130, 142, 207, 0.12) 50%,
    rgba(91, 87, 243, 0.35) 100%
  );
}

.decision-style__marker {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  margin-left: -6px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #7b61ff;
  box-shadow: 0 2px 6px rgba(91, 87, 243, 0.28);
  transform: translateY(-50%);
}

.behavior-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.behavior-grid :deep(.detail-editable-block) {
  height: 100%;
}

.behavior-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
  align-content: start;
}

.behavior-list__item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(130, 142, 207, 0.08);
}

.behavior-list__item i {
  width: 6px;
  height: 6px;
  margin-top: 7px;
  border-radius: 50%;
  background: #7b61ff;
  flex: none;
}

.behavior-list--danger .behavior-list__item i {
  background: #ef6a8a;
}

.behavior-list__item span {
  color: #59649b;
  font-size: 13px;
  line-height: 1.55;
}

.field-preview__text {
  margin: 0;
  color: #5e68a0;
  font-size: 14px;
  line-height: 1.75;
}

.preview-chip {
  display: inline-flex;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(112, 105, 255, 0.1);
  color: #5b57f3;
  font-size: 12px;
}

.trait-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-content: flex-start;
}

.trait-cloud--fill {
  min-height: 72px;
}

.trait-cloud span {
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(112, 105, 255, 0.08);
  color: #625cf0;
  font-size: 12px;
}

.trait-cloud.muted span {
  background: rgba(130, 142, 207, 0.1);
  color: #66709d;
}

.phrase-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.phrase-list li {
  color: #59649b;
  font-size: 13px;
  line-height: 1.55;
}

.phrase-list--compact {
  margin-top: 10px;
}

@media (max-width: 980px) {
  .behavior-grid {
    grid-template-columns: 1fr;
  }
}

.role-pref {
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(112, 105, 255, 0.04);
  border: 1px solid rgba(130, 142, 207, 0.1);
}

.role-pref strong {
  color: #17205a;
  font-size: 14px;
}

.role-pref p {
  margin: 6px 0 0;
  color: #66709d;
  font-size: 13px;
}

.aa-detail-region h2 {
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
</style>
