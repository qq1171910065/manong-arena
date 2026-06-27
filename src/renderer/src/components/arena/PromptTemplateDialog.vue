<script setup lang="ts">

import { ref, watch } from 'vue'

import DetailEditDialog from '@renderer/components/arena/DetailEditDialog.vue'

import { formatUserMessage, gameScenarioService } from '@renderer/services/arena'

import type { GameScenarioDefinition, PromptPack, PromptTemplate } from '@shared/arena/game-scenario'



const show = defineModel<boolean>({ default: false })



const props = defineProps<{

  template: PromptTemplate

  scenario: GameScenarioDefinition

  promptPack: PromptPack

}>()



const emit = defineEmits<{

  saved: []

}>()



const name = ref('')

const description = ref('')

const systemTemplate = ref('')

const userTemplate = ref('')

const saving = ref(false)

const error = ref('')



const slotLabels: Record<string, string> = {

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



function fillDraft() {

  name.value = props.template.name

  description.value = props.template.description || ''

  systemTemplate.value = props.template.systemTemplate

  userTemplate.value = props.template.userTemplate || ''

}



watch(show, (open) => {

  if (open) {

    fillDraft()

    error.value = ''

  }

}, { immediate: true })



function customPackId(): string {

  if (!props.promptPack.isBuiltin) return props.promptPack.id

  return `${props.promptPack.id}-custom`

}



async function save() {

  if (!systemTemplate.value.trim()) {

    error.value = 'System 提示词不能为空'

    return

  }

  saving.value = true

  error.value = ''

  try {

    const packId = customPackId()

    const existing = gameScenarioService.getPromptPack(packId)

    const pack: PromptPack = existing && !existing.isBuiltin

      ? structuredClone(existing)

      : {

          ...structuredClone(props.promptPack),

          id: packId,

          isBuiltin: false,

          createdAt: new Date().toISOString(),

          updatedAt: new Date().toISOString(),

        }



    const updated: PromptTemplate = {

      ...props.template,

      name: name.value.trim() || props.template.name,

      description: description.value.trim() || undefined,

      systemTemplate: systemTemplate.value,

      userTemplate: userTemplate.value.trim() || undefined,

    }



    const idx = pack.templates.findIndex((item) => item.id === updated.id)

    if (idx >= 0) pack.templates[idx] = updated

    else pack.templates.push(updated)

    pack.updatedAt = new Date().toISOString()



    await gameScenarioService.saveCustomPromptPack(pack)



    if (props.scenario.defaultPromptPackId !== packId) {

      await gameScenarioService.saveCustomScenario({

        id: props.scenario.id,

        gameModeId: props.scenario.gameModeId,

        defaultPromptPackId: packId,

      } as GameScenarioDefinition)

    }



    show.value = false

    emit('saved')

  } catch (err) {

    error.value = formatUserMessage(err)

  } finally {

    saving.value = false

  }

}

</script>



<template>

  <DetailEditDialog

    v-model="show"

    title="编辑提示词"

    :subtitle="slotLabels[template.slotId] || template.slotId"

    :saving="saving"

    @save="save"

  >

    <p v-if="error" class="edit-error">{{ error }}</p>



    <label class="edit-field">

      <span>模板名称</span>

      <input v-model="name" class="field" maxlength="40" />

    </label>

    <label class="edit-field">

      <span>说明</span>

      <input v-model="description" class="field" maxlength="120" />

    </label>

    <label class="edit-field">

      <span>System 提示词</span>

      <textarea v-model="systemTemplate" class="field field-tall" rows="10" />

    </label>

    <label class="edit-field">

      <span>User 提示词（可选）</span>

      <textarea v-model="userTemplate" class="field field-tall" rows="5" placeholder="留空表示无 User 模板" />

    </label>

  </DetailEditDialog>

</template>



<style scoped>

.edit-error {

  margin: 0 0 12px;

  padding: 10px 12px;

  border-radius: 12px;

  background: rgba(239, 68, 68, 0.08);

  color: #dc2626;

  font-size: 13px;

}



.edit-field {

  display: grid;

  gap: 6px;

  margin-bottom: 12px;

}



.edit-field span {

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



.field-tall {

  min-height: 120px;

  resize: vertical;

  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;

  font-size: 12px;

  line-height: 1.55;

}

</style>

