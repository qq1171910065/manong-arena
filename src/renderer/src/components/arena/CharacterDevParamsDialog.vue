<script setup lang="ts">

import { computed } from 'vue'

import ArenaDialogShell from '@renderer/components/common/ArenaDialogShell.vue'

import { useGatewayModelLabel } from '@renderer/composables/useGatewayModelLabel'

import { resolveCharacterDevProfile } from '@shared/arena/character-model-params'

import type { Character } from '@shared/arena/types'



const show = defineModel<boolean>({ default: false })



const props = defineProps<{

  character: Character

}>()



const { modelLabel } = useGatewayModelLabel()



const profile = computed(() => resolveCharacterDevProfile(props.character))



const inferenceRows = computed(() => {

  const params = profile.value.modelParams

  return [

    { label: 'temperature', value: String(params.temperature) },

    { label: 'top_p', value: String(params.top_p) },

    { label: 'presence_penalty', value: String(params.presence_penalty) },

    { label: 'frequency_penalty', value: String(params.frequency_penalty) },

    { label: 'max_tokens', value: String(params.max_tokens) },

    { label: '上下文窗口', value: `${params.contextMessageLimit} 条` },

    { label: '提示约束', value: profile.value.promptStrictnessLabel },

    { label: '推理深度', value: profile.value.reasoningDepthLabel },

    { label: '绑定模型', value: modelLabel(props.character.modelId) },

  ]

})

</script>



<template>

  <ArenaDialogShell

    v-model="show"

    title="预览开发参数"

    :subtitle="`${character.name} · Lv.${profile.growth.level}`"

    variant="preview"

    size="xl"

    show-header-close

  >

    <section class="dev-params-block">

      <h3>调参属性</h3>

      <div class="dev-params-metrics">

        <article v-for="item in profile.attributeEntries" :key="item.id">

          <span>{{ item.label }}</span>

          <strong>{{ item.value }}</strong>

        </article>

      </div>

    </section>



    <section class="dev-params-block">

      <h3>推理能力</h3>

      <div class="dev-params-grid">

        <article v-for="row in inferenceRows" :key="row.label">

          <span>{{ row.label }}</span>

          <strong>{{ row.value }}</strong>

        </article>

      </div>

    </section>



    <section v-if="profile.activeSkills.length" class="dev-params-block">

      <h3>生效角色天赋</h3>

      <ul class="dev-params-skills">

        <li v-for="skill in profile.activeSkills" :key="skill.id">

          <strong>{{ skill.name }}</strong>

          <span>Lv.{{ skill.level }} · {{ skill.matchEffect }}</span>

        </li>

      </ul>

    </section>



    <details class="dev-params-block dev-params-block--json">

      <summary>网关请求体</summary>

      <pre>{{ JSON.stringify(profile.gatewayParams, null, 2) }}</pre>

    </details>

  </ArenaDialogShell>

</template>



<style scoped>

.dev-params-block h3 {

  margin: 0 0 10px;

  color: #17205a;

  font-size: 13px;

  font-weight: 650;

}



.dev-params-block + .dev-params-block {

  margin-top: 14px;

}



.dev-params-metrics {

  display: grid;

  grid-template-columns: repeat(5, minmax(0, 1fr));

  gap: 8px;

}



.dev-params-metrics article {

  padding: 10px 12px;

  border-radius: 12px;

  background: rgba(112, 105, 255, 0.05);

  border: 1px solid rgba(130, 142, 207, 0.1);

  text-align: center;

}



.dev-params-metrics span {

  display: block;

  color: #66709d;

  font-size: 11px;

}



.dev-params-metrics strong {

  display: block;

  margin-top: 4px;

  color: #5b57f3;

  font-size: 18px;

  font-weight: 700;

}



.dev-params-grid {

  display: grid;

  grid-template-columns: repeat(3, minmax(0, 1fr));

  gap: 8px;

}



.dev-params-grid article {

  display: grid;

  gap: 4px;

  padding: 10px 12px;

  border-radius: 12px;

  background: rgba(255, 255, 255, 0.62);

  border: 1px solid rgba(130, 142, 207, 0.1);

}



.dev-params-grid span {

  color: #9aa3c7;

  font-size: 10px;

}



.dev-params-grid strong {

  color: #17205a;

  font-size: 13px;

  font-weight: 650;

  line-height: 1.4;

  word-break: break-word;

}



.dev-params-skills {

  margin: 0;

  padding: 0;

  list-style: none;

  display: grid;

  gap: 8px;

}



.dev-params-skills li {

  padding: 10px 12px;

  border-radius: 12px;

  background: rgba(255, 255, 255, 0.62);

  border: 1px solid rgba(130, 142, 207, 0.1);

}



.dev-params-skills strong {

  display: block;

  color: #17205a;

  font-size: 13px;

}



.dev-params-skills span {

  display: block;

  margin-top: 4px;

  color: #66709d;

  font-size: 12px;

  line-height: 1.5;

}



.dev-params-block--json summary {

  cursor: pointer;

  color: #66709d;

  font-size: 12px;

  font-weight: 600;

  user-select: none;

}



.dev-params-block--json pre {

  margin: 10px 0 0;

  padding: 12px;

  border-radius: 12px;

  background: #0f1230;

  color: #dbeafe;

  font-size: 11px;

  line-height: 1.55;

  overflow: auto;

}



@media (max-width: 860px) {

  .dev-params-metrics {

    grid-template-columns: repeat(2, minmax(0, 1fr));

  }



  .dev-params-grid {

    grid-template-columns: 1fr;

  }

}

</style>


