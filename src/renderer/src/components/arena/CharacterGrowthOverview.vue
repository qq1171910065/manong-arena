<script setup lang="ts">
import { computed } from 'vue'
import { Sparkles, Star } from 'lucide-vue-next'
import {
  CHARACTER_ATTRIBUTE_LABELS,
  computeAttributeDeltas,
  computeCharacterAttributes,
  computePersonalitySkills,
  computeStarRating,
  expRequiredForLevel,
  resolveCharacterGrowth,
  type CharacterAttributeId,
} from '@shared/arena/character-growth'
import type { Character, CharacterGrowthSnapshot } from '@shared/arena/types'
import {
  formatLessonFromSnapshot,
  growthSourceLabel,
  isLessonLikeSnapshot,
} from '@shared/arena/growth-display'

const props = defineProps<{
  character: Character
  snapshots: CharacterGrowthSnapshot[]
}>()

const growth = computed(() => resolveCharacterGrowth(props.character))
const attributes = computed(() => computeCharacterAttributes(props.character))
const skills = computed(() => computePersonalitySkills(props.character))
const starRating = computed(() => computeStarRating(growth.value.level))
const expMax = computed(() => expRequiredForLevel(growth.value.level))
const expPercent = computed(() => Math.min(100, Math.round((growth.value.exp / expMax.value) * 100)))

const sortedSnapshots = computed(() =>
  [...props.snapshots].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
)

const previousSnapshot = computed(() => {
  const items = sortedSnapshots.value
  return items.length > 1 ? items[items.length - 2] : null
})

const attributeDeltas = computed(() => {
  if (!previousSnapshot.value) return {} as Partial<Record<CharacterAttributeId, number>>
  return computeAttributeDeltas(previousSnapshot.value.attributes, attributes.value)
})

const lessonLogs = computed(() =>
  [...props.snapshots]
    .filter(isLessonLikeSnapshot)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6)
)

function formatDate(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function attrBarPercent(value: number): number {
  return Math.min(100, Math.round((value / 120) * 100))
}
</script>

<template>
  <section class="growth-overview">
    <div class="growth-level-card">
      <div class="growth-level-card__top">
        <div class="growth-level-card__identity">
          <span class="growth-level-card__badge">Lv.{{ growth.level }}</span>
          <div class="growth-stars" :aria-label="`${starRating} 星成熟度`">
            <Star
              v-for="index in 7"
              :key="index"
              :size="13"
              :class="{ on: index <= starRating }"
            />
          </div>
        </div>
        <span class="growth-level-card__exp">{{ growth.exp }} / {{ expMax }} EXP</span>
      </div>
      <div class="growth-level-card__bar" aria-hidden="true">
        <i :style="{ width: `${expPercent}%` }" />
      </div>
      <p class="growth-level-card__hint">累计 {{ growth.totalExp }} EXP · 由模型输出与互动自然积累，属性随等级与人设成长</p>
    </div>

    <div class="growth-grid">
      <article class="growth-panel">
        <h3>成长属性</h3>
        <ul class="attr-list">
          <li v-for="(label, key) in CHARACTER_ATTRIBUTE_LABELS" :key="key">
            <div class="attr-list__meta">
              <span>{{ label }}</span>
              <div class="attr-list__value">
                <strong>{{ attributes[key as keyof typeof attributes] }}</strong>
                <em v-if="attributeDeltas[key as CharacterAttributeId]">
                  +{{ attributeDeltas[key as CharacterAttributeId] }}
                </em>
              </div>
            </div>
            <div class="attr-list__bar" aria-hidden="true">
              <i :style="{ width: `${attrBarPercent(attributes[key as keyof typeof attributes])}%` }" />
            </div>
          </li>
        </ul>
      </article>

      <article class="growth-panel">
        <h3>专属技能</h3>
        <p class="growth-panel__hint">性格标签与成长属性的外显，随等级解锁与提升</p>
        <div class="skill-grid">
          <div
            v-for="skill in skills"
            :key="skill.id"
            class="skill-chip"
            :class="{ locked: skill.level <= 0 }"
          >
            <div class="skill-chip__icon" aria-hidden="true">
              <Sparkles :size="16" />
            </div>
            <div class="skill-chip__body">
              <div class="skill-chip__head">
                <strong>{{ skill.name }}</strong>
                <span v-if="skill.level > 0">Lv.{{ skill.level }}</span>
                <span v-else>Lv.{{ skill.unlockLevel }} 解锁</span>
              </div>
              <em>{{ skill.description }}</em>
            </div>
          </div>
        </div>
      </article>
    </div>

    <article class="growth-panel">
      <h3>经验沉淀</h3>
      <p class="growth-panel__hint">只保留可迁移的教训与领悟，不记录场景流水</p>
      <div v-if="lessonLogs.length" class="growth-log">
        <article v-for="item in lessonLogs" :key="item.id" class="growth-log__item">
          <header>
            <span>{{ growthSourceLabel(item.source) }}</span>
            <time>{{ formatDate(item.createdAt) }}</time>
          </header>
          <p>{{ formatLessonFromSnapshot(item) }}</p>
        </article>
      </div>
      <p v-else class="growth-panel__empty">尚无沉淀。与角色私聊、完成场景复盘或行为调整后，可迁移的经验会出现在这里。</p>
    </article>
  </section>
</template>

<style scoped>
.growth-overview {
  display: grid;
  gap: 12px;
}

.growth-level-card {
  padding: 14px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(123, 97, 255, 0.12), rgba(255, 255, 255, 0.72));
}

.growth-level-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.growth-level-card__identity {
  display: flex;
  align-items: center;
  gap: 10px;
}

.growth-level-card__badge {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(91, 87, 243, 0.14);
  color: #5b57f3;
  font-size: 13px;
  font-weight: 700;
}

.growth-stars {
  display: inline-flex;
  gap: 2px;
  color: rgba(130, 142, 207, 0.28);
}

.growth-stars :deep(svg.on) {
  color: #f5b942;
  fill: rgba(245, 185, 66, 0.22);
}

.growth-level-card__exp {
  color: #59649b;
  font-size: 12px;
}

.growth-level-card__bar {
  height: 8px;
  margin-top: 10px;
  border-radius: 999px;
  background: rgba(130, 142, 207, 0.16);
  overflow: hidden;
}

.growth-level-card__bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #8b84ff, #5b57f3);
}

.growth-level-card__hint {
  margin: 8px 0 0;
  color: #9aa3c7;
  font-size: 11px;
}

.growth-grid {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 12px;
}

.growth-panel {
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.42);
}

.growth-panel h3 {
  margin: 0 0 10px;
  color: #17205a;
  font-size: 14px;
}

.growth-panel__hint,
.growth-panel__empty {
  margin: 0;
  color: #9aa3c7;
  font-size: 12px;
}

.attr-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
}

.attr-list li {
  display: grid;
  gap: 6px;
}

.attr-list__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #66709d;
  font-size: 13px;
}

.attr-list__value {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}

.attr-list strong {
  color: #17205a;
  font-size: 16px;
}

.attr-list em {
  color: #18a765;
  font-size: 11px;
  font-style: normal;
  font-weight: 600;
}

.attr-list__bar {
  height: 6px;
  border-radius: 999px;
  background: rgba(130, 142, 207, 0.12);
  overflow: hidden;
}

.attr-list__bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(139, 132, 255, 0.72), #7b61ff);
}

.skill-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.skill-chip {
  display: flex;
  gap: 10px;
  padding: 10px;
  border-radius: 14px;
  background: rgba(112, 105, 255, 0.08);
}

.skill-chip.locked {
  opacity: 0.55;
}

.skill-chip__icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.72);
  color: #7b61ff;
  flex: none;
}

.skill-chip__body {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.skill-chip__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.skill-chip strong {
  color: #4338ca;
  font-size: 13px;
}

.skill-chip span {
  color: #5b57f3;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.skill-chip em {
  color: #7a85b0;
  font-size: 11px;
  font-style: normal;
  line-height: 1.45;
}

.growth-log {
  display: grid;
  gap: 8px;
}

.growth-log__item {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.55);
}

.growth-log__item header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.growth-log__item header span {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(112, 105, 255, 0.1);
  color: #5b57f3;
  font-size: 11px;
  font-weight: 600;
}

.growth-log__item time {
  color: #9aa3c7;
  font-size: 11px;
}

.growth-log__item p {
  margin: 0;
  color: #59649b;
  font-size: 12px;
  line-height: 1.55;
}

.growth-log__delta {
  margin-top: 4px !important;
  color: #18a765 !important;
  font-weight: 600;
}

@media (max-width: 980px) {
  .growth-grid {
    grid-template-columns: 1fr;
  }
}
</style>
