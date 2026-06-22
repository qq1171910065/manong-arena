<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Check, ChevronRight, ImagePlus, Loader2, Plus, Search, Sparkles, Trash2, Upload, X } from 'lucide-vue-next'
import ArenaPageShell from '@renderer/components/arena/ArenaPageShell.vue'
import ArenaPageState from '@renderer/components/arena/ArenaPageState.vue'
import { characterAvatarByName, characterPortraitByName } from '@renderer/data/arena-visual-assets'
import { listGatewayModels, type GatewayModelInfo } from '@renderer/services/gateway-api'
import { goBack, navigate, route } from '../router'
import { characterService, createEmptyCharacter, formatUserMessage } from '@renderer/services/arena'
import type { Character } from '@shared/arena/types'

const visualPresets = [
  { key: 'doubao', name: '豆包', modelId: 'doubao', accent: '#8b6cff' },
  { key: 'gpt', name: 'GPT', modelId: 'gpt-4o', accent: '#5e8dff' },
  { key: 'claude', name: 'Claude', modelId: 'claude-3-5-sonnet', accent: '#f2a35f' },
  { key: 'deepseek', name: 'DeepSeek', modelId: 'deepseek-chat', accent: '#5f74ff' },
  { key: 'kimi', name: 'Kimi', modelId: 'kimi', accent: '#a873f6' },
  { key: 'gemini', name: 'Gemini', modelId: 'gemini-pro', accent: '#ee73ad' },
  { key: 'qwen', name: 'Qwen', modelId: 'qwen-max', accent: '#14b8a6' },
  { key: 'mistral', name: 'Mistral', modelId: 'mistral-large-latest', accent: '#f59e0b' },
  { key: 'llama', name: 'Llama', modelId: 'llama-3.1-70b', accent: '#22c55e' },
  { key: 'hunyuan', name: 'Hunyuan', modelId: 'hunyuan-turbo', accent: '#8b5cf6' },
  { key: 'glm', name: 'GLM', modelId: 'glm-4-plus', accent: '#0ea5e9' },
  { key: 'minimax', name: 'MiniMax', modelId: 'abab6.5-chat', accent: '#ec4899' },
  { key: 'yi', name: 'Yi', modelId: 'yi-large', accent: '#64748b' },
  { key: 'ernie', name: 'Ernie', modelId: 'ernie-4.0-turbo-8k', accent: '#2563eb' },
  { key: 'grok', name: 'Grok', modelId: 'grok-2-1212', accent: '#171717' },
  { key: 'spark', name: 'Spark', modelId: 'spark-max', accent: '#f97316' },
]

const commonModelSeeds = [
  { id: 'doubao', label: '豆包', vendor: 'ByteDance', desc: '默认中文角色模型，适合轻量对局与日常推理。' },
  { id: 'gpt-4o', label: 'GPT-4o', vendor: 'OpenAI', desc: '综合能力均衡，适合信息整合和稳定发言。' },
  { id: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet', vendor: 'Anthropic', desc: '表达细腻，适合长线推理和谨慎角色。' },
  { id: 'deepseek-chat', label: 'DeepSeek Chat', vendor: 'DeepSeek', desc: '推理成本友好，适合大规模角色对局。' },
  { id: 'kimi', label: 'Kimi', vendor: 'Moonshot', desc: '适合长上下文和线索整理型角色。' },
  { id: 'gemini-pro', label: 'Gemini Pro', vendor: 'Google', desc: '适合开放式发言和多模态扩展预留。' },
  { id: 'qwen-max', label: '通义千问', vendor: 'Alibaba', desc: '证据链推演强，适合中后期归纳型角色。' },
  { id: 'mistral-large-latest', label: 'Mistral Large', vendor: 'Mistral', desc: '节奏推进快，适合压迫式博弈角色。' },
  { id: 'llama-3.1-70b', label: 'Llama 3.1 70B', vendor: 'Meta', desc: '亲和力强，适合团队调解型角色。' },
  { id: 'hunyuan-turbo', label: '腾讯混元', vendor: 'Tencent', desc: '行为分析型，适合秩序裁断角色。' },
  { id: 'glm-4-plus', label: '智谱 GLM', vendor: 'Z.ai', desc: '知识串联强，适合长线证据归纳。' },
  { id: 'abab6.5-chat', label: 'MiniMax', vendor: 'MiniMax', desc: '表达戏剧感强，适合表演型角色。' },
  { id: 'yi-large', label: '零一 Yi', vendor: '01.AI', desc: '决断迅速，适合一击定性型角色。' },
  { id: 'ernie-4.0-turbo-8k', label: '文心一言', vendor: 'Baidu', desc: '稳健中庸，适合调解型角色。' },
  { id: 'grok-2-1212', label: 'Grok 2', vendor: 'xAI', desc: '反常识思维，适合破局型角色。' },
  { id: 'spark-max', label: '讯飞星火', vendor: 'iFlytek', desc: '反应迅捷，适合攻防转换型角色。' },
]

const speechStyles = ['温柔', '活泼', '理性', '简洁', '幽默', '高冷', '阴阳怪气', '谨慎']
const tagPresets = ['逻辑推理', '敏锐观察', '冷静沉着', '策略思维', '团队协作', '语言表达', '善于伪装', '喜欢质疑', '擅长总结', '情绪共鸣']

const character = ref<Character>(createEmptyCharacter())
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const draftPhrase = ref('')
const draftPrinciple = ref('')
const avatarInput = ref<HTMLInputElement | null>(null)
const portraitInput = ref<HTMLInputElement | null>(null)
const showModelPicker = ref(false)
const modelSearch = ref('')
const modelLoading = ref(false)
const modelError = ref('')
const gatewayModels = ref<GatewayModelInfo[]>([])

const isNew = computed(() => route.value.id === 'new')
const currentAvatar = computed(() => characterAvatarByName(character.value.name, 0, character.value.modelId, character.value.avatarUrl))
const currentPortrait = computed(() => characterPortraitByName(character.value.name, 0, character.value.modelId, character.value.portraitUrl))
const currentVisualKey = computed(() => {
  const avatar = character.value.avatarUrl || ''
  const portrait = character.value.portraitUrl || ''
  return visualPresets.find((preset) => avatar.includes(preset.key) || portrait.includes(preset.key))?.key || ''
})
const selectedModelInfo = computed(() => modelInfo(character.value.modelId))

const modelOptions = computed(() => {
  const selected = character.value.modelId
  const common = commonModelSeeds.map((m) => modelInfo(m.id))
  const list = common.filter((m) => m.id !== selected)
  const selectedInfo = modelInfo(selected)
  return [selectedInfo, ...list].filter((item, index, arr) => arr.findIndex((x) => x.id === item.id) === index)
})

const filteredGatewayModels = computed(() => {
  const query = modelSearch.value.trim().toLowerCase()
  const source = gatewayModels.value.length ? gatewayModels.value : commonModelSeeds.map((m) => ({ id: m.id, tags: [m.vendor], endpointTypes: ['chat'] }))
  const rows = source.map((m) => modelInfo(m.id, m))
  if (!query) return rows.slice(0, 80)
  return rows.filter((m) => (m.id + ' ' + m.label + ' ' + m.vendor + ' ' + m.desc).toLowerCase().includes(query)).slice(0, 80)
})

function modelInfo(id: string, raw?: GatewayModelInfo) {
  const common = commonModelSeeds.find((m) => m.id === id)
  return {
    id,
    label: common?.label || id,
    vendor: common?.vendor || raw?.tags?.[0] || 'Gateway',
    desc: common?.desc || [raw?.endpointTypes?.join(' / '), raw?.tags?.join(' · ')].filter(Boolean).join(' · ') || '来自模型库的可用模型。',
  }
}

function modelTitle(model: ReturnType<typeof modelInfo>) {
  return model.label + '\n' + model.id + '\n' + model.vendor + '\n' + model.desc
}

function resetNewCharacter() {
  character.value = createEmptyCharacter({
    name: '新角色',
    subtitle: '写一句能被记住的角色设定',
    ageLabel: '18岁',
    speechStyle: '温柔',
    modelId: 'doubao',
    avatarUrl: 'asset://avatar/doubao',
    portraitUrl: 'asset://portrait/doubao',
    accentColor: '#8b6cff',
  })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    if (isNew.value) resetNewCharacter()
    else if (route.value.id) character.value = await characterService.get(route.value.id)
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    loading.value = false
  }
}

async function saveCharacter() {
  saving.value = true
  error.value = ''
  try {
    const saved = await characterService.save(character.value)
    navigate('/character-detail/' + saved.id)
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    saving.value = false
  }
}

async function removeCharacter() {
  if (isNew.value || !character.value.id) return
  if (!window.confirm('确定删除角色“' + character.value.name + '”吗？此操作不可恢复。')) return
  saving.value = true
  try {
    await characterService.remove(character.value.id)
    navigate('/characters')
  } catch (err) {
    error.value = formatUserMessage(err)
    saving.value = false
  }
}

function applyVisualPreset(key: string, bindModel = false) {
  const preset = visualPresets.find((item) => item.key === key)
  if (!preset) return
  character.value.avatarUrl = 'asset://avatar/' + preset.key
  character.value.portraitUrl = 'asset://portrait/' + preset.key
  character.value.accentColor = preset.accent
  if (bindModel) character.value.modelId = preset.modelId
}

function pickUpload(kind: 'avatar' | 'portrait') {
  if (kind === 'avatar') avatarInput.value?.click()
  else portraitInput.value?.click()
}

function onUpload(event: Event, kind: 'avatar' | 'portrait') {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    error.value = '请选择图片文件。'
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    const url = String(reader.result || '')
    if (!url) return
    if (kind === 'avatar') character.value.avatarUrl = url
    else character.value.portraitUrl = url
  }
  reader.onerror = () => {
    error.value = '读取图片失败，请换一张图片再试。'
  }
  reader.readAsDataURL(file)
}

function bindModel(id: string) {
  character.value.modelId = id
  showModelPicker.value = false
}

async function openModelPicker() {
  showModelPicker.value = true
  modelSearch.value = ''
  if (gatewayModels.value.length || modelLoading.value) return
  modelLoading.value = true
  modelError.value = ''
  try {
    gatewayModels.value = await listGatewayModels()
  } catch (err) {
    modelError.value = err instanceof Error ? err.message : '模型库加载失败，已显示常用模型。'
  } finally {
    modelLoading.value = false
  }
}

function toggleTag(tag: string) {
  const idx = character.value.tags.indexOf(tag)
  if (idx >= 0) character.value.tags.splice(idx, 1)
  else character.value.tags.push(tag)
}

function addPhrase() {
  const value = draftPhrase.value.trim()
  if (!value) return
  character.value.commonPhrases.push(value)
  draftPhrase.value = ''
}

function addPrinciple() {
  const value = draftPrinciple.value.trim()
  if (!value) return
  character.value.behaviorPrinciples.push(value)
  draftPrinciple.value = ''
}

onMounted(() => void load())
</script>

<template>
  <ArenaPageShell class="edit-page">
    <ArenaPageState :loading="loading" skeleton="edit-2col" loading-label="正在打开角色档案..." @retry="load">
      <section class="edit-layout">
      <aside class="visual-panel" :style="{ '--accent': character.accentColor }">
        <div class="portrait-frame">
          <img class="portrait" :src="currentPortrait" :alt="character.name" />
          <div class="portrait-tools">
            <button type="button" @click="pickUpload('portrait')"><Upload :size="15" /> 上传立绘</button>
          </div>
        </div>

        <div class="identity-card">
          <button type="button" class="avatar-button" @click="pickUpload('avatar')">
            <img :src="currentAvatar" alt="" />
            <span><ImagePlus :size="14" /></span>
          </button>
          <div>
            <h2>{{ character.name || '新角色' }}</h2>
            <p>{{ character.subtitle || '写一句能被记住的设定' }}</p>
          </div>
        </div>

        <div class="visual-presets">
          <div class="mini-title">
            <span>视觉素材</span>
            <small>可选预设，也可上传</small>
          </div>
          <div class="preset-grid">
            <button
              v-for="preset in visualPresets"
              :key="preset.key"
              type="button"
              :class="{ active: currentVisualKey === preset.key }"
              @click="applyVisualPreset(preset.key)"
              @dblclick="applyVisualPreset(preset.key, true)"
            >
              <img :src="characterAvatarByName('', 0, '', 'asset://avatar/' + preset.key)" alt="" />
              <span>{{ preset.name }}</span>
            </button>
          </div>
        </div>

        <input ref="avatarInput" class="hidden-file" type="file" accept="image/*" @change="onUpload($event, 'avatar')" />
        <input ref="portraitInput" class="hidden-file" type="file" accept="image/*" @change="onUpload($event, 'portrait')" />
      </aside>

      <main class="edit-panel">
        <div class="editor-command-bar">
          <div>
            <strong>{{ isNew ? '创建角色' : '编辑角色' }}</strong>
            <span>{{ isNew ? '新角色会保存到本地角色库' : '更改会保存到本地角色库' }}</span>
          </div>
          <div class="sticky-actions sticky-actions--top">
            <button type="button" @click="goBack()">取消</button>
            <button class="primary" type="button" :disabled="saving" @click="saveCharacter">{{ saving ? '保存中...' : '保存角色' }}</button>
          </div>
        </div>

        <div v-if="error" class="error-box">{{ error }}</div>

        <section class="composer-card identity-composer">
          <div class="field-line">
            <label><span>角色名</span><input v-model="character.name" class="field name-field" maxlength="20" placeholder="给 TA 一个名字" /></label>
            <label><span>状态</span><select v-model="character.status" class="field compact-field"><option value="enabled">启用</option><option value="disabled">停用</option></select></label>
            <label><span>年龄感</span><input v-model="character.ageLabel" class="field compact-field" maxlength="12" placeholder="少年 / 成熟" /></label>
          </div>
          <label class="wide-line"><span>一句话设定</span><input v-model="character.subtitle" class="field" maxlength="36" placeholder="例如：冷静观察局势的推理伙伴" /></label>
          <label class="wide-line"><span>档案简介</span><textarea v-model="character.bio" class="field" rows="3" placeholder="写下性格、背景、推理习惯，后续模型服务会优先参考这里。"></textarea></label>
        </section>

        <section class="composer-card model-strip">
          <div class="section-title"><span>绑定模型</span><small>常用模型可直接绑定，其他模型从模型库搜索选择</small></div>
          <div class="model-options">
            <button v-for="model in modelOptions" :key="model.id" type="button" :class="{ active: character.modelId === model.id }" :title="modelTitle(model)" @click="bindModel(model.id)">
              <strong>{{ model.label }}</strong><em>{{ model.vendor }}</em>
            </button>
            <button type="button" class="choose-other" @click="openModelPicker"><Search :size="16" /><strong>选择其他</strong><ChevronRight :size="15" /></button>
          </div>
          <div class="selected-model" :title="modelTitle(selectedModelInfo)"><Sparkles :size="16" /> 当前绑定：<strong>{{ selectedModelInfo.label }}</strong><span>{{ selectedModelInfo.id }}</span></div>
        </section>

        <section class="composer-card tag-studio">
          <div class="section-title"><span>人设标签</span><small>用于角色库筛选和未来提示词拼装</small></div>
          <div class="tag-editor">
            <button v-for="tag in tagPresets" :key="tag" type="button" :class="{ active: character.tags.includes(tag) }" @click="toggleTag(tag)"><Check v-if="character.tags.includes(tag)" :size="14" />{{ tag }}</button>
          </div>
        </section>

        <div class="two-col">
          <section class="composer-card voice-studio">
            <div class="section-title"><span>说话方式</span><small>语气会影响对局发言</small></div>
            <div class="segmented"><button v-for="style in speechStyles" :key="style" type="button" :class="{ active: character.speechStyle === style }" @click="character.speechStyle = style">{{ style }}</button></div>
            <div class="list-editor">
              <div class="add-row"><input v-model="draftPhrase" class="field" placeholder="添加一句常用发言" @keyup.enter="addPhrase" /><button type="button" @click="addPhrase"><Plus :size="16" /></button></div>
              <span v-for="(phrase, index) in character.commonPhrases" :key="phrase + '-' + index">{{ phrase }}<button type="button" @click="character.commonPhrases.splice(index, 1)">×</button></span>
            </div>
          </section>

          <section class="composer-card strategy-studio">
            <div class="section-title"><span>推理倾向</span><small>用轻量滑杆表现判断方式</small></div>
            <label class="range-row"><span>共情</span><input v-model.number="character.strategy.empathyVsLogic" type="range" min="0" max="100" /><em>逻辑</em></label>
            <label class="range-row"><span>谨慎</span><input v-model.number="character.strategy.cautiousVsBold" type="range" min="0" max="100" /><em>冒险</em></label>
            <label class="range-row"><span>主导</span><input v-model.number="character.strategy.leadVsFollow" type="range" min="0" max="100" /><em>跟随</em></label>
            <div class="add-row"><input v-model="draftPrinciple" class="field" placeholder="添加行为原则" @keyup.enter="addPrinciple" /><button type="button" @click="addPrinciple"><Plus :size="16" /></button></div>
            <div class="principles"><span v-for="(item, index) in character.behaviorPrinciples" :key="item + '-' + index">{{ item }}<button type="button" @click="character.behaviorPrinciples.splice(index, 1)">×</button></span></div>
          </section>
        </div>

        <footer class="sticky-actions sticky-actions--bottom">
          <button v-if="!isNew" class="danger" type="button" :disabled="saving" @click="removeCharacter"><Trash2 :size="17" /> 删除角色</button>
          <button type="button" @click="goBack()">取消</button>
          <button class="primary" type="button" :disabled="saving" @click="saveCharacter">{{ saving ? '保存中...' : '保存角色' }}</button>
        </footer>
      </main>
    </section>
    </ArenaPageState>

    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showModelPicker" class="model-modal" @click.self="showModelPicker = false">
          <section class="model-dialog">
            <header><div><span>模型库</span><strong>选择绑定模型</strong></div><button type="button" @click="showModelPicker = false"><X :size="18" /></button></header>
            <label class="model-search"><Search :size="17" /><input v-model="modelSearch" placeholder="搜索模型名称、厂商或标签" autofocus /></label>
            <div v-if="modelError" class="model-error">{{ modelError }}</div>
            <div class="model-list">
              <div v-if="modelLoading" class="model-loading"><Loader2 :size="20" class="spin" /> 正在加载模型库...</div>
              <button v-for="model in filteredGatewayModels" v-else :key="model.id" type="button" :class="{ active: character.modelId === model.id }" :title="modelTitle(model)" @click="bindModel(model.id)">
                <span><strong>{{ model.label }}</strong><em>{{ model.id }}</em></span><small>{{ model.vendor }}</small>
              </button>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>
  </ArenaPageShell>
</template>

<style scoped>
.edit-page :deep(.aa-page-inner) { max-width: none; height: 100%; display: grid; grid-template-rows: minmax(0, 1fr); padding: 26px 34px 16px; overflow: hidden; }
.edit-layout { min-height: 0; overflow: hidden; display: grid; grid-template-columns: 354px minmax(0, 1fr); gap: 18px; }
.visual-panel, .edit-panel, .composer-card { border: 1px solid rgba(255,255,255,.74); border-radius: 24px; background: rgba(255,255,255,.66); box-shadow: inset 0 1px 0 rgba(255,255,255,.9), 0 24px 52px rgba(91,101,174,.11); backdrop-filter: blur(22px); }
.visual-panel { --accent: #8b6cff; min-height: 0; overflow: hidden; display: grid; grid-template-rows: minmax(0, 1fr) auto 204px; }
.portrait-frame { position: relative; overflow: hidden; margin: 14px; border-radius: 21px; background: radial-gradient(circle at 50% 8%, color-mix(in srgb, var(--accent) 18%, white), transparent 58%); }
.portrait { width: 100%; height: 100%; object-fit: cover; object-position: center top; transform: scale(1.035); }
.portrait-tools { position: absolute; left: 12px; right: 12px; bottom: 12px; display: flex; justify-content: center; opacity: 0; transform: translateY(8px); transition: .18s ease; }
.portrait-frame:hover .portrait-tools { opacity: 1; transform: translateY(0); }
.portrait-tools button, .visual-presets button, .sticky-actions button, .add-row button { border: 1px solid rgba(130,142,207,.15); background: rgba(255,255,255,.72); color: #26305e; font: inherit; cursor: pointer; transition: transform .18s ease, background .18s ease, box-shadow .18s ease, border-color .18s ease; }
.portrait-tools button { height: 34px; padding: 0 14px; border-radius: 999px; display: inline-flex; align-items: center; gap: 7px; box-shadow: 0 14px 28px rgba(40,34,95,.16); }
.identity-card { display: flex; align-items: center; gap: 12px; margin: 0 14px 10px; padding: 12px; border-radius: 20px; background: linear-gradient(135deg, rgba(255,255,255,.76), color-mix(in srgb, var(--accent) 12%, white)); }
.avatar-button { position: relative; width: 64px; height: 64px; padding: 0; border: 0; border-radius: 21px; background: transparent; cursor: pointer; }
.avatar-button img { width: 64px; height: 64px; border-radius: 21px; object-fit: cover; box-shadow: 0 10px 22px color-mix(in srgb, var(--accent) 22%, transparent); }
.avatar-button span { position: absolute; right: -3px; bottom: -3px; width: 25px; height: 25px; display: grid; place-items: center; border-radius: 50%; color: #fff; background: linear-gradient(135deg, #9b73ff, #645cff); box-shadow: 0 8px 18px rgba(100,92,255,.28); }
.identity-card h2 { margin: 0 0 5px; color: #111a51; font-size: 21px; font-weight: 660; }
.identity-card p { margin: 0; color: #66709d; font-size: 13px; line-height: 1.45; }
.visual-presets { padding: 12px 14px 14px; border-top: 1px solid rgba(130,142,207,.12); }
.mini-title, .section-title { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.mini-title span, .section-title span { color: #17205a; font-weight: 680; }
.mini-title small, .section-title small { color: #7a85b0; font-size: 12px; }
.preset-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px; }
.preset-grid button { min-width: 0; height: 58px; padding: 7px; border-radius: 16px; display: flex; align-items: center; gap: 7px; }
.preset-grid button:hover, .sticky-actions button:hover, .add-row button:hover { transform: translateY(-2px); background: rgba(255,255,255,.9); box-shadow: 0 14px 24px rgba(91,101,174,.11); }
.preset-grid button.active { border-color: rgba(108,99,255,.34); background: rgba(112,105,255,.12); }
.preset-grid img { width: 34px; height: 34px; border-radius: 12px; object-fit: cover; }
.preset-grid span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: #4e5789; }
.hidden-file { display: none; }
.edit-panel { min-height: 0; overflow: auto; padding: 16px 18px 0; scrollbar-width: none; }
.edit-panel::-webkit-scrollbar { display: none; }
.editor-command-bar { position: sticky; top: 0; z-index: 3; display: flex; justify-content: space-between; align-items: center; gap: 14px; margin: -16px -18px 14px; padding: 14px 18px 12px; border-bottom: 1px solid rgba(130,142,207,.1); background: linear-gradient(180deg, rgba(250,251,255,.94), rgba(250,251,255,.78)); backdrop-filter: blur(16px); }
.editor-command-bar strong { display: block; color: #17205a; font-size: 18px; }
.editor-command-bar span { color: #66709d; font-size: 13px; }
.sticky-actions { display: flex; gap: 8px; }
.sticky-actions button, .add-row button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 36px; padding: 0 14px; border-radius: 999px; font-size: 13px; }
.sticky-actions .primary { color: #fff; border-color: transparent; background: linear-gradient(180deg, #8f6fff, #655cff); }
.sticky-actions .danger { margin-right: auto; color: #dc2626; }
.composer-card { margin-bottom: 12px; padding: 16px 18px; }
.section-title { margin-bottom: 14px; }
.section-title span { font-size: 17px; }
.field-line { display: grid; grid-template-columns: minmax(180px, 1.1fr) 120px 140px; gap: 12px; }
.field-line label, .wide-line { display: flex; flex-direction: column; gap: 7px; color: #66709d; font-size: 12px; }
.wide-line { margin-top: 12px; }
.field { min-width: 0; width: 100%; border: 1px solid rgba(130,142,207,.16); border-radius: 16px; background: rgba(255,255,255,.7); color: #17205a; outline: 0; font: inherit; transition: border-color .18s ease, background .18s ease, box-shadow .18s ease; }
.field:focus { border-color: rgba(108,99,255,.42); background: rgba(255,255,255,.92); box-shadow: 0 0 0 4px rgba(108,99,255,.08); }
input.field, select.field { height: 40px; padding: 0 13px; }
.name-field { font-size: 17px; font-weight: 650; }
textarea.field { resize: none; padding: 11px 13px; line-height: 1.65; }
.model-options, .tag-editor, .segmented, .principles, .list-editor { display: flex; flex-wrap: wrap; gap: 8px; }
.model-options button, .tag-editor button, .segmented button { min-width: 0; height: 40px; padding: 0 13px; border: 1px solid rgba(130,142,207,.15); border-radius: 999px; background: rgba(255,255,255,.55); color: #5f6a9e; cursor: pointer; font: inherit; font-size: 13px; transition: transform .18s ease, background .18s ease, color .18s ease, border-color .18s ease; }
.model-options button { max-width: 168px; display: inline-grid; grid-template-columns: minmax(0,1fr); align-content: center; text-align: left; }
.model-options button strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: inherit; font-size: 13px; }
.model-options button em { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #8b94bc; font-size: 11px; font-style: normal; }
.model-options button:hover, .tag-editor button:hover, .segmented button:hover { transform: translateY(-2px); background: rgba(255,255,255,.82); }
.model-options button.active, .tag-editor button.active, .segmented button.active { border-color: rgba(108,99,255,.25); background: rgba(112,105,255,.12); color: #5b57f3; }
.model-options .choose-other { grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 7px; color: #6b54f4; }
.selected-model { margin-top: 12px; min-width: 0; display: flex; align-items: center; gap: 7px; color: #66709d; font-size: 12px; }
.selected-model strong, .selected-model span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.selected-model strong { max-width: 220px; color: #17205a; }
.selected-model span { max-width: 360px; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.range-row { display: grid; grid-template-columns: 36px minmax(0,1fr) 36px; gap: 10px; align-items: center; margin: 13px 0; color: #66709d; font-size: 13px; }
.range-row em { font-style: normal; text-align: right; }
.range-row input { accent-color: #7b61ff; }
.add-row { display: grid; grid-template-columns: minmax(0,1fr) 38px; gap: 8px; width: 100%; margin-top: 14px; }
.add-row button { padding: 0; border-radius: 15px; }
.principles, .list-editor { margin-top: 10px; }
.principles span, .list-editor span { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; background: rgba(112,105,255,.08); color: #625cf0; font-size: 12px; }
.principles button, .list-editor button { border: 0; background: transparent; color: #7a6ff4; cursor: pointer; }
.sticky-actions--bottom { position: sticky; bottom: 0; justify-content: flex-end; padding: 16px 0 18px; background: linear-gradient(180deg, rgba(255,255,255,0), rgba(244,246,255,.9) 42%); backdrop-filter: blur(12px); }
.error-box { margin-bottom: 12px; padding: 10px 12px; border-radius: 15px; background: rgba(239,68,68,.08); color: #dc2626; }
.edit-state { display: flex; align-items: center; gap: 10px; color: #65709f; }
.model-modal { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; background: rgba(23,18,74,.38); backdrop-filter: blur(12px); }
.model-dialog { width: 620px; max-height: 720px; padding: 18px; border-radius: 28px; background: linear-gradient(145deg, rgba(255,255,255,.96), rgba(246,242,255,.92)); border: 1px solid rgba(255,255,255,.76); box-shadow: 0 30px 90px rgba(42,35,116,.28); display: flex; flex-direction: column; }
.model-dialog header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.model-dialog header span { color: #7b61ff; font-size: 12px; font-weight: 800; }
.model-dialog header strong { display: block; margin-top: 3px; color: #171145; font-size: 22px; }
.model-dialog header button { width: 36px; height: 36px; border: 0; border-radius: 50%; background: rgba(255,255,255,.78); cursor: pointer; color: #4c4776; }
.model-search { height: 44px; padding: 0 13px; border-radius: 16px; background: rgba(255,255,255,.76); border: 1px solid rgba(130,142,207,.16); display: flex; align-items: center; gap: 9px; color: #756b9a; }
.model-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: #17205a; font: inherit; }
.model-error { margin-top: 10px; padding: 9px 11px; border-radius: 14px; color: #a85522; background: rgba(251,146,60,.1); font-size: 12px; }
.model-list { min-height: 220px; overflow: auto; margin-top: 14px; display: grid; gap: 8px; scrollbar-width: none; }
.model-list::-webkit-scrollbar { display: none; }
.model-loading { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 180px; color: #756b9a; }
.model-list button { min-width: 0; min-height: 58px; padding: 10px 12px; border: 1px solid rgba(130,142,207,.14); border-radius: 17px; display: flex; align-items: center; justify-content: space-between; gap: 12px; background: rgba(255,255,255,.64); cursor: pointer; color: #17205a; text-align: left; transition: .18s ease; }
.model-list button:hover { transform: translateY(-2px); background: rgba(255,255,255,.92); border-color: rgba(108,99,255,.24); }
.model-list button.active { background: rgba(112,105,255,.12); border-color: rgba(108,99,255,.32); }
.model-list button span { min-width: 0; display: grid; gap: 4px; }
.model-list button strong, .model-list button em { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.model-list button strong { font-size: 14px; }
.model-list button em { color: #7b84ad; font-size: 12px; font-style: normal; }
.model-list button small { flex: 0 0 auto; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #7b61ff; }
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity .18s ease; }
.modal-fade-enter-active .model-dialog, .modal-fade-leave-active .model-dialog { transition: transform .2s ease, opacity .18s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-from .model-dialog, .modal-fade-leave-to .model-dialog { transform: translateY(10px) scale(.97); opacity: 0; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 1280px) { .edit-layout { grid-template-columns: 320px minmax(0,1fr); } .two-col { grid-template-columns: 1fr; } }
</style>
