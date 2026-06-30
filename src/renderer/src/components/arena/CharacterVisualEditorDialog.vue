<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ImagePlus, Upload } from 'lucide-vue-next'
import DetailEditDialog from '@renderer/components/arena/DetailEditDialog.vue'
import {
  appendAssetCacheBust,
  characterAvatarByName,
  characterExpressionByRef,
  characterPortraitByName,
  characterPortraitHorizontalByName,
  ensureCharacterAssetPackCatalog,
  listCharacterAssetPackGroups,
  normalizeCharacterAssets,
  type CharacterAssetPackOption,
} from '@renderer/data/character-asset-catalog'
import { arenaInvoke, characterService, createEmptyCharacter, formatUserMessage } from '@renderer/services/arena'
import { materializeCharacterPackSelection } from '@renderer/services/arena/character-asset-pack'
import { readImageFileWithValidation, specHint } from '@renderer/utils/character-image-upload'
import { cloneJson } from '@shared/clone-json'
import {
  CHARACTER_EXPRESSIONS,
  isDirectImageRef,
  type CharacterExpressionId,
  type CharacterImageSlot,
} from '@shared/arena/character-visuals'
import { isOwnedAssetRef } from '@shared/arena/character-owned-assets'
import type { Character } from '@shared/arena/types'

type EditorTab = 'avatar' | 'portrait-vertical' | 'portrait-horizontal' | 'expressions'
type SlotStatus = 'empty' | 'pack' | 'custom' | 'fallback'

const show = defineModel<boolean>({ default: false })

const props = defineProps<{
  character: Character
}>()

const emit = defineEmits<{
  saved: [character: Character]
}>()

const draft = ref<Character>(createEmptyCharacter())
const saving = ref(false)
const applyingPack = ref(false)
const selectedPackId = ref<string | null>(null)
const error = ref('')
const activeTab = ref<EditorTab>('avatar')
const activeExpression = ref<CharacterExpressionId>('neutral')
const uploadInput = ref<HTMLInputElement | null>(null)
const pendingUploadSlot = ref<CharacterImageSlot>('avatar')
const pendingExpressionId = ref<CharacterExpressionId>('neutral')
const previewRevision = ref(0)

function bumpPreviewRevision() {
  previewRevision.value += 1
}

function withPreviewCache(url: string): string {
  return appendAssetCacheBust(url, `${draft.value.updatedAt || ''}-${previewRevision.value}`)
}

const packGroups = ref<Array<{ label: string; options: CharacterAssetPackOption[] }>>([])
const packCatalogLoading = ref(false)
const packCount = computed(() => packGroups.value.reduce((n, g) => n + g.options.length, 0))

const tabItems: Array<{ id: EditorTab; label: string; slot: CharacterImageSlot }> = [
  { id: 'avatar', label: '头像', slot: 'avatar' },
  { id: 'portrait-vertical', label: '竖版立绘', slot: 'portrait-vertical' },
  { id: 'portrait-horizontal', label: '横版立绘', slot: 'portrait-horizontal' },
  { id: 'expressions', label: '表情', slot: 'expression' },
]

const activeTabMeta = computed(() => tabItems.find((t) => t.id === activeTab.value) || tabItems[0])
const activeExpressionLabel = computed(
  () => CHARACTER_EXPRESSIONS.find((x) => x.id === activeExpression.value)?.label || '默认'
)

const currentAvatar = computed(() =>
  withPreviewCache(characterAvatarByName(draft.value.name, 0, draft.value.modelId, draft.value.avatarUrl, draft.value.id))
)
const currentPortrait = computed(() =>
  withPreviewCache(characterPortraitByName(draft.value.name, 0, draft.value.modelId, draft.value.portraitUrl, draft.value.id))
)
const currentBanner = computed(() =>
  withPreviewCache(
    characterPortraitHorizontalByName(
      draft.value.name,
      0,
      draft.value.modelId,
      draft.value.portraitHorizontalUrl || '',
      draft.value.portraitUrl,
      draft.value.id
    )
  )
)

function slotRef(slot: CharacterImageSlot, expressionId?: CharacterExpressionId): string {
  if (slot === 'avatar') return draft.value.avatarUrl || ''
  if (slot === 'portrait-vertical') return draft.value.portraitUrl || ''
  if (slot === 'portrait-horizontal') return draft.value.portraitHorizontalUrl || ''
  if (slot === 'expression' && expressionId) return draft.value.expressionUrls?.[expressionId] || ''
  return ''
}

function slotStatus(slot: CharacterImageSlot, expressionId?: CharacterExpressionId): SlotStatus {
  const ref = slotRef(slot, expressionId)
  if (!ref.trim()) return 'empty'
  if (isOwnedAssetRef(ref) || isDirectImageRef(ref)) return 'custom'
  if (slot === 'expression' && expressionId && expressionId !== 'neutral') {
    if (!ref.includes(`/expression/${expressionId}`) && !ref.includes(`/avatar/${expressionId}`)) {
      return 'fallback'
    }
  }
  return 'pack'
}

function previewUrl(tab: EditorTab, expressionId?: CharacterExpressionId): string {
  if (tab === 'avatar') return currentAvatar.value
  if (tab === 'portrait-vertical') return currentPortrait.value
  if (tab === 'portrait-horizontal') return currentBanner.value
  return expressionPreview(expressionId || activeExpression.value)
}

function expressionPreview(id: CharacterExpressionId): string {
  const ref = draft.value.expressionUrls?.[id] || draft.value.avatarUrl
  return withPreviewCache(
    characterExpressionByRef(ref, {
      modelId: draft.value.modelId,
      expressionId: id,
      characterId: draft.value.id,
    })
  )
}

function isPreviewEmpty(tab: EditorTab, expressionId?: CharacterExpressionId): boolean {
  const slot = tab === 'expressions' ? 'expression' : tab
  const status = slotStatus(slot, expressionId)
  if (status === 'empty') return true
  const url = previewUrl(tab, expressionId)
  return !url
}

function uploadLabel(tab: EditorTab): string {
  if (tab === 'avatar') return '上传头像'
  if (tab === 'portrait-vertical') return '上传竖版立绘'
  if (tab === 'portrait-horizontal') return '上传横版立绘'
  return `上传${activeExpressionLabel.value}表情`
}

function replaceUploadLabel(tab: EditorTab): string {
  if (tab === 'avatar') return '更换头像'
  if (tab === 'portrait-vertical') return '更换竖版立绘'
  if (tab === 'portrait-horizontal') return '更换横版立绘'
  return `更换${activeExpressionLabel.value}表情`
}

function pickUpload(slot: CharacterImageSlot, expressionId: CharacterExpressionId = 'neutral') {
  pendingUploadSlot.value = slot
  pendingExpressionId.value = expressionId
  uploadInput.value?.click()
}

function openCurrentUpload() {
  if (activeTab.value === 'expressions') pickUpload('expression', activeExpression.value)
  else pickUpload(activeTab.value)
}

function selectExpression(id: CharacterExpressionId) {
  activeExpression.value = id
}

function inferSelectedPackId(character: Character): string | null {
  if (character.visualPackId) return character.visualPackId
  const ref = character.avatarUrl || character.portraitUrl || ''
  const match = ref.match(/asset:\/\/pack\/([^/]+)\//)
  return match?.[1] || null
}

function loadDraft() {
  draft.value = normalizeCharacterAssets(cloneJson(props.character))
  selectedPackId.value = inferSelectedPackId(draft.value)
}

async function loadPackCatalog() {
  packCatalogLoading.value = true
  try {
    await ensureCharacterAssetPackCatalog({ refresh: true })
    packGroups.value = listCharacterAssetPackGroups(draft.value.modelId)
  } catch {
    packGroups.value = listCharacterAssetPackGroups()
  } finally {
    packCatalogLoading.value = false
  }
}

async function applyPack(option: CharacterAssetPackOption) {
  if (applyingPack.value) return
  applyingPack.value = true
  error.value = ''
  try {
    draft.value = await materializeCharacterPackSelection(draft.value, option)
    selectedPackId.value = option.characterId
    bumpPreviewRevision()
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    applyingPack.value = false
  }
}

async function onUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  const slot = pendingUploadSlot.value
  const result = await readImageFileWithValidation(file, slot)
  if (!result.ok) {
    error.value = result.message
    return
  }

  error.value = ''
  const writeOwnedAsset = async () => {
    if (!window.api.writeCharacterAsset) {
      throw new Error('当前环境不支持写入角色素材')
    }
    return arenaInvoke('storage', 'writeAsset', () =>
      window.api.writeCharacterAsset(
        draft.value.id,
        slot,
        slot === 'expression' ? pendingExpressionId.value : null,
        result.dataUrl
      )
    )
  }

  try {
    if (slot === 'avatar') {
      draft.value.avatarUrl = await writeOwnedAsset()
      draft.value.visualPackId = undefined
      if (!draft.value.expressionUrls) draft.value.expressionUrls = {}
      draft.value.expressionUrls.neutral = draft.value.avatarUrl
    } else if (slot === 'portrait-vertical') {
      draft.value.portraitUrl = await writeOwnedAsset()
      draft.value.visualPackId = undefined
    } else if (slot === 'portrait-horizontal') {
      draft.value.portraitHorizontalUrl = await writeOwnedAsset()
      draft.value.visualPackId = undefined
    } else if (slot === 'expression') {
      if (!draft.value.expressionUrls) draft.value.expressionUrls = {}
      const expressionRef = await writeOwnedAsset()
      draft.value.expressionUrls[pendingExpressionId.value] = expressionRef
      if (pendingExpressionId.value === 'neutral') draft.value.avatarUrl = expressionRef
      draft.value.visualPackId = undefined
    }
    bumpPreviewRevision()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '上传素材失败'
  }
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    const saved = await characterService.save(normalizeCharacterAssets(draft.value))
    show.value = false
    emit('saved', saved)
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    saving.value = false
  }
}

watch(show, (open) => {
  if (!open) return
  error.value = ''
  activeTab.value = 'avatar'
  activeExpression.value = 'neutral'
  void nextTick(async () => {
    if (!show.value) return
    await loadPackCatalog()
    loadDraft()
  })
}, { immediate: true })
</script>

<template>
  <DetailEditDialog
    v-model="show"
    title="编辑形象素材"
    subtitle="左侧预览与上传 · 右侧选择资产包"
    :saving="saving"
    @save="save"
  >
    <div class="visual-editor">
      <p v-if="error" class="visual-editor__error">{{ error }}</p>

      <div class="visual-editor__layout">
        <section class="visual-editor__workspace">
          <nav class="visual-editor__tabs" aria-label="素材类型">
            <button
              v-for="tab in tabItems"
              :key="tab.id"
              type="button"
              :class="{ active: activeTab === tab.id }"
              @click="activeTab = tab.id"
            >
              {{ tab.label }}
            </button>
          </nav>

          <div class="visual-editor__stage">
            <div class="preview-stage">
              <div
                class="preview-frame"
                :class="{ 'preview-frame--empty': isPreviewEmpty(activeTab, activeExpression) }"
              >
                <button
                  type="button"
                  class="preview-frame__canvas"
                  :aria-label="uploadLabel(activeTab)"
                  @click="openCurrentUpload"
                >
                  <template v-if="!isPreviewEmpty(activeTab, activeExpression)">
                    <img
                      class="preview-frame__image"
                      :src="previewUrl(activeTab, activeExpression)"
                      alt=""
                    />
                    <span class="preview-frame__overlay">
                      <Upload :size="16" />
                      <span>{{ replaceUploadLabel(activeTab) }}</span>
                    </span>
                  </template>
                  <template v-else>
                    <div class="preview-frame__placeholder">
                      <ImagePlus :size="24" />
                      <strong>{{ uploadLabel(activeTab) }}</strong>
                      <em>或从右侧资产库套用</em>
                    </div>
                  </template>
                </button>
              </div>
            </div>

            <p class="preview-spec">
              {{ activeTab === 'expressions' ? specHint('expression') : specHint(activeTabMeta.slot) }}
            </p>

            <div v-if="activeTab === 'expressions'" class="expression-strip" aria-label="表情切换">
              <button
                v-for="item in CHARACTER_EXPRESSIONS"
                :key="item.id"
                type="button"
                class="expression-chip"
                :class="{
                  active: activeExpression === item.id,
                  'expression-chip--empty': slotStatus('expression', item.id) === 'empty' || slotStatus('expression', item.id) === 'fallback',
                }"
                :title="item.label"
                @click="selectExpression(item.id)"
              >
                <span class="expression-chip__frame">
                  <img
                    v-if="!isPreviewEmpty('expressions', item.id)"
                    :src="expressionPreview(item.id)"
                    alt=""
                  />
                  <span v-else class="expression-chip__placeholder">
                    <ImagePlus :size="12" />
                  </span>
                </span>
                <span class="expression-chip__label">{{ item.label }}</span>
              </button>
            </div>
          </div>
        </section>

        <aside class="visual-editor__library">
          <div class="visual-editor__library-head">
            <strong>资产库</strong>
            <span>共 {{ packCount }} 套 · 点击套用</span>
          </div>
          <div class="visual-editor__library-scroll">
            <p v-if="packCatalogLoading" class="visual-editor__empty">正在加载素材包…</p>
            <p v-else-if="!packCount" class="visual-editor__empty">未找到角色素材包，可使用内置默认素材或于设置中心导入 zip。</p>
            <div v-for="group in packGroups" :key="group.label" class="visual-editor__pack-group">
              <h3 class="visual-editor__pack-group-title">{{ group.label }}</h3>
              <div class="visual-editor__pack-grid">
                <button
                  v-for="option in group.options"
                  :key="option.characterId"
                  type="button"
                  class="visual-editor__pack-card"
                  :class="{ active: selectedPackId === option.characterId }"
                  :disabled="applyingPack"
                  @click="applyPack(option)"
                >
                  <img :src="option.previewAvatarUrl" alt="" class="visual-editor__pack-avatar" />
                  <img :src="option.previewPortraitUrl" alt="" class="visual-editor__pack-portrait" />
                  <span>{{ option.label }}</span>
                  <em v-if="option.palette">{{ option.palette }}</em>
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <input ref="uploadInput" class="hidden-file" type="file" accept="image/png,image/jpeg,image/webp" @change="onUpload" />
    </div>
  </DetailEditDialog>
</template>

<style scoped>
.visual-editor {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  gap: 12px;
  min-height: 380px;
  overflow: hidden;
}

.visual-editor__error {
  margin: 0;
  flex: none;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(239, 68, 68, 0.08);
  color: #dc2626;
  font-size: 13px;
}

.visual-editor__layout {
  display: grid;
  grid-template-columns: minmax(260px, 320px) minmax(240px, 1fr);
  gap: 0;
  flex: 1 1 auto;
  min-height: 320px;
  overflow: hidden;
}

.visual-editor__workspace {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  padding-right: 16px;
  border-right: 1px solid rgba(130, 142, 207, 0.12);
  min-height: 0;
  overflow: hidden;
}

.visual-editor__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.visual-editor__tabs button {
  height: 32px;
  padding: 0 11px;
  border: 1px solid rgba(130, 142, 207, 0.15);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.55);
  color: #5f6a9e;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.visual-editor__tabs button.active {
  border-color: rgba(108, 99, 255, 0.25);
  background: rgba(112, 105, 255, 0.12);
  color: #5b57f3;
}

.visual-editor__stage {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.preview-stage {
  display: flex;
  flex: 1;
  min-height: 0;
}

.preview-frame {
  display: flex;
  flex: 1;
  width: 100%;
  min-height: 0;
  border: 1px dashed rgba(130, 142, 207, 0.28);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.42);
  overflow: hidden;
  transition: border-color 0.15s ease;
}

.preview-frame:hover {
  border-color: rgba(108, 99, 255, 0.35);
}

.preview-frame__canvas {
  position: relative;
  flex: 1;
  width: 100%;
  min-height: 0;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  overflow: hidden;
  font: inherit;
}

.preview-frame__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
}

.preview-frame__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: rgba(15, 18, 42, 0.42);
  color: #fff;
  font-size: 12px;
  line-height: 1.2;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.preview-frame__overlay span {
  margin: 0;
}

.preview-frame__canvas:hover .preview-frame__overlay {
  opacity: 1;
}

.preview-frame--empty .preview-frame__canvas {
  background:
    linear-gradient(135deg, rgba(112, 105, 255, 0.05), rgba(255, 255, 255, 0.42)),
    repeating-linear-gradient(
      -45deg,
      rgba(130, 142, 207, 0.05),
      rgba(130, 142, 207, 0.05) 8px,
      rgba(255, 255, 255, 0.2) 8px,
      rgba(255, 255, 255, 0.2) 16px
    );
}

.preview-frame--empty {
  border-style: dashed;
}

.preview-frame__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 16px;
  color: #7a85b0;
  text-align: center;
}

.preview-frame__placeholder strong {
  color: #4e5789;
  font-size: 13px;
  font-weight: 600;
}

.preview-frame__placeholder em {
  font-style: normal;
  font-size: 11px;
  line-height: 1.5;
}

.preview-spec {
  margin: 8px 0 0;
  flex: none;
  color: #7a85b0;
  font-size: 12px;
  line-height: 1.55;
}

.expression-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  flex: none;
  margin-top: 8px;
  padding-top: 8px;
}

.expression-chip {
  display: grid;
  gap: 3px;
  width: 44px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: center;
  font: inherit;
}

.expression-chip.active .expression-chip__frame {
  border-color: rgba(108, 99, 255, 0.45);
  box-shadow: 0 0 0 2px rgba(112, 105, 255, 0.14);
}

.expression-chip--empty .expression-chip__frame {
  border-style: dashed;
  background: rgba(130, 142, 207, 0.06);
}

.expression-chip__frame {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  margin: 0 auto;
  border: 1px solid rgba(130, 142, 207, 0.18);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.7);
}

.expression-chip__frame img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
}

.expression-chip__placeholder {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  color: #9aa3c7;
}

.expression-chip__label {
  color: #5f6a9e;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.2;
}

.visual-editor__library {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-left: 16px;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

.visual-editor__library-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex: none;
}

.visual-editor__library-head strong {
  color: #17205a;
  font-size: 14px;
}

.visual-editor__library-head span {
  color: #9aa3c7;
  font-size: 12px;
}

.visual-editor__library-scroll {
  flex: 1 1 auto;
  min-height: 220px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 2px;
  scrollbar-width: thin;
  overscroll-behavior: contain;
}

.visual-editor__empty {
  margin: 0;
  padding: 12px 4px;
  color: #8a82ad;
  font-size: 12px;
  line-height: 1.55;
}

.visual-editor__pack-group {
  margin-bottom: 14px;
}

.visual-editor__pack-group-title {
  margin: 0 0 8px;
  color: #66709d;
  font-size: 12px;
  font-weight: 650;
}

.visual-editor__pack-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.visual-editor__pack-card {
  position: relative;
  min-height: 88px;
  padding: 8px 8px 8px 72px;
  border: 1px solid rgba(130, 142, 207, 0.14);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  text-align: left;
  cursor: pointer;
  font: inherit;
}

.visual-editor__pack-card:disabled {
  opacity: 0.6;
  cursor: wait;
}

.visual-editor__pack-card.active {
  border-color: rgba(108, 99, 255, 0.34);
  background: rgba(112, 105, 255, 0.1);
  box-shadow: inset 0 0 0 1px rgba(108, 99, 255, 0.08);
}

.visual-editor__pack-avatar {
  position: absolute;
  left: 8px;
  top: 8px;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  object-fit: cover;
}

.visual-editor__pack-portrait {
  position: absolute;
  left: 8px;
  bottom: 8px;
  width: 56px;
  height: 36px;
  border-radius: 10px;
  object-fit: cover;
  opacity: 0.92;
}

.visual-editor__pack-card span {
  display: block;
  color: #17205a;
  font-size: 13px;
  font-weight: 600;
}

.visual-editor__pack-card em {
  display: block;
  margin-top: 4px;
  color: #7a85b0;
  font-style: normal;
  font-size: 11px;
  line-height: 1.4;
}

.hidden-file {
  display: none;
}

@media (max-width: 820px) {
  .visual-editor {
    flex: 1 1 auto;
    overflow: visible;
  }

  .visual-editor__layout {
    grid-template-columns: 1fr;
    flex: 1 1 auto;
    overflow: visible;
  }

  .visual-editor__workspace {
    padding-right: 0;
    padding-bottom: 14px;
    border-right: 0;
    border-bottom: 1px solid rgba(130, 142, 207, 0.12);
    overflow: visible;
  }

  .visual-editor__stage {
    overflow: visible;
  }

  .visual-editor__library {
    padding-left: 0;
    overflow: visible;
  }

  .visual-editor__library-scroll {
    flex: none;
    max-height: 280px;
  }
}
</style>
