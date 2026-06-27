<script setup lang="ts">
import { Crown, MoonStar, ShieldCheck, Vote, X } from 'lucide-vue-next'
import type { GameMode } from '@shared/arena/types'

defineProps<{
  mode: GameMode
}>()

const open = defineModel<boolean>('open', { default: false })

const ruleIcons = [Crown, MoonStar, Vote, ShieldCheck]
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="mode-info-backdrop" @click.self="open = false">
      <div class="mode-info-dialog glass-panel" role="dialog" aria-modal="true" :aria-label="mode.name + ' 玩法说明'">
        <header class="mode-info-head">
          <div>
            <span>玩法说明</span>
            <h2>{{ mode.name }}</h2>
            <p>{{ mode.subtitle }}</p>
          </div>
          <button type="button" class="close-btn" aria-label="关闭" @click="open = false"><X :size="18" /></button>
        </header>
        <div class="mode-info-body">
          <p class="mode-desc">{{ mode.description }}</p>
          <section v-if="mode.setupSummary" class="info-block">
            <strong>流程概览</strong>
            <p>{{ mode.setupSummary }}</p>
          </section>
          <section v-if="mode.sheriffRule" class="info-block">
            <strong>警长规则</strong>
            <p>{{ mode.sheriffRule }}</p>
          </section>
          <section v-if="mode.ruleHighlights?.length" class="info-block">
            <strong>核心规则</strong>
            <ul>
              <li v-for="(item, index) in mode.ruleHighlights" :key="index">{{ item }}</li>
            </ul>
          </section>
          <section v-if="mode.phases?.length" class="info-block">
            <strong>阶段流程</strong>
            <div class="phase-list">
              <article v-for="phase in mode.phases" :key="phase.id">
                <b>{{ phase.order }}. {{ phase.name }}</b>
                <p>{{ phase.description }}</p>
              </article>
            </div>
          </section>
          <section v-if="mode.id === 'werewolf'" class="info-block quick-rules">
            <article v-for="(icon, index) in ruleIcons" :key="index">
              <component :is="icon" :size="16" />
              <div>
                <b>{{ ['警长玩法', '夜晚技能', '放逐投票', '胜负判定'][index] }}</b>
                <p>
                  {{
                    [
                      mode.sheriffRule || '首轮竞选警长，警长拥有归票权。',
                      '守卫、狼人、预言家、女巫依次行动，裁判隐藏私有信息，只公开天亮结果。',
                      '存活且有票权的角色投票，警长票按 1.5 票计算，平票无人出局。',
                      '狼人全灭则好人胜；屠边时杀光平民或神职则狼人胜，屠城时杀光所有好人则狼人胜（开局可选）。',
                    ][index]
                  }}
                </p>
              </div>
            </article>
          </section>
        </div>
        <footer class="mode-info-foot">
          <button type="button" @click="open = false">知道了</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.mode-info-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(22, 18, 52, 0.42);
  backdrop-filter: blur(8px);
}
.mode-info-dialog {
  width: min(560px, 100%);
  max-height: min(82vh, 760px);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  border-radius: 24px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.92), rgba(249, 247, 255, 0.88));
  border: 1px solid rgba(255, 255, 255, 0.82);
  box-shadow: 0 28px 64px rgba(84, 68, 160, 0.22);
}
.mode-info-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 18px 12px;
}
.mode-info-head span {
  color: #8077a5;
  font-size: 12px;
  font-weight: 650;
}
.mode-info-head h2 {
  margin: 5px 0 4px;
  color: #151550;
  font-size: 24px;
  line-height: 1.12;
}
.mode-info-head p {
  margin: 0;
  color: #665f8e;
  font-size: 13px;
}
.close-btn {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(126, 99, 255, 0.12);
  border-radius: 12px;
  color: #5e52d8;
  background: rgba(255, 255, 255, 0.62);
  cursor: pointer;
}
.mode-info-body {
  min-height: 0;
  overflow: auto;
  padding: 0 18px 12px;
  scrollbar-width: thin;
}
.mode-desc {
  margin: 0 0 14px;
  color: #534a82;
  font-size: 13px;
  line-height: 1.65;
}
.info-block {
  margin-bottom: 14px;
  padding: 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.54);
  border: 1px solid rgba(126, 99, 255, 0.08);
}
.info-block strong {
  display: block;
  margin-bottom: 7px;
  color: #1b1856;
  font-size: 13px;
}
.info-block p,
.info-block li {
  margin: 0;
  color: #746d99;
  font-size: 12px;
  line-height: 1.55;
}
.info-block ul {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 6px;
}
.phase-list {
  display: grid;
  gap: 8px;
}
.phase-list b {
  color: #24205a;
  font-size: 12px;
}
.phase-list p {
  margin: 3px 0 0;
}
.quick-rules {
  display: grid;
  gap: 8px;
}
.quick-rules article {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
}
.quick-rules svg {
  margin-top: 2px;
  color: #755cff;
}
.mode-info-foot {
  padding: 12px 18px 18px;
}
.mode-info-foot button {
  width: 100%;
  height: 44px;
  border: 0;
  border-radius: 16px;
  color: #fff;
  background: linear-gradient(135deg, #8d6bff, #5b58f7);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}
</style>
