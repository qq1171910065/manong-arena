<script setup lang="ts">

import { computed, ref, watch } from 'vue'

import { Loader2, Sparkles, Volume2 } from 'lucide-vue-next'

import DetailEditDialog from '@renderer/components/arena/DetailEditDialog.vue'

import {

  characterService,

  formatUserMessage,

  ttsProfileService,

  ttsService,

  unlockArenaAudio,

} from '@renderer/services/arena'

import { cloneJson } from '@shared/clone-json'

import {

  getCharacterTtsSummary,

  listZhVoicesForGender,

  resolveCharacterTtsParams,

  resolveTtsStyleInstruction,

  voiceMatchesCharacterGender,

} from '@shared/arena/voice-presets'

import type { Character } from '@shared/arena/types'



const show = defineModel<boolean>({ default: false })



const props = defineProps<{

  character: Character

}>()



const emit = defineEmits<{

  saved: [character: Character]

}>()



const draft = ref<Character>(props.character)

const saving = ref(false)

const previewing = ref(false)

const analyzing = ref(false)

const error = ref('')

const previewHint = ref('')

const analyzeHint = ref('')



const genderLabel = computed(() =>

  draft.value.gender === 'male' ? '男' : draft.value.gender === 'female' ? '女' : '其他'

)



const zhVoices = computed(() => listZhVoicesForGender(draft.value.gender))



const summary = computed(() => getCharacterTtsSummary(draft.value))



const resolvedParams = computed(() => resolveCharacterTtsParams(draft.value))



const effectiveStyle = computed(() => resolveTtsStyleInstruction(draft.value))



const voiceMismatch = computed(() => {

  const voiceId = draft.value.ttsVoiceId

  if (!voiceId) return false

  return !voiceMatchesCharacterGender(voiceId, draft.value.gender)

})



function loadDraft() {

  draft.value = cloneJson(props.character)

  previewHint.value = ''

  analyzeHint.value = draft.value.ttsAnalyzedSummary || ''

  error.value = ''

}



async function analyzeTtsProfile() {

  if (analyzing.value) return

  analyzing.value = true

  error.value = ''

  analyzeHint.value = '正在根据角色档案分析播报方式…'

  try {

    const profile = await ttsProfileService.analyze(draft.value)

    draft.value = ttsProfileService.apply(draft.value, profile)

    analyzeHint.value = profile.summary

  } catch (err) {

    const profile = ttsProfileService.inferLocal(draft.value)

    draft.value = ttsProfileService.apply(draft.value, profile)

    analyzeHint.value = `${profile.summary}（已使用本地规则兜底）`

    error.value = formatUserMessage(err) || '模型分析失败，已按性别与说话方式本地匹配'

  } finally {

    analyzing.value = false

  }

}



async function previewTts() {

  if (previewing.value) return

  previewing.value = true

  error.value = ''

  previewHint.value = '正在合成语音…'

  unlockArenaAudio()

  try {

    const sample =

      draft.value.commonPhrases[0] ||

      `你好，我是${draft.value.name || '角色'}，请听我的播报音色。`

    await ttsService.previewCharacter(draft.value, sample)

    previewHint.value = '播放完成'

  } catch (err) {

    previewHint.value = ''

    error.value = formatUserMessage(err) || '试听失败，请确认网关已配置 mimo-v2.5-tts'

  } finally {

    previewing.value = false

  }

}



async function save() {

  saving.value = true

  error.value = ''

  try {

    draft.value.ttsAutoStyleTags = true

    draft.value.ttsAutoStyleInstruction = !draft.value.ttsStyleInstruction?.trim()

    if (draft.value.ttsVoiceId && !voiceMatchesCharacterGender(draft.value.ttsVoiceId, draft.value.gender)) {

      draft.value.ttsVoiceId = resolvedParams.value.voiceId

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



watch(show, (open) => {

  if (open) loadDraft()

}, { immediate: true })

</script>



<template>

  <DetailEditDialog

    v-model="show"

    title="播报音色"

    subtitle="根据角色档案智能分析 · 可微调 · 综合用于试听与对局播报"

    save-label="保存"

    :saving="saving"

    @save="save"

  >

    <div class="tts-simple">

      <p v-if="error" class="edit-error">{{ error }}</p>



      <section class="tts-block analyze-block">

        <header>

          <strong>智能分析</strong>

          <span>读取性别（{{ genderLabel }}）、人设、说话方式「{{ draft.speechStyle }}」等，自动匹配音色与播报指令</span>

        </header>

        <div class="analyze-row">

          <button type="button" class="analyze-btn" :disabled="analyzing" @click="analyzeTtsProfile">

            <Loader2 v-if="analyzing" :size="15" class="spin" />

            <Sparkles v-else :size="15" />

            {{ analyzing ? '分析中…' : '根据角色自动分析' }}

          </button>

          <span v-if="analyzeHint" class="analyze-hint">{{ analyzeHint }}</span>

        </div>

      </section>



      <section class="tts-block">

        <header>

          <strong>音色</strong>

          <span>当前：{{ summary }}。仅展示与角色性别匹配的音色。</span>

        </header>

        <p v-if="voiceMismatch" class="voice-warn">当前音色与角色性别不一致，保存时将自动修正。</p>

        <div class="voice-row">

          <button

            v-for="voice in zhVoices"

            :key="voice.id"

            type="button"

            class="voice-chip"

            :class="{ active: draft.ttsVoiceId === voice.id }"

            @click="draft.ttsVoiceId = voice.id"

          >

            {{ voice.label }}

            <span class="voice-gender">{{ voice.gender === 'female' ? '女' : voice.gender === 'male' ? '男' : '默' }}</span>

          </button>

        </div>

      </section>



      <section class="tts-block">

        <header>

          <strong>播报指令（分析结果）</strong>

          <span>描述怎么说；自动分析后会填入，也可手动修改</span>

        </header>

        <textarea

          v-model="draft.ttsStyleInstruction"

          class="field"

          rows="4"

          maxlength="400"

          placeholder="例如：用冷静理性的青年男声，语速平稳，条理清晰，略带疏离感。"

        />

      </section>



      <section class="tts-block">

        <header>

          <strong>微调说明（可选）</strong>

          <span>补充你的要求，会与上方指令合并后用于试听与对局播报</span>

        </header>

        <textarea

          v-model="draft.ttsAdjustNotes"

          class="field"

          rows="3"

          maxlength="200"

          placeholder="例如：再慢一点，尾音稍微拖长；或：更像新闻播报，不要太戏剧化。"

        />

        <p v-if="effectiveStyle" class="style-preview">

          综合指令：{{ effectiveStyle }}

        </p>

        <p v-if="resolvedParams.openingStyleTags.length" class="style-preview tags-preview">

          风格标签：({{ resolvedParams.openingStyleTags.join(' ') }})

        </p>

      </section>



      <div class="preview-row">

        <button type="button" class="preview-btn" :disabled="previewing" @click="previewTts">

          <Loader2 v-if="previewing" :size="15" class="spin" />

          <Volume2 v-else :size="15" />

          {{ previewing ? '合成中…' : '试听' }}

        </button>

        <span v-if="previewHint" class="preview-hint">{{ previewHint }}</span>

      </div>

    </div>

  </DetailEditDialog>

</template>



<style scoped>

.tts-simple { display: grid; gap: 16px; }

.edit-error { margin: 0; padding: 10px 12px; border-radius: 12px; background: rgba(239,68,68,.08); color: #dc2626; font-size: 13px; }

.tts-block { display: grid; gap: 10px; }

.tts-block header { display: grid; gap: 4px; }

.tts-block header strong { color: #26305e; font-size: 14px; }

.tts-block header span { color: #8b93b8; font-size: 12px; line-height: 1.5; }

.analyze-block { padding: 12px; border-radius: 14px; background: rgba(112,105,255,.05); border: 1px solid rgba(108,99,255,.12); }

.analyze-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

.analyze-btn {

  display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 16px;

  border: 1px solid rgba(108,99,255,.25); border-radius: 999px; background: rgba(255,255,255,.85);

  color: #5b57f3; font: inherit; font-size: 13px; font-weight: 650; cursor: pointer;

}

.analyze-btn:disabled { opacity: .65; cursor: wait; }

.analyze-hint { color: #5f6a9e; font-size: 12px; line-height: 1.5; }

.voice-warn { margin: 0; color: #d97706; font-size: 12px; }

.voice-row { display: flex; flex-wrap: wrap; gap: 8px; }

.voice-chip {

  display: inline-flex; align-items: center; gap: 6px;

  height: 36px; padding: 0 14px; border: 1px solid rgba(130,142,207,.18); border-radius: 999px;

  background: rgba(255,255,255,.7); color: #4e5789; font: inherit; font-size: 13px; cursor: pointer;

}

.voice-gender {

  font-size: 11px; color: #8b93b8; padding: 1px 6px; border-radius: 999px; background: rgba(130,142,207,.08);

}

.voice-chip.active { border-color: rgba(108,99,255,.35); background: rgba(112,105,255,.12); color: #5b57f3; font-weight: 650; }

.field {

  width: 100%; padding: 10px 12px; border: 1px solid rgba(130,142,207,.2); border-radius: 12px;

  background: rgba(255,255,255,.85); color: #243066; font: inherit; font-size: 14px; line-height: 1.65;

  box-sizing: border-box; resize: vertical;

}

.style-preview {

  margin: 0; padding: 10px 12px; border-radius: 12px; background: rgba(112,105,255,.06);

  color: #5f6a9e; font-size: 12px; line-height: 1.6;

}

.tags-preview { background: rgba(16,185,129,.06); color: #047857; }

.preview-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

.preview-btn {

  display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 18px;

  border: 0; border-radius: 999px; background: linear-gradient(135deg, #8d6bff, #5c5cff);

  color: #fff; font: inherit; font-size: 13px; font-weight: 650; cursor: pointer;

  box-shadow: 0 10px 24px rgba(99,88,255,.22);

}

.preview-btn:disabled { opacity: .65; cursor: wait; }

.preview-hint { color: #8b93b8; font-size: 12px; }

.spin { animation: spin 1s linear infinite; }

@keyframes spin { to { transform: rotate(360deg); } }

</style>

