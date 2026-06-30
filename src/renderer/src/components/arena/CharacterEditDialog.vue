<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Check, Plus } from 'lucide-vue-next'
import ArenaSwitch from '@renderer/components/arena/ArenaSwitch.vue'
import DetailEditDialog from '@renderer/components/arena/DetailEditDialog.vue'
import ModelPickerField from '@renderer/components/arena/ModelPickerField.vue'
import {
  appendAssetCacheBust,
  characterAvatarByName,
  characterPortraitByName,
  ensureCharacterAssetPackCatalog,
  listCharacterAssetPackGroups,
  type CharacterAssetPackOption,
} from '@renderer/data/character-asset-catalog'
import {
  CHARACTER_SPEECH_STYLES,
  CHARACTER_TAG_PRESETS,
} from '@renderer/data/character-edit-presets'
import {
  characterService,
  createEmptyCharacter,
  formatUserMessage,
  getFallbackModelId,
} from '@renderer/services/arena'
import { materializeCharacterPackSelection } from '@renderer/services/arena/character-asset-pack'
import { cloneJson } from '@shared/clone-json'
import type { Character } from '@shared/arena/types'

export type CharacterEditSection =
  | 'create'
  | 'basics'
  | 'profile'
  | 'model'
  | 'tags'
  | 'voice'
  | 'principles'
  | 'taboos'
  | 'strengths'
  | 'weaknesses'

const speechStyles = CHARACTER_SPEECH_STYLES
const tagPresets = CHARACTER_TAG_PRESETS
const packGroups = ref<Array<{ label: string; options: CharacterAssetPackOption[] }>>([])
const packCatalogLoading = ref(false)
const applyingPack = ref(false)
const selectedPackId = ref<string | null>(null)
const previewRevision = ref(0)

const genderOptions: Array<{ value: Character['gender']; label: string }> = [
  { value: 'female', label: '女' },
  { value: 'male', label: '男' },
  { value: 'other', label: '其他' },
]

const show = defineModel<boolean>({ default: false })

const props = defineProps<{
  character?: Character | null
  section: CharacterEditSection
}>()

const emit = defineEmits<{
  saved: [character: Character]
}>()

const draft = ref<Character>(createEmptyCharacter())
const saving = ref(false)
const error = ref('')
const draftPhrase = ref('')
const draftPrinciple = ref('')
const draftTaboo = ref('')
const draftStrength = ref('')
const draftWeakness = ref('')

const isCreate = computed(() => props.section === 'create')

const statusEnabled = computed({
  get: () => draft.value.status === 'enabled',
  set: (enabled: boolean) => {
    draft.value.status = enabled ? 'enabled' : 'disabled'
  },
})

const sectionMeta: Record<CharacterEditSection, { title: string; subtitle: string; saveLabel: string }> = {
  create: { title: '创建角色', subtitle: '新角色会保存到本地角色库', saveLabel: '创建角色' },
  basics: { title: '编辑名称', subtitle: '角色名与一句话设定', saveLabel: '保存' },
  profile: { title: '编辑角色档案', subtitle: '背景、性别与年龄感', saveLabel: '保存' },
  model: { title: '绑定模型', subtitle: '选择角色使用的 AI 模型', saveLabel: '保存' },
  tags: { title: '编辑人设标签', subtitle: '用于筛选与提示词拼装', saveLabel: '保存' },
  voice: { title: '编辑说话方式', subtitle: '语气与常用发言', saveLabel: '保存' },
  principles: { title: '编辑行为原则', subtitle: '对局中的判断准则', saveLabel: '保存' },
  taboos: { title: '编辑禁忌行为', subtitle: '角色应当避免的行为', saveLabel: '保存' },
  strengths: { title: '编辑擅长', subtitle: '角色擅长的方面', saveLabel: '保存' },
  weaknesses: { title: '编辑短板', subtitle: '角色的弱点或局限', saveLabel: '保存' },
}

const currentAvatar = computed(() =>
  appendAssetCacheBust(
    characterAvatarByName(draft.value.name, 0, draft.value.modelId, draft.value.avatarUrl, draft.value.id),
    `${draft.value.updatedAt || ''}-${previewRevision.value}`
  )
)
const currentPortrait = computed(() =>
  appendAssetCacheBust(
    characterPortraitByName(draft.value.name, 0, draft.value.modelId, draft.value.portraitUrl, draft.value.id),
    `${draft.value.updatedAt || ''}-${previewRevision.value}`
  )
)

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

function resetCreateDraft() {
  draft.value = createEmptyCharacter({
    name: '新角色',
    subtitle: '写一句能被记住的角色设定',
    ageLabel: '18岁',
    speechStyle: '温柔',
    modelId: getFallbackModelId(),
    accentColor: '#8b6cff',
  })
  selectedPackId.value = draft.value.visualPackId || null
}

function loadDraft() {
  if (isCreate.value) {
    resetCreateDraft()
    return
  }
  if (props.character) {
    draft.value = cloneJson(props.character)
    selectedPackId.value = draft.value.visualPackId || null
  }
}

async function applyPack(option: CharacterAssetPackOption) {
  if (applyingPack.value) return
  applyingPack.value = true
  error.value = ''
  try {
    draft.value = await materializeCharacterPackSelection(draft.value, option)
    selectedPackId.value = option.characterId
    previewRevision.value += 1
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    applyingPack.value = false
  }
}

function toggleTag(tag: string) {
  const idx = draft.value.tags.indexOf(tag)
  if (idx >= 0) draft.value.tags.splice(idx, 1)
  else draft.value.tags.push(tag)
}

function addPhrase() {
  const value = draftPhrase.value.trim()
  if (!value) return
  draft.value.commonPhrases.push(value)
  draftPhrase.value = ''
}

function addPrinciple() {
  const value = draftPrinciple.value.trim()
  if (!value) return
  draft.value.behaviorPrinciples.push(value)
  draftPrinciple.value = ''
}

function addTaboo() {
  const value = draftTaboo.value.trim()
  if (!value) return
  draft.value.tabooBehaviors.push(value)
  draftTaboo.value = ''
}

function addStrength() {
  const value = draftStrength.value.trim()
  if (!value) return
  draft.value.strengths.push(value)
  draftStrength.value = ''
}

function addWeakness() {
  const value = draftWeakness.value.trim()
  if (!value) return
  draft.value.weaknesses.push(value)
  draftWeakness.value = ''
}

async function save() {
  if (!draft.value.name.trim()) {
    error.value = '角色名称不能为空'
    return
  }
  saving.value = true
  error.value = ''
  try {
    if (isCreate.value) {
      draft.value.modelId = getFallbackModelId()
    }
    const saved = await characterService.save(draft.value)
    show.value = false
    emit('saved', saved)
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    saving.value = false
  }
}

watch(
  () => [show.value, props.section, props.character?.id] as const,
  ([open]) => {
    if (!open) return
    error.value = ''
    draftPhrase.value = ''
    draftPrinciple.value = ''
    draftTaboo.value = ''
    draftStrength.value = ''
    draftWeakness.value = ''
    void nextTick(async () => {
      if (!show.value) return
      if (props.section === 'create') await loadPackCatalog()
      loadDraft()
    })
  },
  { immediate: true }
)
</script>

<template>
  <DetailEditDialog
    v-model="show"
    :title="sectionMeta[section].title"
    :subtitle="sectionMeta[section].subtitle"
    :save-label="sectionMeta[section].saveLabel"
    :saving="saving"
    @save="save"
  >
    <div class="detail-form-body">
      <p v-if="error" class="detail-form-error">{{ error }}</p>

      <template v-if="section === 'create'">
        <label class="detail-form-field"><span>角色名</span><input v-model="draft.name" class="detail-form-input" maxlength="20" /></label>
        <label class="detail-form-field"><span>一句话设定</span><input v-model="draft.subtitle" class="detail-form-input" maxlength="36" /></label>
        <label class="detail-form-field"><span>档案简介</span><textarea v-model="draft.bio" class="detail-form-input detail-form-input--tall" rows="5" /></label>
        <label class="detail-form-field"><span>年龄感</span><input v-model="draft.ageLabel" class="detail-form-input" maxlength="12" /></label>
        <div class="detail-form-setting-row">
          <div>
            <strong>启用角色</strong>
            <span>停用后不会出现在对局选人列表</span>
          </div>
          <ArenaSwitch v-model="statusEnabled" />
        </div>
        <div class="detail-form-field">
          <span>性别</span>
          <div class="detail-form-segmented">
            <button
              v-for="option in genderOptions"
              :key="option.value"
              type="button"
              :class="{ active: draft.gender === option.value }"
              @click="draft.gender = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
        <div class="create-visual-preview">
          <img class="create-visual-preview__portrait" :src="currentPortrait" alt="" />
          <img class="create-visual-preview__avatar" :src="currentAvatar" alt="" />
        </div>
        <div class="preset-grid">
          <p v-if="packCatalogLoading" class="create-visual-hint">正在加载素材包…</p>
          <template v-else-if="packGroups.length">
            <section v-for="group in packGroups" :key="group.label" class="preset-grid__group">
              <h4 class="preset-grid__group-title">{{ group.label }}</h4>
              <div class="preset-grid__items">
                <button
                  v-for="option in group.options"
                  :key="option.characterId"
                  type="button"
                  :class="{ active: selectedPackId === option.characterId }"
                  :disabled="applyingPack"
                  @click="applyPack(option)"
                >
                  <img :src="option.previewAvatarUrl" alt="" />
                  <span>{{ option.label }}</span>
                </button>
              </div>
            </section>
          </template>
          <p v-else class="create-visual-hint">未找到角色素材包，可使用内置默认素材或于设置中心导入 zip。</p>
        </div>
        <p class="create-visual-hint">创建后可在角色详情页点击头像，进一步上传或替换各表情素材。对话模型将自动使用系统默认模型。</p>
      </template>

      <template v-else-if="section === 'basics'">
        <label class="detail-form-field"><span>角色名</span><input v-model="draft.name" class="detail-form-input" maxlength="20" /></label>
        <label class="detail-form-field"><span>一句话设定</span><input v-model="draft.subtitle" class="detail-form-input" maxlength="36" placeholder="写一句能被记住的角色设定" /></label>
      </template>

      <template v-else-if="section === 'profile'">
        <label class="detail-form-field"><span>档案简介</span><textarea v-model="draft.bio" class="detail-form-input detail-form-input--tall" rows="5" placeholder="背景、语气与推理偏好" /></label>
        <label class="detail-form-field"><span>年龄感</span><input v-model="draft.ageLabel" class="detail-form-input" maxlength="12" placeholder="例如 18岁" /></label>
        <div class="detail-form-field">
          <span>性别</span>
          <div class="detail-form-segmented">
            <button
              v-for="option in genderOptions"
              :key="option.value"
              type="button"
              :class="{ active: draft.gender === option.value }"
              @click="draft.gender = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
      </template>

      <template v-else-if="section === 'model'">
        <ModelPickerField
          v-model="draft.modelId"
          label="角色模型"
          hint="从网关模型列表中选择；对局发言、投票与私聊均使用此模型。"
        />
      </template>

      <template v-else-if="section === 'tags'">
        <div class="detail-form-tag-editor">
          <button v-for="tag in tagPresets" :key="tag" type="button" :class="{ active: draft.tags.includes(tag) }" @click="toggleTag(tag)">
            <Check v-show="draft.tags.includes(tag)" :size="14" />{{ tag }}
          </button>
        </div>
      </template>

      <template v-else-if="section === 'voice'">
        <div class="detail-form-field">
          <span>语气风格</span>
          <div class="detail-form-segmented">
            <button v-for="style in speechStyles" :key="style" type="button" :class="{ active: draft.speechStyle === style }" @click="draft.speechStyle = style">{{ style }}</button>
          </div>
        </div>
        <div class="detail-form-add-row"><input v-model="draftPhrase" class="detail-form-input" placeholder="添加常用发言" @keyup.enter="addPhrase" /><button type="button" @click="addPhrase"><Plus :size="16" /></button></div>
        <div class="detail-form-chip-list">
          <span v-for="(phrase, index) in draft.commonPhrases" :key="phrase + index">{{ phrase }}<button type="button" @click="draft.commonPhrases.splice(index, 1)">×</button></span>
        </div>
      </template>

      <template v-else-if="section === 'principles'">
        <div class="detail-form-add-row"><input v-model="draftPrinciple" class="detail-form-input" placeholder="添加行为原则" @keyup.enter="addPrinciple" /><button type="button" @click="addPrinciple"><Plus :size="16" /></button></div>
        <div class="detail-form-chip-list detail-form-chip-list--stack">
          <span v-for="(item, index) in draft.behaviorPrinciples" :key="item + index">{{ item }}<button type="button" @click="draft.behaviorPrinciples.splice(index, 1)">×</button></span>
        </div>
        <p v-if="!draft.behaviorPrinciples.length" class="detail-form-empty-hint">暂无行为原则，添加后会在对局提示词中使用。</p>
      </template>

      <template v-else-if="section === 'taboos'">
        <div class="detail-form-add-row"><input v-model="draftTaboo" class="detail-form-input" placeholder="添加禁忌行为" @keyup.enter="addTaboo" /><button type="button" @click="addTaboo"><Plus :size="16" /></button></div>
        <div class="detail-form-chip-list detail-form-chip-list--stack">
          <span v-for="(item, index) in draft.tabooBehaviors" :key="item + index">{{ item }}<button type="button" @click="draft.tabooBehaviors.splice(index, 1)">×</button></span>
        </div>
        <p v-if="!draft.tabooBehaviors.length" class="detail-form-empty-hint">暂无禁忌行为。</p>
      </template>

      <template v-else-if="section === 'strengths'">
        <div class="detail-form-add-row"><input v-model="draftStrength" class="detail-form-input" placeholder="添加擅长项" @keyup.enter="addStrength" /><button type="button" @click="addStrength"><Plus :size="16" /></button></div>
        <div class="detail-form-chip-list">
          <span v-for="(item, index) in draft.strengths" :key="item + index">{{ item }}<button type="button" @click="draft.strengths.splice(index, 1)">×</button></span>
        </div>
        <p v-if="!draft.strengths.length" class="detail-form-empty-hint">未标注擅长项。</p>
      </template>

      <template v-else-if="section === 'weaknesses'">
        <div class="detail-form-add-row"><input v-model="draftWeakness" class="detail-form-input" placeholder="添加短板" @keyup.enter="addWeakness" /><button type="button" @click="addWeakness"><Plus :size="16" /></button></div>
        <div class="detail-form-chip-list">
          <span v-for="(item, index) in draft.weaknesses" :key="item + index">{{ item }}<button type="button" @click="draft.weaknesses.splice(index, 1)">×</button></span>
        </div>
        <p v-if="!draft.weaknesses.length" class="detail-form-empty-hint">未标注短板。</p>
      </template>
    </div>
  </DetailEditDialog>
</template>

<style scoped>
.create-visual-preview { position: relative; height: 132px; margin-bottom: 12px; border-radius: 16px; overflow: hidden; background: rgba(255,255,255,.45); border: 1px solid rgba(130,142,207,.12); }
.create-visual-preview__portrait { width: 100%; height: 100%; object-fit: cover; object-position: center top; }
.create-visual-preview__avatar { position: absolute; right: 10px; bottom: 10px; width: 52px; height: 52px; border-radius: 16px; object-fit: cover; box-shadow: 0 8px 18px rgba(50,56,120,.18); border: 2px solid rgba(255,255,255,.92); }
.create-visual-hint { margin: 0 0 12px; color: #9aa3c7; font-size: 12px; line-height: 1.5; }
.preset-grid { display: flex; flex-direction: column; gap: 10px; margin-bottom: 8px; max-height: 220px; overflow: auto; }
.preset-grid__group-title { margin: 0 0 6px; color: #7280b2; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; }
.preset-grid__items { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.preset-grid button { height: 54px; padding: 6px; border: 1px solid rgba(130,142,207,.15); border-radius: 14px; display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,.55); cursor: pointer; }
.preset-grid button.active { border-color: rgba(108,99,255,.34); background: rgba(112,105,255,.12); }
.preset-grid img { width: 32px; height: 32px; border-radius: 10px; object-fit: cover; }
.preset-grid span { font-size: 12px; color: #4e5789; }
.hidden-file { display: none; }
</style>
