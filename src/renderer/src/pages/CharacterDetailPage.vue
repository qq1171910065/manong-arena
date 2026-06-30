<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { BookOpen, Brain, MessageCircle, Sparkles, Star, Trash2, Upload, Volume2, Download } from 'lucide-vue-next'
import ArenaPageShell from '@renderer/components/arena/ArenaPageShell.vue'
import ArenaPageState from '@renderer/components/arena/ArenaPageState.vue'
import CharacterVisualEditorDialog from '@renderer/components/arena/CharacterVisualEditorDialog.vue'
import CharacterChatDialog from '@renderer/components/arena/CharacterChatDialog.vue'
import CharacterEditDialog, { type CharacterEditSection } from '@renderer/components/arena/CharacterEditDialog.vue'
import CharacterGameSkillsPanel from '@renderer/components/arena/CharacterGameSkillsPanel.vue'
import CharacterGrowthOverview from '@renderer/components/arena/CharacterGrowthOverview.vue'
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
  characterGrowthService,
  characterService,
  formatUserMessage,
  portableDataService,
  postGameReviewService,
} from '@renderer/services/arena'
import { getCharacterTtsSummary } from '@shared/arena/voice-presets'
import type { Character, CharacterGrowthRecord, CharacterGrowthSnapshot } from '@shared/arena/types'
import { computeStarRating, expRequiredForLevel, resolveCharacterGrowth } from '@shared/arena/character-growth'

const character = ref<Character | null>(null)
const loading = ref(true)
const error = ref('')
const saving = ref(false)
const chatOpen = ref(false)
const editOpen = ref(false)
const visualEditorOpen = ref(false)
const editSection = ref<CharacterEditSection>('profile')
const strategySaving = ref(false)
let strategySaveTimer: ReturnType<typeof setTimeout> | null = null
const modelPickerOpen = ref(false)
const ttsConfigOpen = ref(false)
const statsOpen = ref(false)
const statsTab = ref<CharacterStatsTab>('overview')
const scrollRoot = ref<HTMLElement | null>(null)

const characterId = computed(() => route.value.id || '')
const learnedSkillCount = computed(() => (character.value?.gameSkills || []).filter((s) => s.learned).length)

const { modelLabel } = useGatewayModelLabel()
const behaviorChanges = ref<Awaited<ReturnType<typeof postGameReviewService.listBehaviorChanges>>>([])
const growthRecords = ref<CharacterGrowthRecord[]>([])
const growthSnapshots = ref<CharacterGrowthSnapshot[]>([])
const chatMessageCount = ref(0)

const genderLabel = computed(() => {
  if (!character.value) return '未设定'
  if (character.value.gender === 'female') return '女'
  if (character.value.gender === 'male') return '男'
  return '其他'
})

const ttsRailLabel = computed(() => {
  if (!character.value) return '播报音色'
  return getCharacterTtsSummary(character.value)
})

const characterGrowth = computed(() => (character.value ? resolveCharacterGrowth(character.value) : null))
const expMax = computed(() => expRequiredForLevel(characterGrowth.value?.level || 1))
const expPercent = computed(() => {
  if (!characterGrowth.value) return 0
  return Math.min(100, Math.round((characterGrowth.value.exp / expMax.value) * 100))
})
const starRating = computed(() => computeStarRating(characterGrowth.value?.level || 1))

const navGroups = computed<ScrollSpyGroup[]>(() => {
  const advancedItems: ScrollSpyGroup['items'] = [
    { id: 'evolution', label: '经验沉淀', badge: personaEvolutionItems.value.length || undefined },
    { id: 'experience', label: '场景记录', badge: learnedSkillCount.value || undefined },
  ]
  if (character.value?.roleStrategies.length) {
    advancedItems.unshift({ id: 'roles', label: '身份策略' })
  }

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
      id: 'persona',
      label: '人设',
      icon: Sparkles,
      items: [
        { id: 'positioning', label: '一句话定位' },
        { id: 'voice', label: '说话方式' },
        { id: 'tags', label: '人设标签', badge: character.value?.tags.length || undefined },
      ],
    },
    {
      id: 'behavior',
      label: '行为',
      icon: Brain,
      items: [
        { id: 'principles', label: '行为原则', badge: character.value?.behaviorPrinciples.length || undefined },
        { id: 'taboos', label: '禁忌行为', badge: character.value?.tabooBehaviors.length || undefined },
        { id: 'strategy', label: '推理倾向' },
        { id: 'traits', label: '擅长短板' },
      ],
    },
    {
      id: 'advanced',
      label: '进阶',
      icon: MessageCircle,
      items: advancedItems,
    },
  ]
})

const navTabs = computed(() => flattenScrollSpyGroups(navGroups.value))

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

function formatEvolutionDate(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function strategyLabel(value: number, left: string, right: string): string {
  if (value <= 35) return left
  if (value >= 65) return right
  return `${left} / ${right} 均衡`
}

const { activeSection, scrollToSection, refreshSpy } = useScrollSpySections(navTabs, scrollRoot)

function onCharacterUpdated(c: Character) {
  character.value = c
}

async function refreshGrowthData() {
  if (!characterId.value) return
  growthSnapshots.value = await characterGrowthService.listSnapshots(characterId.value)
  growthRecords.value = await characterChatService.listGrowth(characterId.value)
}

function openEdit(section: CharacterEditSection) {
  editSection.value = section
  editOpen.value = true
}

function scheduleStrategySave() {
  if (!character.value) return
  if (strategySaveTimer) clearTimeout(strategySaveTimer)
  strategySaveTimer = setTimeout(() => void saveStrategy(), 450)
}

async function saveStrategy() {
  if (!character.value || strategySaving.value) return
  strategySaving.value = true
  try {
    character.value = await characterService.save(character.value)
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    strategySaving.value = false
  }
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
    character.value = await characterGrowthService.ensureInitialized(character.value)
    behaviorChanges.value = await postGameReviewService.listBehaviorChanges(characterId.value)
    growthRecords.value = await characterChatService.listGrowth(characterId.value)
    growthSnapshots.value = await characterGrowthService.listSnapshots(characterId.value)
    const messages = await characterChatService.listMessages(characterId.value)
    chatMessageCount.value = messages.length
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
      <section v-if="character" class="detail-layout">
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
                <span class="status-pill" :class="{ off: character.status !== 'enabled' }">
                  {{ character.status === 'enabled' ? '已启用' : '已停用' }}
                </span>
                <button
                  type="button"
                  class="portrait-hero__edit"
                  title="编辑形象素材"
                  aria-label="编辑形象素材"
                  @click="openVisualEditor"
                >
                  <Upload :size="14" />
                </button>
              </div>
              <div class="portrait-hero__footer">
                <div class="portrait-hero__identity">
                  <button type="button" class="portrait-hero__avatar" title="编辑形象素材" @click="openVisualEditor">
                    <img :src="characterAvatarUrl(character)" alt="" />
                  </button>
                  <button type="button" class="portrait-hero__copy" @click="openEdit('basics')">
                    <h2>{{ character.name }}</h2>
                    <p>{{ character.subtitle || '点击编辑一句话设定' }}</p>
                    <div class="portrait-hero__stars" :aria-label="`${starRating} 星成熟度`">
                      <Star v-for="index in 7" :key="index" :size="11" :class="{ on: index <= starRating }" />
                      <span>Lv.{{ characterGrowth?.level || 1 }}</span>
                    </div>
                  </button>
                </div>
                <div class="portrait-hero__chips">
                  <span class="portrait-hero__chip portrait-hero__chip--model">{{ modelLabel(character.modelId) }}</span>
                  <span v-if="character.speechStyle" class="portrait-hero__chip">{{ character.speechStyle }}</span>
                </div>
              </div>
            </div>

            <div class="rail-stats">
              <button type="button" class="rail-stat" @click="openStats('overview')">
                <strong>Lv.{{ characterGrowth?.level || 1 }}</strong>
                <span>等级</span>
              </button>
              <button type="button" class="rail-stat" @click="scrollToSection('experience')">
                <strong>{{ learnedSkillCount }}</strong>
                <span>场景记录</span>
              </button>
              <button type="button" class="rail-stat" @click="openStats('growth')">
                <strong>{{ chatMessageCount }}</strong>
                <span>私聊</span>
              </button>
            </div>

            <div v-if="characterGrowth" class="rail-exp">
              <div class="rail-exp__bar"><i :style="{ width: `${expPercent}%` }" /></div>
              <span>{{ characterGrowth.exp }} / {{ expMax }} EXP</span>
            </div>

            <DetailRailActions class="character-rail-actions">
              <template #hero>
                <button type="button" class="aa-rail-btn aa-rail-btn--hero" @click="chatOpen = true">
                  <strong>对话</strong>
                  <em>与角色单独交流</em>
                  <MessageCircle :size="18" />
                </button>
              </template>
              <template #row>
                <button type="button" class="aa-rail-btn aa-rail-btn--compact" @click="modelPickerOpen = true">
                  <Sparkles :size="15" />
                  <span class="aa-rail-btn__text">{{ modelLabel(character.modelId) }}</span>
                </button>
                <button type="button" class="aa-rail-btn aa-rail-btn--compact" @click="ttsConfigOpen = true">
                  <Volume2 :size="15" />
                  <span class="aa-rail-btn__text">{{ ttsRailLabel }}</span>
                </button>
              </template>
              <template #tools>
                <button type="button" class="aa-rail-tile" @click="exportCharacter">
                  <Download :size="17" />
                  导出
                </button>
                <button
                  type="button"
                  class="aa-rail-tile"
                  :class="{ active: character.status === 'enabled' }"
                  :disabled="saving"
                  @click="toggleCharacterStatus"
                >
                  <Star :size="17" />
                  {{ character.status === 'enabled' ? '已启用' : '已停用' }}
                </button>
              </template>
              <template #danger>
                <button
                  type="button"
                  class="aa-rail-btn aa-rail-btn--danger-ghost"
                  :disabled="saving"
                  @click="removeCharacter"
                >
                  <Trash2 :size="15" />
                  删除角色
                </button>
              </template>
            </DetailRailActions>
          </div>
        </aside>

        <div ref="scrollRoot" class="detail-layout__main aa-detail-content-scroll">
          <div class="aa-detail-content-stack">
            <DetailContentGroup title="概览" description="档案与成长数据，决定角色在各类场景中的基础表现" :icon="BookOpen">
              <section id="section-profile" class="aa-detail-anchor">
                <DetailEditableBlock
                  title="角色档案"
                  hint="背景故事与基本身份，会写入场景提示词"
                  :empty="!character.bio"
                  @edit="openEdit('profile')"
                >
                  <p class="field-preview__text">{{ character.bio || '点击编辑填写背景、语气与角色来历' }}</p>
                  <div class="profile-meta-grid">
                    <span><em>性别</em>{{ genderLabel }}</span>
                    <span><em>年龄感</em>{{ character.ageLabel || '未设定' }}</span>
                    <span><em>绑定模型</em>{{ modelLabel(character.modelId) }}</span>
                    <span><em>说话风格</em>{{ character.speechStyle || '未设定' }}</span>
                  </div>
                </DetailEditableBlock>
              </section>

              <section id="section-growth" class="aa-detail-anchor">
                <CharacterGrowthOverview :character="character" :snapshots="growthSnapshots" />
              </section>
            </DetailContentGroup>

            <DetailContentGroup title="人设" description="对外展示与说话习惯，塑造角色的第一印象" :icon="Sparkles">
              <section id="section-positioning" class="aa-detail-anchor">
                <DetailEditableBlock
                  title="一句话定位"
                  hint="对外展示与提示词摘要"
                  :empty="!character.subtitle"
                  @edit="openEdit('basics')"
                >
                  <p class="field-preview__lead">{{ character.subtitle || '点击编辑一句话设定' }}</p>
                </DetailEditableBlock>
              </section>

              <section id="section-voice" class="aa-detail-anchor">
                <DetailEditableBlock
                  title="说话方式"
                  hint="语气习惯与常用发言，会直接影响局内措辞"
                  :empty="!character.speechStyle && !character.commonPhrases.length"
                  @edit="openEdit('voice')"
                >
                  <span class="preview-chip">{{ character.speechStyle || '未设定' }}</span>
                  <ul v-if="character.commonPhrases.length" class="phrase-list phrase-list--compact">
                    <li v-for="(phrase, index) in character.commonPhrases" :key="phrase + index">“{{ phrase }}”</li>
                  </ul>
                  <p v-else class="empty-hint">添加常用发言，角色会更稳定地保持口癖</p>
                </DetailEditableBlock>
              </section>

              <section id="section-tags" class="aa-detail-anchor">
                <DetailEditableBlock
                  title="人设标签"
                  hint="快速概括性格关键词，用于筛选与提示词拼装"
                  :empty="!character.tags.length"
                  @edit="openEdit('tags')"
                >
                  <div class="trait-cloud">
                    <span v-for="tag in character.tags" :key="tag">{{ tag }}</span>
                    <span v-if="!character.tags.length" class="empty-tag">点击选择标签</span>
                  </div>
                </DetailEditableBlock>
              </section>
            </DetailContentGroup>

            <DetailContentGroup title="行为" description="场景中的判断准则与互动姿态" :icon="Brain">
              <section id="section-principles" class="aa-detail-anchor">
                <DetailEditableBlock
                  title="行为原则"
                  hint="场景中的判断底线，优先级最高"
                  :empty="!character.behaviorPrinciples.length"
                  @edit="openEdit('principles')"
                >
                  <article v-for="item in character.behaviorPrinciples" :key="item" class="bullet-row">
                    <i></i><span>{{ item }}</span>
                  </article>
                  <p v-if="!character.behaviorPrinciples.length" class="empty-hint">添加行为原则，角色会在关键时刻据此行动</p>
                </DetailEditableBlock>
              </section>

              <section id="section-taboos" class="aa-detail-anchor">
                <DetailEditableBlock
                  title="禁忌行为"
                  hint="角色应当避免的做法，与人设原则同样重要"
                  :empty="!character.tabooBehaviors.length"
                  @edit="openEdit('taboos')"
                >
                  <article v-for="item in character.tabooBehaviors" :key="item" class="bullet-row danger">
                    <i></i><span>{{ item }}</span>
                  </article>
                  <p v-if="!character.tabooBehaviors.length" class="empty-hint">点击添加禁忌行为</p>
                </DetailEditableBlock>
              </section>

              <section id="section-strategy" class="aa-detail-anchor">
                <DetailEditableBlock title="推理倾向" hint="影响发言风格与决策姿态，拖动滑杆后即时保存" :editable="false">
                  <div class="strategy-inline">
                    <div class="strategy-summary">
                      <span>{{ strategyLabel(character.strategy.empathyVsLogic, '偏共情', '偏逻辑') }}</span>
                      <span>{{ strategyLabel(character.strategy.cautiousVsBold, '偏谨慎', '偏冒险') }}</span>
                      <span>{{ strategyLabel(character.strategy.leadVsFollow, '偏主导', '偏跟随') }}</span>
                    </div>
                    <label class="range-row">
                      <span>共情</span>
                      <input
                        v-model.number="character.strategy.empathyVsLogic"
                        type="range"
                        min="0"
                        max="100"
                        @input="scheduleStrategySave"
                      />
                      <em>逻辑 <strong>{{ character.strategy.empathyVsLogic }}%</strong></em>
                    </label>
                    <label class="range-row">
                      <span>谨慎</span>
                      <input
                        v-model.number="character.strategy.cautiousVsBold"
                        type="range"
                        min="0"
                        max="100"
                        @input="scheduleStrategySave"
                      />
                      <em>冒险 <strong>{{ character.strategy.cautiousVsBold }}%</strong></em>
                    </label>
                    <label class="range-row">
                      <span>主导</span>
                      <input
                        v-model.number="character.strategy.leadVsFollow"
                        type="range"
                        min="0"
                        max="100"
                        @input="scheduleStrategySave"
                      />
                      <em>跟随 <strong>{{ character.strategy.leadVsFollow }}%</strong></em>
                    </label>
                    <p v-if="strategySaving" class="strategy-saving-hint">正在保存…</p>
                  </div>
                </DetailEditableBlock>
              </section>

              <section id="section-traits" class="aa-detail-anchor">
                <div class="two-col">
                  <DetailEditableBlock
                    title="擅长"
                    hint="角色优势，会强化相关决策自信度"
                    :empty="!character.strengths.length"
                    @edit="openEdit('strengths')"
                  >
                    <div class="trait-cloud">
                      <span v-for="item in character.strengths" :key="item">{{ item }}</span>
                      <span v-if="!character.strengths.length" class="empty-tag">未标注</span>
                    </div>
                  </DetailEditableBlock>
                  <DetailEditableBlock
                    title="短板"
                    hint="角色局限，会体现在犹豫与失误倾向中"
                    :empty="!character.weaknesses.length"
                    @edit="openEdit('weaknesses')"
                  >
                    <div class="trait-cloud muted">
                      <span v-for="item in character.weaknesses" :key="item">{{ item }}</span>
                      <span v-if="!character.weaknesses.length" class="empty-tag">未标注</span>
                    </div>
                  </DetailEditableBlock>
                </div>
              </section>
            </DetailContentGroup>

            <DetailContentGroup title="进阶" description="场景演练记录与经验沉淀，随演练与私聊缓慢积累" :icon="MessageCircle">
              <section v-if="character.roleStrategies.length" id="section-roles" class="aa-detail-anchor">
                <DetailEditableBlock title="身份策略偏好" hint="拿到特定身份时的打法倾向" :editable="false">
                  <article v-for="pref in character.roleStrategies" :key="pref.roleId" class="role-pref">
                    <strong>{{ pref.roleId }}</strong>
                    <p>{{ pref.description || '无策略说明' }}</p>
                  </article>
                </DetailEditableBlock>
              </section>

              <section id="section-evolution" class="aa-detail-anchor">
                <DetailEditableBlock title="经验沉淀" hint="可迁移的教训与领悟，不记录场景流水" :editable="false">
                  <div v-if="personaEvolutionItems.length" class="evolution-list">
                    <article v-for="item in personaEvolutionItems" :key="item.id" class="evolution-item">
                      <header>
                        <span class="evolution-item__source">{{ item.source }}</span>
                        <time>{{ formatEvolutionDate(item.createdAt) }}</time>
                      </header>
                      <p>{{ item.summary }}</p>
                    </article>
                  </div>
                  <p v-else class="empty-hint evolution-empty">
                    尚无沉淀。与角色私聊或完成场景复盘后，可迁移的经验会出现在这里。
                  </p>
                </DetailEditableBlock>
              </section>

              <section id="section-experience" class="aa-detail-anchor aa-detail-anchor--flush">
                <CharacterGameSkillsPanel :character="character" @updated="onCharacterUpdated" />
              </section>
            </DetailContentGroup>
          </div>
        </div>
        <aside class="detail-layout__rail detail-layout__rail--right">
          <DetailSectionNav
            :groups="navGroups"
            :active-id="activeSection"
            @select="scrollToSection"
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
      @updated="(c) => { onCharacterUpdated(c); void refreshGrowthData() }"
    />
    <CharacterEditDialog
      v-if="character && editOpen"
      :key="editSection"
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
  justify-content: space-between;
  gap: 8px;
}

.portrait-hero__top .status-pill {
  position: static;
  flex: none;
}

.portrait-hero__edit {
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
  transition: transform 0.15s ease, background 0.15s ease;
}

.portrait-hero__edit:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.94);
  color: #4338ca;
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
}

.portrait-hero__copy h2 {
  margin: 0 0 4px;
  color: #fff;
  font-size: 18px;
  font-weight: 680;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.portrait-hero__copy p {
  margin: 0;
  color: rgba(255, 255, 255, 0.82);
  font-size: 12px;
  line-height: 1.45;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.portrait-hero__stars {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-top: 6px;
  color: rgba(255, 255, 255, 0.28);
}

.portrait-hero__stars :deep(svg.on) {
  color: #f5d76e;
  fill: rgba(245, 215, 110, 0.28);
}

.portrait-hero__stars span {
  margin-left: 6px;
  color: rgba(255, 255, 255, 0.78);
  font-size: 11px;
  font-weight: 600;
}

.portrait-hero__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.portrait-hero__chip {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  height: 24px;
  padding: 0 9px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  color: rgba(255, 255, 255, 0.92);
  font-size: 11px;
  font-weight: 560;
  text-overflow: ellipsis;
  white-space: nowrap;
  backdrop-filter: blur(8px);
}

.portrait-hero__chip--model {
  background: color-mix(in srgb, var(--accent) 72%, rgba(255, 255, 255, 0.2));
  color: #fff;
}

.rail-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  padding: 10px 10px 0;
}

.rail-stat {
  display: grid;
  gap: 2px;
  place-items: center;
  min-height: 52px;
  padding: 8px 4px;
  border: 1px solid rgba(130, 142, 207, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  font: inherit;
  transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease;
}

.rail-stat:hover {
  transform: translateY(-1px);
  border-color: rgba(130, 142, 207, 0.22);
  background: rgba(255, 255, 255, 0.72);
}

.rail-stat strong {
  color: #17205a;
  font-size: 16px;
  font-weight: 680;
  line-height: 1.1;
}

.rail-stat span {
  color: #7b84ad;
  font-size: 10px;
  line-height: 1.2;
}

.rail-exp {
  display: grid;
  gap: 4px;
  padding: 0 10px 8px;
}

.rail-exp__bar {
  height: 6px;
  border-radius: 999px;
  background: rgba(130, 142, 207, 0.14);
  overflow: hidden;
}

.rail-exp__bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #8b84ff, #5b57f3);
}

.rail-exp span {
  color: #9aa3c7;
  font-size: 10px;
  text-align: center;
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
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-height: 58px;
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

.field-preview__lead {
  margin: 0;
  color: #17205a;
  font-size: 15px;
  line-height: 1.65;
  font-weight: 600;
}

.strategy-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.strategy-summary span {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(112, 105, 255, 0.1);
  color: #5b57f3;
  font-size: 11px;
  font-weight: 600;
}

.evolution-list {
  display: grid;
  gap: 10px;
}

.evolution-item {
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(112, 105, 255, 0.04);
  border: 1px solid rgba(130, 142, 207, 0.1);
}

.evolution-item header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.evolution-item__source {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(112, 105, 255, 0.1);
  color: #5b57f3;
  font-size: 11px;
  font-weight: 600;
}

.evolution-item time {
  color: #9aa3c7;
  font-size: 11px;
}

.evolution-item p {
  margin: 0;
  color: #59649b;
  font-size: 13px;
  line-height: 1.65;
}

.evolution-item__detail {
  margin-top: 6px !important;
  color: #7a85b0 !important;
  font-size: 12px !important;
}

.evolution-empty {
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(130, 142, 207, 0.06);
  border: 1px dashed rgba(130, 142, 207, 0.16);
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

.strategy-inline {
  display: grid;
  gap: 4px;
}

.range-row {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 72px;
  gap: 10px;
  align-items: center;
  margin: 0 0 12px;
  color: #66709d;
  font-size: 13px;
}

.range-row:last-of-type {
  margin-bottom: 0;
}

.range-row em {
  font-style: normal;
  text-align: right;
  color: #66709d;
  font-size: 12px;
}

.range-row strong {
  color: #17205a;
}

.range-row input[type='range'] {
  width: 100%;
  accent-color: #7b61ff;
}

.strategy-saving-hint {
  margin: 10px 0 0;
  color: #9aa3c7;
  font-size: 11px;
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.two-col :deep(.detail-editable-block) {
  height: 100%;
}

.bullet-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 6px;
}

.bullet-row i {
  width: 6px;
  height: 6px;
  margin-top: 7px;
  border-radius: 50%;
  background: #7b61ff;
  flex: none;
}

.bullet-row.danger i {
  background: #ef6a8a;
}

.bullet-row span {
  color: #59649b;
  font-size: 13px;
  line-height: 1.55;
}

.trait-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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

.empty-tag {
  color: #9aa3c7;
  font-size: 12px;
}

.empty-hint {
  margin: 0;
  color: #9aa3c7;
  font-size: 12px;
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
