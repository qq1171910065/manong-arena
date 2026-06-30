<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Lightbulb, Loader2, MoonStar, Send, ShieldCheck, Sparkles, Vote, FlaskConical } from 'lucide-vue-next'
import { formatUserMessage, matchEngine } from '@renderer/services/arena'
import {
  buildMentionToken,
  buildQuickPhrases,
  buildHumanVoteTargets,
  canHumanVoteAbstain,
  formatHumanIdentity,
  mentionCandidates,
  polishHumanDraft,
  suggestHumanSpeechHints,
} from '@renderer/services/arena/human-player-assist'
import { humanPlayerService, wolfTeamMessagesForMatch } from '@renderer/services/arena/human-player-service'
import { listGuardProtectCandidates, listSeerCheckCandidates } from '@renderer/services/arena/phase-engine'
import type { Character, HumanInputKind, Match, MatchParticipant, SpeechTermHighlight } from '@shared/arena/types'

const props = defineProps<{
  match: Match
  profileCharacterId: string | null
  viewMode: 'god' | 'player'
  inputKind: HumanInputKind
  humanParticipant: MatchParticipant | null
  character: Character | null
  speechTerms?: SpeechTermHighlight[]
  roleSkillText?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  updated: [match: Match]
  error: [message: string]
  submitted: []
}>()

const draft = ref('')
const selectedTargetId = ref<string | null>(null)
const busy = ref(false)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const mentionOpen = ref(false)
const mentionQuery = ref('')
const hints = ref<string[]>([])
const hintsLoading = ref(false)
const polishStep = ref<'edit' | 'preview'>('edit')
const polishPreview = ref('')
const polishOriginal = ref('')

const humanId = computed(
  () => props.match.runtime.humanControlledId ?? props.humanParticipant?.characterId ?? props.profileCharacterId
)
const isTextInput = computed(() => props.inputKind === 'speech' || props.inputKind === 'wolf_chat')
const isWitchAntidote = computed(() => props.inputKind === 'witch_antidote')
const isWitchPoison = computed(() => props.inputKind === 'witch_poison')
const isGuardProtect = computed(() => props.inputKind === 'guard_protect')
const isSeerCheck = computed(() => props.inputKind === 'seer_check')
const knifeTarget = computed(() => {
  const id = props.match.runtime.werewolfState?.pendingKnifeTargetId
  if (!id) return null
  return props.match.participants.find((p) => p.characterId === id) || null
})
const poisonTargets = computed(() => {
  const selfId = humanId.value
  return props.match.participants
    .filter((p) => p.alive === 'alive' && p.characterId !== selfId)
    .sort((a, b) => a.seatOrder - b.seatOrder)
})
const antidoteAvailable = computed(() => !props.match.runtime.werewolfState?.antidoteUsed)
const poisonAvailable = computed(
  () =>
    !props.match.runtime.werewolfState?.poisonUsed && props.match.runtime.currentRound >= 2
)
const identity = computed(() => (props.humanParticipant ? formatHumanIdentity(props.humanParticipant) : null))
const quickPhrases = computed(() => buildQuickPhrases(props.character, props.speechTerms ?? []))
const filteredMentions = computed(() => mentionCandidates(props.match, humanId.value, mentionQuery.value))

const pendingMessage = computed(() => {
  const id = props.match.runtime.humanInputMessageId
  if (!id) return null
  return props.match.messages.find((m) => m.id === id) || null
})

const wolfMessages = computed(() =>
  wolfTeamMessagesForMatch(props.match, props.profileCharacterId, props.viewMode)
)

const voteTargets = computed(() => buildHumanVoteTargets(props.match, humanId.value))
const allowVoteAbstain = computed(() => canHumanVoteAbstain(props.match, voteTargets.value))

const killTargets = computed(() =>
  props.match.participants.filter((p) => p.alive === 'alive' && p.roleCamp !== 'wolf')
)

const guardTargets = computed(() => {
  const id = humanId.value
  if (!id) return []
  return listGuardProtectCandidates(props.match, id)
})

const seerTargets = computed(() => {
  const id = humanId.value
  if (!id) return []
  return listSeerCheckCandidates(props.match, id)
})

const lastGuarded = computed(() => {
  const id = props.match.runtime.werewolfState?.guardedLastNightId
  if (!id) return null
  return props.match.participants.find((p) => p.characterId === id) || null
})

const title = computed(() => {
  switch (props.inputKind) {
    case 'speech':
      return '你的公开发言'
    case 'vote':
      return props.match.runtime.currentPhaseId === 'sheriff-vote' ? '警长投票（仅竞选者）' : '你的投票'
    case 'wolf_chat':
      return '狼队私密沟通'
    case 'wolf_kill':
      return '狼队刀口投票'
    case 'witch_antidote':
      return '女巫 · 解药'
    case 'witch_poison':
      return '女巫 · 毒药'
    case 'guard_protect':
      return '守卫 · 守护'
    case 'seer_check':
      return '预言家 · 查验'
    default:
      return '真人操作'
  }
})

watch(
  () => props.inputKind,
  () => {
    resetPolish()
    draft.value = pendingMessage.value?.content || ''
    selectedTargetId.value = null
    hints.value = []
    mentionOpen.value = false
  },
  { immediate: true }
)

watch(
  [() => props.inputKind, voteTargets],
  () => {
    if (props.inputKind !== 'vote') return
    if (voteTargets.value.length === 1) {
      selectedTargetId.value = voteTargets.value[0]?.characterId ?? null
    }
  },
  { immediate: true }
)

watch(
  () => pendingMessage.value?.content,
  (value) => {
    if (props.inputKind === 'speech' && value !== undefined && polishStep.value === 'edit') draft.value = value
  }
)

function resetPolish() {
  polishStep.value = 'edit'
  polishPreview.value = ''
  polishOriginal.value = ''
}

function insertAtCursor(text: string) {
  const el = textareaRef.value
  if (!el) {
    draft.value += text
    return
  }
  const start = el.selectionStart ?? draft.value.length
  const end = el.selectionEnd ?? start
  draft.value = draft.value.slice(0, start) + text + draft.value.slice(end)
  nextTick(() => {
    el.focus()
    const pos = start + text.length
    el.setSelectionRange(pos, pos)
    syncMentionState()
    void onDraftInput()
  })
}

function insertPhrase(phrase: string) {
  const token = phrase.endsWith('。') || phrase.endsWith('，') ? phrase : phrase + '，'
  insertAtCursor(token)
}

function applyHint(hint: string) {
  insertAtCursor(hint + ' ')
}

function syncMentionState() {
  const el = textareaRef.value
  if (!el) {
    mentionOpen.value = false
    return
  }
  const pos = el.selectionStart ?? draft.value.length
  const before = draft.value.slice(0, pos)
  const atMatch = before.match(/@([^@\s]*)$/)
  if (atMatch) {
    mentionQuery.value = atMatch[1] || ''
    mentionOpen.value = true
  } else {
    mentionOpen.value = false
    mentionQuery.value = ''
  }
}

function onTextInput() {
  syncMentionState()
  void onDraftInput()
}

function onTextKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && mentionOpen.value) {
    mentionOpen.value = false
    event.preventDefault()
  }
}

function pickMention(participant: MatchParticipant) {
  const el = textareaRef.value
  const token = buildMentionToken(participant) + ' '
  if (!el) {
    draft.value += token
    mentionOpen.value = false
    return
  }
  const pos = el.selectionStart ?? draft.value.length
  const before = draft.value.slice(0, pos)
  const after = draft.value.slice(pos)
  const atStart = before.lastIndexOf('@')
  if (atStart >= 0) {
    draft.value = before.slice(0, atStart) + token + after
  } else {
    draft.value = before + token + after
  }
  mentionOpen.value = false
  nextTick(() => {
    el.focus()
    const cursor = (atStart >= 0 ? atStart : pos) + token.length
    el.setSelectionRange(cursor, cursor)
    void onDraftInput()
  })
}

async function syncDraftToMatch(): Promise<void> {
  if (props.inputKind !== 'speech' || !draft.value.trim()) return
  const next = await humanPlayerService.updateDraft(props.match.id, draft.value)
  emit('updated', next)
}

async function onDraftInput() {
  if (props.inputKind !== 'speech' || busy.value) return
  try {
    await syncDraftToMatch()
  } catch (e) {
    emit('error', formatUserMessage(e))
  }
}

async function loadHints() {
  if (!props.humanParticipant || hintsLoading.value || busy.value) return
  hintsLoading.value = true
  try {
    const result = await suggestHumanSpeechHints(props.match, props.humanParticipant, props.character)
    hints.value = result.hints
  } catch (e) {
    emit('error', formatUserMessage(e))
  } finally {
    hintsLoading.value = false
  }
}

async function submitAntidote(useAntidote: boolean) {
  if (busy.value || props.disabled) return
  busy.value = true
  try {
    const next = await matchEngine.submitHumanWitchAntidote(props.match.id, useAntidote)
    resetPolish()
    hints.value = []
    emit('updated', next)
    emit('submitted')
  } catch (e) {
    emit('error', formatUserMessage(e))
  } finally {
    busy.value = false
  }
}

async function submitGuardProtect(targetId: string | null) {
  if (busy.value || props.disabled) return
  busy.value = true
  try {
    const next = await matchEngine.submitHumanGuardProtect(props.match.id, targetId)
    selectedTargetId.value = null
    emit('updated', next)
    emit('submitted')
  } catch (e) {
    emit('error', formatUserMessage(e))
  } finally {
    busy.value = false
  }
}

async function submitSeerCheck() {
  if (busy.value || props.disabled || !selectedTargetId.value) return
  busy.value = true
  try {
    const next = await matchEngine.submitHumanSeerCheck(props.match.id, selectedTargetId.value)
    selectedTargetId.value = null
    emit('updated', next)
    emit('submitted')
  } catch (e) {
    emit('error', formatUserMessage(e))
  } finally {
    busy.value = false
  }
}

async function submitDirect(text?: string) {
  const content = (text ?? draft.value).trim()
  if (isTextInput.value && !content) return
  if (props.inputKind === 'vote' && !allowVoteAbstain.value && !selectedTargetId.value) return
  busy.value = true
  try {
    if (props.inputKind === 'speech' && polishStep.value === 'edit') {
      await syncDraftToMatch()
    }
    let next: Match
    if (props.inputKind === 'speech') {
      next = await matchEngine.submitHumanSpeech(props.match.id, content)
      draft.value = ''
    } else if (props.inputKind === 'vote') {
      next = await matchEngine.submitHumanVote(
        props.match.id,
        selectedTargetId.value,
        !selectedTargetId.value
      )
      selectedTargetId.value = null
    } else if (props.inputKind === 'wolf_chat') {
      next = await matchEngine.submitHumanWolfChat(props.match.id, content)
      draft.value = ''
    } else if (props.inputKind === 'witch_poison') {
      next = await matchEngine.submitHumanWitchPoison(props.match.id, selectedTargetId.value)
      selectedTargetId.value = null
    } else if (props.inputKind === 'seer_check') {
      if (!selectedTargetId.value) throw new Error('请选择查验目标')
      next = await matchEngine.submitHumanSeerCheck(props.match.id, selectedTargetId.value)
      selectedTargetId.value = null
    } else {
      if (!selectedTargetId.value) throw new Error('请选择刀口目标')
      next = await matchEngine.submitHumanWolfKill(props.match.id, selectedTargetId.value)
      selectedTargetId.value = null
    }
    resetPolish()
    hints.value = []
    emit('updated', next)
    emit('submitted')
  } catch (e) {
    emit('error', formatUserMessage(e))
  } finally {
    busy.value = false
  }
}

async function requestPolishAndPreview() {
  if (!props.humanParticipant || busy.value || props.disabled) return
  const text = draft.value.trim()
  if (!text) return
  busy.value = true
  try {
    await syncDraftToMatch()
    const result = await polishHumanDraft(props.match, props.humanParticipant, props.character, text, props.inputKind)
    polishOriginal.value = text
    polishPreview.value = result.text
    polishStep.value = 'preview'
  } catch (e) {
    emit('error', formatUserMessage(e))
  } finally {
    busy.value = false
  }
}

async function onPrimaryAction() {
  if (
    props.inputKind === 'vote' ||
    props.inputKind === 'wolf_kill' ||
    props.inputKind === 'witch_poison' ||
    props.inputKind === 'seer_check'
  ) {
    await submitDirect()
    return
  }
  if (polishStep.value === 'preview') {
    await submitDirect(polishPreview.value)
    return
  }
  await requestPolishAndPreview()
}

function targetLabel(p: MatchParticipant): string {
  return `${p.seatOrder} · ${p.characterName}`
}
</script>

<template>
  <div class="aa-floating-action aa-room-no-drag">
    <div v-if="identity" class="aa-floating-action__identity">
      <ShieldCheck :size="16" />
      <div>
        <b>你的身份</b>
        <span>{{ identity.label }}</span>
        <small v-if="roleSkillText">{{ roleSkillText }}</small>
      </div>
    </div>

    <div class="aa-floating-action__head">
      <component :is="inputKind === 'vote' || inputKind === 'wolf_kill' ? Vote : inputKind === 'wolf_chat' ? MoonStar : Send" :size="15" />
      <strong>{{ title }}</strong>
      <span class="aa-floating-action__hint">
        {{ isTextInput ? '输入 @ 可提及玩家，完成后由分身润色' : '不限时，完成后点击确认' }}
      </span>
    </div>

    <div v-if="inputKind === 'wolf_chat' && wolfMessages.length" class="aa-floating-action__wolf-log">
      <p v-for="item in wolfMessages" :key="item.id">
        <b>{{ item.participantName }}</b>：{{ item.content }}
      </p>
    </div>

    <template v-if="isTextInput && polishStep === 'edit'">
      <div v-if="quickPhrases.length" class="aa-floating-action__chips">
        <button
          v-for="phrase in quickPhrases"
          :key="phrase"
          type="button"
          class="aa-floating-action__chip"
          :disabled="disabled || busy"
          @click="insertPhrase(phrase)"
        >
          {{ phrase }}
        </button>
        <button
          type="button"
          class="aa-floating-action__chip aa-floating-action__chip--hint"
          :disabled="disabled || busy || hintsLoading"
          @click="loadHints"
        >
          <Loader2 v-if="hintsLoading" :size="12" class="spin" />
          <Sparkles v-else :size="12" />
          分身思路
        </button>
      </div>

      <div v-if="hints.length" class="aa-floating-action__hints">
        <Lightbulb :size="13" />
        <button
          v-for="(hint, index) in hints"
          :key="index"
          type="button"
          class="aa-floating-action__hint-item"
          :disabled="disabled || busy"
          @click="applyHint(hint)"
        >
          {{ hint }}
        </button>
      </div>

      <div class="aa-floating-action__composer">
        <textarea
          ref="textareaRef"
          v-model="draft"
          rows="3"
          :placeholder="inputKind === 'wolf_chat' ? '输入狼队队内意见（仅队友可见），输入 @ 提及队友…' : '输入公开发言，输入 @ 可快捷提及玩家…'"
          :disabled="disabled || busy"
          @input="onTextInput"
          @keydown="onTextKeydown"
          @click="syncMentionState"
        />
        <ul v-if="mentionOpen && filteredMentions.length" class="aa-floating-action__mentions">
          <li
            v-for="p in filteredMentions"
            :key="p.characterId"
            @mousedown.prevent="pickMention(p)"
          >
            <b>{{ p.seatOrder }}号</b> {{ p.characterName }}
          </li>
        </ul>
      </div>
    </template>

    <div v-else-if="isTextInput && polishStep === 'preview'" class="aa-floating-action__polish">
      <b>分身润色预览</b>
      <p class="aa-floating-action__polish-text">{{ polishPreview }}</p>
      <div class="aa-floating-action__polish-actions">
        <button type="button" class="aa-floating-action__polish-btn is-primary" :disabled="busy" @click="submitDirect(polishPreview)">
          发表润色版
        </button>
        <button type="button" class="aa-floating-action__polish-btn" :disabled="busy" @click="submitDirect(polishOriginal)">
          发表原文
        </button>
        <button type="button" class="aa-floating-action__polish-btn" :disabled="busy" @click="resetPolish">
          继续编辑
        </button>
      </div>
    </div>

    <div v-else-if="isWitchAntidote" class="aa-floating-action__witch-step">
      <p v-if="knifeTarget" class="aa-floating-action__knife-hint">
        <FlaskConical :size="14" />
        今晚刀口：<b>{{ targetLabel(knifeTarget) }}</b>
      </p>
      <p v-else class="aa-floating-action__knife-hint">本夜暂无刀口，解药无法使用。</p>
      <div class="aa-floating-action__targets">
        <button
          type="button"
          class="aa-floating-action__target aa-floating-action__target--save"
          :disabled="disabled || busy || !antidoteAvailable || !knifeTarget"
          @click="submitAntidote(true)"
        >
          使用解药
        </button>
        <button
          type="button"
          class="aa-floating-action__target"
          :disabled="disabled || busy"
          @click="submitAntidote(false)"
        >
          不用解药
        </button>
      </div>
    </div>

    <div v-else-if="isWitchPoison" class="aa-floating-action__targets">
      <p v-if="!poisonAvailable" class="aa-floating-action__vote-empty">毒药已用尽或首夜不可用。</p>
      <button
        v-for="target in poisonTargets"
        :key="target.characterId"
        type="button"
        class="aa-floating-action__target"
        :class="{ 'is-active': selectedTargetId === target.characterId }"
        @click="selectedTargetId = target.characterId"
      >
        {{ targetLabel(target) }}
      </button>
      <button
        type="button"
        class="aa-floating-action__target"
        :class="{ 'is-active': selectedTargetId === null }"
        @click="selectedTargetId = null"
      >
        不用毒药
      </button>
    </div>

    <div v-else-if="isGuardProtect" class="aa-floating-action__witch-step">
      <p v-if="lastGuarded" class="aa-floating-action__knife-hint">
        <ShieldCheck :size="14" />
        上夜已守 <b>{{ targetLabel(lastGuarded) }}</b>，本夜不可再选。
      </p>
      <div class="aa-floating-action__targets">
        <button
          v-for="target in guardTargets"
          :key="target.characterId"
          type="button"
          class="aa-floating-action__target aa-floating-action__target--save"
          :disabled="disabled || busy"
          @click="submitGuardProtect(target.characterId)"
        >
          守护 {{ targetLabel(target) }}
        </button>
        <p v-if="!guardTargets.length" class="aa-floating-action__vote-empty">本夜无可守护目标。</p>
      </div>
    </div>

    <div v-else-if="isSeerCheck" class="aa-floating-action__targets">
      <button
        v-for="target in seerTargets"
        :key="target.characterId"
        type="button"
        class="aa-floating-action__target"
        :class="{ 'is-active': selectedTargetId === target.characterId }"
        @click="selectedTargetId = target.characterId"
      >
        {{ targetLabel(target) }}
      </button>
      <p v-if="!seerTargets.length" class="aa-floating-action__vote-empty">本夜无可查验目标。</p>
    </div>

    <div v-else-if="!isTextInput" class="aa-floating-action__targets">
      <p v-if="inputKind === 'vote' && !voteTargets.length" class="aa-floating-action__vote-empty">
        {{ match.runtime.currentPhaseId === 'sheriff-vote' ? '暂无警上竞选者，只能弃权。' : '暂无可投票目标。' }}
      </p>
      <button
        v-for="target in inputKind === 'wolf_kill' ? killTargets : voteTargets"
        :key="target.characterId"
        type="button"
        class="aa-floating-action__target"
        :class="{ 'is-active': selectedTargetId === target.characterId }"
        @click="selectedTargetId = target.characterId"
      >
        {{ targetLabel(target) }}
      </button>
      <button
        v-if="inputKind === 'vote' && allowVoteAbstain"
        type="button"
        class="aa-floating-action__target"
        :class="{ 'is-active': selectedTargetId === null }"
        @click="selectedTargetId = null"
      >
        弃权
      </button>
    </div>

    <button
      v-if="!isWitchAntidote && !isGuardProtect && polishStep === 'edit'"
      type="button"
      class="aa-floating-action__submit"
      :disabled="disabled || busy || (isTextInput && !draft.trim()) || (inputKind === 'vote' && !allowVoteAbstain && !selectedTargetId) || (inputKind === 'wolf_kill' && !selectedTargetId) || (inputKind === 'seer_check' && !selectedTargetId)"
      @click="onPrimaryAction"
    >
      <Loader2 v-if="busy" :size="14" class="spin" />
      <Send v-else :size="14" />
      {{ isTextInput ? '润色并发表' : '确认提交' }}
    </button>
  </div>
</template>

<style scoped>
.aa-floating-action {
  position: absolute;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  z-index: 8;
  width: min(720px, calc(100% - 40px));
  padding: 14px 16px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(124, 92, 255, 0.22);
  box-shadow: 0 20px 50px rgba(53, 45, 110, 0.18);
  backdrop-filter: blur(10px);
}
.aa-floating-action__identity {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(124, 92, 255, 0.1), rgba(108, 92, 255, 0.06));
  border: 1px solid rgba(124, 92, 255, 0.18);
  color: #4a3f8f;
}
.aa-floating-action__identity svg {
  flex-shrink: 0;
  margin-top: 2px;
  color: #6d4cff;
}
.aa-floating-action__identity b {
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: #8b7fd6;
  margin-bottom: 2px;
}
.aa-floating-action__identity span {
  display: block;
  font-size: 14px;
  font-weight: 700;
}
.aa-floating-action__identity small {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: #7a6eb8;
  line-height: 1.45;
}
.aa-floating-action__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  color: #4a3f8f;
  font-size: 13px;
}
.aa-floating-action__head strong {
  font-size: 14px;
}
.aa-floating-action__hint {
  margin-left: auto;
  color: #8b7fd6;
  font-size: 11px;
  text-align: right;
  max-width: 52%;
  line-height: 1.35;
}
.aa-floating-action__wolf-log {
  max-height: 120px;
  overflow: auto;
  margin-bottom: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(35, 24, 58, 0.06);
  color: #5f538f;
  font-size: 12px;
  line-height: 1.55;
}
.aa-floating-action__wolf-log p {
  margin: 0 0 6px;
}
.aa-floating-action__wolf-log b {
  color: #6d4cff;
}
.aa-floating-action__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
  max-height: 72px;
  overflow: auto;
}
.aa-floating-action__chip {
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(124, 92, 255, 0.16);
  background: rgba(255, 255, 255, 0.86);
  color: #5f538f;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}
.aa-floating-action__chip:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.aa-floating-action__chip--hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-color: rgba(124, 92, 255, 0.28);
  color: #6d4cff;
  font-weight: 650;
}
.aa-floating-action__hints {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(255, 248, 230, 0.72);
  border: 1px solid rgba(255, 193, 94, 0.28);
  color: #7a5a20;
}
.aa-floating-action__hints svg {
  flex-shrink: 0;
}
.aa-floating-action__hint-item {
  flex: 1 1 auto;
  min-width: 0;
  padding: 4px 8px;
  border: 0;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.7);
  color: #6b4f1a;
  font-size: 11px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
}
.aa-floating-action__composer {
  position: relative;
  margin-bottom: 10px;
}
.aa-floating-action__composer textarea {
  width: 100%;
  min-height: 88px;
  resize: vertical;
  border-radius: 14px;
  border: 1px solid rgba(124, 92, 255, 0.18);
  padding: 12px 14px;
  font-size: 14px;
  line-height: 1.6;
}
.aa-floating-action__mentions {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: calc(100% + 6px);
  margin: 0;
  padding: 6px;
  list-style: none;
  border-radius: 14px;
  background: #fff;
  border: 1px solid rgba(124, 92, 255, 0.22);
  box-shadow: 0 12px 32px rgba(53, 45, 110, 0.14);
  max-height: 160px;
  overflow: auto;
  z-index: 2;
}
.aa-floating-action__mentions li {
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 13px;
  color: #4a3f8f;
  cursor: pointer;
}
.aa-floating-action__mentions li:hover {
  background: rgba(124, 92, 255, 0.1);
}
.aa-floating-action__mentions b {
  color: #6d4cff;
}
.aa-floating-action__polish {
  margin-bottom: 10px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(244, 240, 255, 0.88);
  border: 1px solid rgba(124, 92, 255, 0.2);
}
.aa-floating-action__polish b {
  display: block;
  font-size: 12px;
  color: #6d4cff;
  margin-bottom: 8px;
}
.aa-floating-action__polish-text {
  margin: 0 0 10px;
  font-size: 14px;
  line-height: 1.65;
  color: #342b78;
}
.aa-floating-action__polish-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.aa-floating-action__polish-btn {
  height: 32px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid rgba(124, 92, 255, 0.2);
  background: #fff;
  color: #5f538f;
  font-size: 12px;
  cursor: pointer;
}
.aa-floating-action__polish-btn.is-primary {
  background: linear-gradient(135deg, #8a68ff, #6c5cff);
  border-color: transparent;
  color: #fff;
  font-weight: 650;
}
.aa-floating-action__targets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
  max-height: 140px;
  overflow: auto;
}
.aa-floating-action__vote-empty {
  width: 100%;
  margin: 0 0 4px;
  font-size: 12px;
  color: #8b7fd6;
  line-height: 1.5;
}
.aa-floating-action__witch-step {
  margin-bottom: 10px;
}
.aa-floating-action__knife-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(124, 92, 255, 0.08);
  color: #4a3f8f;
  font-size: 13px;
  line-height: 1.5;
}
.aa-floating-action__knife-hint b {
  color: #6d4cff;
}
.aa-floating-action__target--save.is-active,
.aa-floating-action__target--save {
  border-color: rgba(76, 175, 120, 0.45);
  color: #2d7a52;
}
.aa-floating-action__target--save:hover:not(:disabled) {
  background: rgba(76, 175, 120, 0.12);
}
.aa-floating-action__target {
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(124, 92, 255, 0.16);
  background: rgba(255, 255, 255, 0.86);
  color: #5f538f;
  font-size: 12px;
  cursor: pointer;
}
.aa-floating-action__target.is-active {
  background: rgba(124, 92, 255, 0.14);
  border-color: rgba(124, 92, 255, 0.42);
  color: #4a3f8f;
  font-weight: 700;
}
.aa-floating-action__submit {
  width: 100%;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  border-radius: 14px;
  background: linear-gradient(135deg, #8a68ff, #6c5cff);
  color: #fff;
  font-size: 14px;
  font-weight: 650;
  cursor: pointer;
}
.aa-floating-action__submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
