<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Check, Loader2, RefreshCw, Search, Sparkles } from 'lucide-vue-next'
import { entryFromGateway, modelPickerTitle, resolveModelInfo, type ModelCatalogEntry } from '@renderer/data/model-catalog'
import { getFallbackModelId } from '@renderer/services/arena'
import { listChatGatewayModels } from '@renderer/services/gateway-api'

const modelId = defineModel<string>({ required: true })

const props = withDefaults(
  defineProps<{
    label?: string
    hint?: string
    compact?: boolean
    disabled?: boolean
  }>(),
  {
    label: '绑定模型',
    compact: false,
  }
)

const search = ref('')
const loading = ref(true)
const loadError = ref('')
const gatewayEntries = ref<ModelCatalogEntry[]>([])

const selected = computed(() => {
  return gatewayEntries.value.find((item) => item.id === modelId.value) || resolveModelInfo(modelId.value)
})

const filteredModels = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return gatewayEntries.value
  return gatewayEntries.value.filter((item) =>
    (item.id + ' ' + item.label + ' ' + item.vendor + ' ' + item.desc).toLowerCase().includes(query)
  )
})

async function loadGatewayModels(force = false) {
  loading.value = true
  loadError.value = ''
  try {
    const rows = await listChatGatewayModels(force)
    gatewayEntries.value = rows.map(entryFromGateway)
    if (!modelId.value) {
      modelId.value = getFallbackModelId()
    } else if (!gatewayEntries.value.some((item) => item.id === modelId.value)) {
      gatewayEntries.value = [resolveModelInfo(modelId.value), ...gatewayEntries.value]
    }
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : '网关模型列表加载失败'
    if (modelId.value) {
      gatewayEntries.value = [resolveModelInfo(modelId.value)]
    }
  } finally {
    loading.value = false
  }
}

function selectModel(id: string) {
  if (props.disabled) return
  modelId.value = id
}

onMounted(() => void loadGatewayModels())
</script>

<template>
  <div class="model-picker" :class="{ compact, disabled }">
    <header v-if="label || hint" class="model-picker__head">
      <div>
        <span v-if="label">{{ label }}</span>
        <p v-if="hint">{{ hint }}</p>
      </div>
      <button type="button" class="model-picker__refresh" :disabled="loading || disabled" title="刷新网关模型" @click="loadGatewayModels(true)">
        <RefreshCw :size="14" :class="{ spin: loading }" />
      </button>
    </header>

    <article class="model-picker__current" :title="modelPickerTitle(selected)">
      <div class="model-picker__current-icon"><Sparkles :size="16" /></div>
      <div class="model-picker__current-copy">
        <strong>{{ selected.label }}</strong>
        <em>{{ selected.id }}</em>
        <small>{{ selected.vendor }} · {{ selected.desc }}</small>
      </div>
      <span class="model-picker__current-badge">当前</span>
    </article>

    <label class="model-picker__search">
      <Search :size="16" />
      <input v-model="search" type="search" placeholder="搜索网关模型名称、厂商或标签" :disabled="disabled || loading" />
    </label>

    <p v-if="loadError" class="model-picker__error">{{ loadError }}</p>
    <div v-if="loading" class="model-picker__loading"><Loader2 :size="18" class="spin" /> 正在加载网关模型列表…</div>

    <template v-else>
      <section class="model-picker__section">
        <div class="model-picker__section-title">
          网关模型库
          <span>{{ filteredModels.length }} 个</span>
        </div>
        <div v-if="!filteredModels.length" class="model-picker__empty">没有匹配的模型。</div>
        <div v-else class="model-picker__grid model-picker__grid--library">
          <button
            v-for="model in filteredModels"
            :key="model.id"
            type="button"
            class="model-card"
            :class="{ active: modelId === model.id }"
            :title="modelPickerTitle(model)"
            :disabled="disabled"
            @click="selectModel(model.id)"
          >
            <div class="model-card__top">
              <strong>{{ model.label }}</strong>
              <Check v-if="modelId === model.id" :size="15" class="model-card__check" />
            </div>
            <em>{{ model.id }}</em>
            <p>{{ model.vendor }}</p>
            <span v-if="model.endpointTypes?.length" class="model-card__tags">{{ model.endpointTypes.join(' · ') }}</span>
          </button>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.model-picker { display: grid; gap: 12px; }
.model-picker.compact { gap: 10px; }
.model-picker.disabled { opacity: 0.72; pointer-events: none; }
.model-picker__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.model-picker__head span { display: block; color: #17205a; font-size: 13px; font-weight: 650; }
.model-picker__head p { margin: 4px 0 0; color: #7a85b0; font-size: 12px; line-height: 1.5; }
.model-picker__refresh { width: 32px; height: 32px; border: 1px solid rgba(130,142,207,.16); border-radius: 10px; background: rgba(255,255,255,.72); color: #5b57f3; cursor: pointer; display: grid; place-items: center; flex-shrink: 0; }
.model-picker__current { position: relative; display: grid; grid-template-columns: auto minmax(0,1fr); gap: 10px; padding: 12px; border-radius: 16px; border: 1px solid rgba(108,99,255,.22); background: linear-gradient(135deg, rgba(112,105,255,.1), rgba(255,255,255,.72)); }
.model-picker__current-icon { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 12px; color: #5b57f3; background: rgba(112,105,255,.14); }
.model-picker__current-copy { min-width: 0; }
.model-picker__current-copy strong { display: block; color: #17205a; font-size: 15px; }
.model-picker__current-copy em { display: block; margin-top: 2px; color: #7b84ad; font-size: 11px; font-style: normal; word-break: break-all; }
.model-picker__current-copy small { display: block; margin-top: 6px; color: #66709d; font-size: 12px; line-height: 1.45; }
.model-picker__current-badge { position: absolute; top: 10px; right: 10px; padding: 3px 8px; border-radius: 999px; background: rgba(112,105,255,.14); color: #5b57f3; font-size: 10px; font-weight: 700; }
.model-picker__search { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px; border: 1px solid rgba(130,142,207,.18); border-radius: 14px; background: rgba(255,255,255,.82); color: #7a85b0; }
.model-picker__search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: #17205a; font: inherit; font-size: 13px; }
.model-picker__error { margin: 0; padding: 8px 10px; border-radius: 12px; background: rgba(251,146,60,.1); color: #a85522; font-size: 12px; }
.model-picker__loading { display: flex; align-items: center; gap: 8px; padding: 16px 4px; color: #66709d; font-size: 13px; }
.model-picker__section-title { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: #66709d; font-size: 12px; font-weight: 650; }
.model-picker__section-title span { color: #9aa3c7; font-weight: 500; }
.model-picker__grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; }
.compact .model-picker__grid { grid-template-columns: 1fr; }
.model-picker__grid--library { max-height: 320px; overflow: auto; padding-right: 2px; }
.model-card { min-width: 0; padding: 10px 11px; border: 1px solid rgba(130,142,207,.14); border-radius: 14px; background: rgba(255,255,255,.72); color: #17205a; text-align: left; cursor: pointer; transition: transform .16s ease, border-color .16s ease, background .16s ease, box-shadow .16s ease; }
.model-card:hover { transform: translateY(-1px); border-color: rgba(108,99,255,.24); background: rgba(255,255,255,.94); box-shadow: 0 10px 24px rgba(91,101,174,.1); }
.model-card.active { border-color: rgba(108,99,255,.34); background: rgba(112,105,255,.1); box-shadow: inset 0 0 0 1px rgba(108,99,255,.08); }
.model-card__top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.model-card strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.model-card__check { flex-shrink: 0; color: #5b57f3; }
.model-card em { display: block; margin-top: 3px; color: #7b84ad; font-size: 11px; font-style: normal; word-break: break-all; }
.model-card p { margin: 6px 0 0; color: #66709d; font-size: 11px; line-height: 1.45; }
.model-card__tags { display: inline-flex; margin-top: 6px; padding: 2px 7px; border-radius: 999px; background: rgba(130,142,207,.1); color: #66709d; font-size: 10px; }
.model-picker__empty { padding: 10px 4px; color: #7a85b0; font-size: 12px; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 520px) { .model-picker__grid { grid-template-columns: 1fr; } }
</style>
