<script setup lang="ts">
import { computed } from 'vue'
import { Brain, BookOpen, MessageCircle, Sparkles } from 'lucide-vue-next'
import { formatTimeLabel } from '@renderer/utils/id'
import ArenaDialogShell from '@renderer/components/common/ArenaDialogShell.vue'
import { resolveCharacterGrowth } from '@shared/arena/character-growth'
import type { Character, CharacterGrowthRecord, BehaviorChangeRecord } from '@shared/arena/types'

export type CharacterStatsTab = 'overview' | 'thinking' | 'growth' | 'behavior'

const show = defineModel<boolean>({ default: false })

const props = defineProps<{
  character: Character
  growthRecords: CharacterGrowthRecord[]
  behaviorChanges: BehaviorChangeRecord[]
  chatMessageCount: number
  initialTab?: CharacterStatsTab
}>()

const activeTab = computed(() => props.initialTab || 'overview')

const characterGrowth = computed(() => resolveCharacterGrowth(props.character))
const learnedSkills = computed(() => props.character.gameSkills.filter((s) => s.learned))

const learningEntries = computed(() => {
  const rows: Array<{
    id: string
    scenarioName: string
    source: string
    summary: string
    createdAt?: string
  }> = []
  for (const skill of props.character.gameSkills) {
    const name = skill.scenarioName || skill.scenarioId
    for (const entry of skill.learningLog || []) {
      if (entry.source === 'initial') continue
      rows.push({
        id: entry.id,
        scenarioName: name,
        source: entry.source === 'post_match' ? '复盘领悟' : '再次学习',
        summary: entry.summary,
        createdAt: entry.createdAt,
      })
    }
    if (skill.mentalModel) {
      rows.push({
        id: `${skill.scenarioId}-mental`,
        scenarioName: name,
        source: '范式理解',
        summary: skill.mentalModel,
      })
    }
    for (const [i, mistake] of (skill.commonMistakes || []).slice(0, 2).entries()) {
      rows.push({
        id: `${skill.scenarioId}-mistake-${i}`,
        scenarioName: name,
        source: '常见教训',
        summary: mistake,
      })
    }
  }
  return rows
})

const tabMeta: Record<CharacterStatsTab, { title: string; icon: typeof Sparkles }> = {
  overview: { title: '养成概览', icon: Sparkles },
  thinking: { title: '范式学习', icon: Brain },
  growth: { title: '人设微调', icon: MessageCircle },
  behavior: { title: '行为变更', icon: BookOpen },
}
</script>

<template>
  <ArenaDialogShell
    v-model="show"
    :title="tabMeta[activeTab].title"
    :subtitle="character.name"
    variant="preview"
    size="lg"
    show-header-close
  >
    <div class="stats-dialog__body">
            <template v-if="activeTab === 'overview'">
              <div class="stats-dialog__grid">
                <article><span>等级</span><strong>Lv.{{ characterGrowth.level }}</strong></article>
                <article><span>累计经验</span><strong>{{ characterGrowth.totalExp }} EXP</strong></article>
                <article><span>已学场景</span><strong>{{ learnedSkills.length }} / {{ character.gameSkills.length }}</strong></article>
                <article><span>私聊消息</span><strong>{{ chatMessageCount }} 条</strong></article>
                <article><span>最近演练</span><strong>{{ character.stats.lastMatchAt ? formatTimeLabel(character.stats.lastMatchAt) : '暂无' }}</strong></article>
                <article><span>行为原则</span><strong>{{ character.behaviorPrinciples.length }} 条</strong></article>
              </div>
              <p class="stats-dialog__note">Manong Arena 以 AI 养成为核心。场景演练用于检验与沉淀范式，不在此强调胜负统计。</p>
              <template v-if="learnedSkills.length">
                <h3>已掌握场景范式</h3>
                <ul class="stats-dialog__list">
                  <li v-for="skill in character.gameSkills" :key="skill.scenarioId">
                    <strong>{{ skill.scenarioName || skill.scenarioId }}</strong>
                    <span>
                      {{ skill.learned ? '已学习' : '未学习' }}
                      · {{ skill.examPassed ? '已通过校验' : skill.examBypassed ? '已免考' : '待校验' }}
                    </span>
                  </li>
                </ul>
              </template>
            </template>

            <template v-else-if="activeTab === 'thinking'">
              <p v-if="!learningEntries.length" class="stats-dialog__empty">尚无范式学习记录。学习场景规则或完成复盘后，可迁移的理解会出现在这里。</p>
              <article v-for="row in learningEntries" :key="row.id" class="stats-dialog__timeline">
                <em>{{ row.scenarioName }} · {{ row.source }}{{ row.createdAt ? ` · ${formatTimeLabel(row.createdAt)}` : '' }}</em>
                <strong>{{ row.summary }}</strong>
              </article>
            </template>

            <template v-else-if="activeTab === 'growth'">
              <p v-if="!growthRecords.length" class="stats-dialog__empty">尚无人设微调记录。与角色私聊或完成复盘后会出现。</p>
              <article v-for="record in growthRecords" :key="record.id" class="stats-dialog__timeline">
                <em>{{ record.source === 'chat' ? '私聊' : '复盘' }} · {{ formatTimeLabel(record.createdAt) }}</em>
                <strong>{{ record.summary }}</strong>
              </article>
            </template>

            <template v-else-if="activeTab === 'behavior'">
              <p v-if="!behaviorChanges.length" class="stats-dialog__empty">尚无行为准则变更记录。</p>
              <article v-for="record in behaviorChanges" :key="record.id" class="stats-dialog__timeline">
                <em>{{ formatTimeLabel(record.createdAt) }} · {{ record.applied ? '已应用' : '待确认' }}</em>
                <strong>{{ record.summary }}</strong>
              </article>
            </template>
    </div>
  </ArenaDialogShell>
</template>

<style scoped>
.stats-dialog__body {
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

.stats-dialog__note {
  margin: 14px 0 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(112, 105, 255, 0.06);
  color: #66709d;
  font-size: 12px;
  line-height: 1.6;
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

.stats-dialog__empty {
  margin: 0;
  color: #7a85b0;
  font-size: 13px;
  line-height: 1.6;
}
</style>
