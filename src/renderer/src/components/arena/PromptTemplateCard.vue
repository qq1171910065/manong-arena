<script setup lang="ts">
import type { PromptTemplate } from '@shared/arena/game-scenario'

defineProps<{
  template: PromptTemplate
  compact?: boolean
}>()

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
</script>

<template>
  <article class="prompt-card" :class="{ compact }">
    <header>
      <div>
        <strong>{{ template.name }}</strong>
        <span class="slot-tag">{{ slotLabels[template.slotId] || template.slotId }}</span>
      </div>
      <em v-if="template.outputFormat">{{ template.outputFormat }}</em>
    </header>
    <p v-if="template.description" class="desc">{{ template.description }}</p>
    <div class="block">
      <span>System</span>
      <pre>{{ template.systemTemplate }}</pre>
    </div>
    <div v-if="template.userTemplate" class="block">
      <span>User</span>
      <pre>{{ template.userTemplate }}</pre>
    </div>
  </article>
</template>

<style scoped>
.prompt-card {
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid rgba(130, 142, 207, 0.14);
  background: rgba(255, 255, 255, 0.52);
}

.prompt-card.compact .block pre {
  max-height: 120px;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 10px;
}

header strong {
  display: block;
  color: #17205a;
  font-size: 14px;
  font-weight: 650;
}

.slot-tag {
  display: inline-flex;
  margin-top: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(112, 105, 255, 0.1);
  color: #5b57f3;
  font-size: 11px;
  font-weight: 600;
}

header em {
  color: #7a85b0;
  font-size: 11px;
  font-style: normal;
  text-transform: uppercase;
}

.desc {
  margin: 0 0 10px;
  color: #66709d;
  font-size: 12px;
  line-height: 1.55;
}

.block {
  margin-top: 8px;
}

.block span {
  display: block;
  margin-bottom: 4px;
  color: #8b95bd;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.block pre {
  margin: 0;
  padding: 10px 12px;
  max-height: 220px;
  overflow: auto;
  border-radius: 12px;
  background: rgba(244, 246, 255, 0.85);
  color: #3a4578;
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
