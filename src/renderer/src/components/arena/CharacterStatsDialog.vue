<script setup lang="ts">
import { computed } from 'vue'
import { Brain, BookOpen, MessageCircle, Swords, X } from 'lucide-vue-next'
import { formatTimeLabel } from '@renderer/utils/id'
import type { Character, CharacterGrowthRecord, BehaviorChangeRecord } from '@shared/arena/types'

export type CharacterStatsTab = 'matches' | 'thinking' | 'growth' | 'behavior'

const show = defineModel<boolean>({ default: false })

const props = defineProps<{
  character: Character
  growthRecords: CharacterGrowthRecord[]
  behaviorChanges: BehaviorChangeRecord[]
  chatMessageCount: number
  initialTab?: CharacterStatsTab
}>()

const activeTab = computed(() => props.initialTab || 'matches')

const winRate = computed(() => {
  if (props.character.stats.matchCount === 0) return '0%'
  return `${Math.round((props.character.stats.winCount / props.character.stats.matchCount) * 100)}%`
})

const lossCount = computed(() =>
  Math.max(0, props.character.stats.matchCount - props.character.stats.winCount)
)

const learnedSkills = computed(() => props.character.gameSkills.filter((s) => s.learned))

const learningEntries = computed(() => {
  const rows: Array<{
    id: string
    scenarioName: string
    source: string
    summary: string
    detail?: string
    createdAt?: string
  }> = []
  for (const skill of props.character.gameSkills) {
    const name = skill.scenarioName || skill.scenarioId
    for (const entry of skill.learningLog || []) {
      rows.push({
        id: entry.id,
        scenarioName: name,
        source: entry.source === 'post_match' ? '赛后讨论' : entry.source === 'relearn' ? '再次学习' : '初始学习',
        summary: entry.summary,
        detail: entry.understanding,
        createdAt: entry.createdAt,
      })
    }
    if (skill.mentalModel) {
      rows.push({
        id: `${skill.scenarioId}-mental`,
        scenarioName: name,
        source: '心智模型',
        summary: skill.mentalModel,
      })
    }
    for (const [i, hypo] of (skill.hypotheses || []).entries()) {
      rows.push({
        id: `${skill.scenarioId}-hypo-${i}`,
        scenarioName: name,
        source: '假设推演',
        summary: hypo,
      })
    }
    for (const [i, edge] of (skill.edgeCases || []).entries()) {
      rows.push({
        id: `${skill.scenarioId}-edge-${i}`,
        scenarioName: name,
        source: '边界情况',
        summary: edge,
      })
    }
    for (const [i, mistake] of (skill.commonMistakes || []).entries()) {
      rows.push({
        id: `${skill.scenarioId}-mistake-${i}`,
        scenarioName: name,
        source: '常见误区',
        summary: mistake,
      })
    }
  }
  return rows
})

const tabMeta: Record<CharacterStatsTab, { title: string; icon: typeof Swords }> = {
  matches: { title: '对局数据', icon: Swords },
  thinking: { title: '学习与思考', icon: Brain },
  growth: { title: '养成记录', icon: MessageCircle },
  behavior: { title: '行为变更', icon: BookOpen },
}
</script>

<template>
  <Teleport to="body">
    <Transition name="detail-edit-fade">
      <div v-if="show" class="stats-dialog-overlay" @click.self="show = false">
        <section class="stats-dialog" role="dialog" :aria-label="tabMeta[activeTab].title">
          <header class="stats-dialog__head">
            <div>
              <component :is="tabMeta[activeTab].icon" :size="18" />
              <strong>{{ tabMeta[activeTab].title }}</strong>
              <span>{{ character.name }}</span>
            </div>
            <button type="button" title="关闭" @click="show = false"><X :size="18" /></button>
          </header>

          <div class="stats-dialog__body">
            <template v-if="activeTab === 'matches'">
              <div class="stats-dialog__grid">
                <article><span>总对局</span><strong>{{ character.stats.matchCount }}</strong></article>
                <article><span>胜场</span><strong>{{ character.stats.winCount }}</strong></article>
                <article><span>负场/未胜</span><strong>{{ lossCount }}</strong></article>
                <article><span>胜率</span><strong>{{ winRate }}</strong></article>
                <article><span>最近对局</span><strong>{{ character.stats.lastMatchAt ? formatTimeLabel(character.stats.lastMatchAt) : '暂无' }}</strong></article>
                <article><span>已学玩法</span><strong>{{ learnedSkills.length }} / {{ character.gameSkills.length }}</strong></article>
                <article><span>私聊消息</span><strong>{{ chatMessageCount }} 条</strong></article>
              </div>
              <template v-if="learnedSkills.length">
                <h3>玩法技能概览</h3>
                <ul class="stats-dialog__list">
                  <li v-for="skill in character.gameSkills" :key="skill.scenarioId">
                    <strong>{{ skill.scenarioName || skill.scenarioId }}</strong>
                    <span>
                      {{ skill.learned ? '已学习' : '未学习' }}
                      · 考试 {{ skill.examPassed ? '已通过' : skill.examBypassed ? '免考' : '未通过' }}
                      · 学习记录 {{ skill.learningLog?.length || 0 }} 条
                    </span>
                  </li>
                </ul>
              </template>
            </template>

            <template v-else-if="activeTab === 'thinking'">
              <p v-if="!learningEntries.length" class="stats-dialog__empty">尚无学习与思考记录。参局学习或赛后讨论后会沉淀在这里。</p>
              <article v-for="row in learningEntries" :key="row.id" class="stats-dialog__timeline">
                <em>{{ row.scenarioName }} · {{ row.source }}{{ row.createdAt ? ` · ${formatTimeLabel(row.createdAt)}` : '' }}</em>
                <strong>{{ row.summary }}</strong>
                <p v-if="row.detail">{{ row.detail }}</p>
              </article>
            </template>

            <template v-else-if="activeTab === 'growth'">
              <p v-if="!growthRecords.length" class="stats-dialog__empty">尚无养成记录。与角色私聊或完成赛后复盘后会出现。</p>
              <article v-for="record in growthRecords" :key="record.id" class="stats-dialog__timeline">
                <em>{{ record.source === 'chat' ? '对话' : '赛后' }} · {{ formatTimeLabel(record.createdAt) }}</em>
                <strong>{{ record.summary }}</strong>
                <p v-if="record.addedPrinciples.length">+ {{ record.addedPrinciples.join('、') }}</p>
                <p v-if="record.addedPhrases.length">新表达：{{ record.addedPhrases.join('、') }}</p>
                <p v-if="record.removedPrinciples.length">− {{ record.removedPrinciples.join('、') }}</p>
              </article>
            </template>

            <template v-else-if="activeTab === 'behavior'">
              <p v-if="!behaviorChanges.length" class="stats-dialog__empty">尚无行为准则变更记录。</p>
              <article v-for="record in behaviorChanges" :key="record.id" class="stats-dialog__timeline">
                <em>{{ formatTimeLabel(record.createdAt) }} · {{ record.applied ? '已应用' : '待确认' }}</em>
                <strong>{{ record.summary }}</strong>
                <p>+ {{ record.addedPrinciples.join('、') || '无' }} / − {{ record.removedPrinciples.join('、') || '无' }}</p>
              </article>
            </template>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.stats-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 1300;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(15, 18, 42, 0.42);
  backdrop-filter: blur(6px);
}

.stats-dialog {
  width: min(640px, 100%);
  max-height: min(82vh, 760px);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.78);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 32px 80px rgba(50, 56, 120, 0.22);
  overflow: hidden;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
}

.stats-dialog__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid rgba(130, 142, 207, 0.12);
}

.stats-dialog__head div {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #5b57f3;
}

.stats-dialog__head strong {
  color: #171145;
  font-size: 18px;
}

.stats-dialog__head span {
  color: #7a85b0;
  font-size: 13px;
}

.stats-dialog__head button {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.78);
  cursor: pointer;
  color: #4c4776;
}

.stats-dialog__body {
  overflow: auto;
  padding: 16px 18px 20px;
  scrollbar-width: thin;
}

.stats-dialog__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.stats-dialog__grid article {
  padding: 12px;
  border-radius: 14px;
  background: rgba(112, 105, 255, 0.06);
}

.stats-dialog__grid span {
  display: block;
  color: #7a85b0;
  font-size: 11px;
}

.stats-dialog__grid strong {
  display: block;
  margin-top: 4px;
  color: #17205a;
  font-size: 16px;
}

.stats-dialog__body h3 {
  margin: 16px 0 8px;
  color: #17205a;
  font-size: 14px;
}

.stats-dialog__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.stats-dialog__list li {
  padding: 10px 0;
  border-bottom: 1px solid rgba(130, 142, 207, 0.1);
}

.stats-dialog__list strong {
  display: block;
  color: #17205a;
  font-size: 14px;
}

.stats-dialog__list span {
  display: block;
  margin-top: 4px;
  color: #66709d;
  font-size: 12px;
}

.stats-dialog__timeline {
  padding: 12px 0;
  border-bottom: 1px solid rgba(130, 142, 207, 0.1);
}

.stats-dialog__timeline em {
  display: block;
  color: #9aa3c7;
  font-size: 11px;
  font-style: normal;
}

.stats-dialog__timeline strong {
  display: block;
  margin-top: 4px;
  color: #17205a;
  font-size: 14px;
  line-height: 1.5;
}

.stats-dialog__timeline p {
  margin: 6px 0 0;
  color: #66709d;
  font-size: 12px;
  line-height: 1.55;
}

.stats-dialog__empty {
  margin: 0;
  color: #7a85b0;
  font-size: 13px;
  line-height: 1.6;
}

.detail-edit-fade-enter-active,
.detail-edit-fade-leave-active {
  transition: opacity 0.18s ease;
}

.detail-edit-fade-enter-from,
.detail-edit-fade-leave-to {
  opacity: 0;
}
</style>
