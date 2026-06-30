<script setup lang="ts">
import { computed } from 'vue'
import { Sparkles } from 'lucide-vue-next'
import {
  computeAttributeDeltas,
  computeCharacterAttributes,
  computePersonalitySkills,
  computeStarRating,
  expRequiredForLevel,
  nextGrowthCompareLevel,
  projectCharacterAtLevel,
  resolveCharacterGrowth,
  TALENT_TIER_LABELS,
  TALENT_TIER_UNLOCK_LEVELS,
} from '@shared/arena/character-growth'
import { MATCH_SKILL_PHASE_LABELS } from '@shared/arena/character-agent'
import { normalizeCharacterAttributes } from '@shared/arena/character-model-params'
import type { Character, CharacterGrowthSnapshot } from '@shared/arena/types'
import CharacterAttributesRadar from './CharacterAttributesRadar.vue'

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
const expToNext = computed(() => Math.max(0, expMax.value - growth.value.exp))

const compareLevel = computed(() => nextGrowthCompareLevel(growth.value.level))
const compareProjection = computed(() => projectCharacterAtLevel(props.character, compareLevel.value))
const compareAttributes = computed(() =>
  compareLevel.value > growth.value.level ? compareProjection.value.attributes : null
)
const compareLabel = computed(() => {
  if (!compareAttributes.value) return ''
  const tierIndex = TALENT_TIER_UNLOCK_LEVELS.indexOf(
    compareLevel.value as (typeof TALENT_TIER_UNLOCK_LEVELS)[number]
  )
  if (tierIndex >= 0) return `${TALENT_TIER_LABELS[tierIndex]} Lv.${compareLevel.value}`
  return `Lv.${compareLevel.value}`
})

const sortedSnapshots = computed(() =>
  [...props.snapshots].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
)

const previousSnapshot = computed(() => {
  const items = sortedSnapshots.value
  return items.length > 1 ? items[items.length - 2] : null
})

const snapshotDeltas = computed(() => {
  if (!previousSnapshot.value) return {}
  return computeAttributeDeltas(
    normalizeCharacterAttributes(previousSnapshot.value.attributes),
    attributes.value
  )
})

const radarHint = computed(() => {
  if (!compareAttributes.value) return '五项属性映射为温度、上下文窗口、提示约束等网关推理参数'
  return `实线为当前 Lv.${growth.value.level}，虚线外圈为 ${compareLabel.value} 属性预览`
})

function phaseLabels(phases: string[]): string {
  return phases.map((p) => MATCH_SKILL_PHASE_LABELS[p as keyof typeof MATCH_SKILL_PHASE_LABELS] || p).join('·')
}
</script>

<template>
  <section class="growth-overview">
    <article class="growth-level-card">
      <div class="growth-level-card__identity">
        <span class="growth-level-card__badge">Lv.{{ growth.level }}</span>
        <div class="growth-stars" :aria-label="`${starRating} 星成熟度`">
          <Sparkles v-for="index in starRating" :key="index" :size="12" class="on" />
        </div>
      </div>
      <div class="growth-level-card__exp">
        <div class="growth-level-card__exp-row">
          <span>累计 {{ growth.totalExp }} EXP · 距下一级 {{ expToNext }}</span>
          <em>{{ growth.exp }}/{{ expMax }}</em>
        </div>
        <div class="growth-level-card__bar" aria-hidden="true">
          <i :style="{ width: `${expPercent}%` }" />
        </div>
      </div>
    </article>

    <div class="growth-grid">
      <article class="growth-panel growth-panel--radar">
        <div class="growth-panel__intro">
          <h3>调参属性</h3>
          <p>{{ radarHint }}</p>
        </div>
        <CharacterAttributesRadar
          :attributes="attributes"
          :compare-attributes="compareAttributes"
          :compare-label="compareLabel"
          :deltas="snapshotDeltas"
        />
      </article>

      <article class="growth-panel growth-panel--skills">
        <header class="growth-panel__head">
          <h3>角色天赋</h3>
          <span>{{ skills.filter((s) => s.level > 0).length }}/{{ skills.length }}</span>
        </header>
        <div class="skill-grid">
          <div
            v-for="(skill, index) in skills"
            :key="skill.id"
            class="skill-card"
            :class="{ locked: skill.level <= 0 }"
          >
            <div class="skill-card__top">
              <strong>{{ skill.name }}</strong>
              <span v-if="skill.level > 0">Lv.{{ skill.level }}</span>
              <span v-else class="muted">{{ TALENT_TIER_LABELS[index] }} · Lv.{{ skill.unlockLevel }}</span>
            </div>
            <dl v-if="skill.level > 0" class="skill-card__meta">
              <div>
                <dt>时机</dt>
                <dd>{{ skill.triggerTiming }}</dd>
              </div>
              <div>
                <dt>效果</dt>
                <dd>{{ skill.triggerEffect }}</dd>
              </div>
              <div>
                <dt>对局</dt>
                <dd>{{ skill.matchEffect }}</dd>
              </div>
              <div>
                <dt>阶段</dt>
                <dd>{{ phaseLabels(skill.matchPhases) }}</dd>
              </div>
            </dl>
            <p v-else class="skill-card__locked">{{ skill.description }}</p>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.growth-overview {
  display: grid;
  gap: 12px;
  min-height: 168px;
}

.growth-level-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  padding: 14px;
  min-height: 72px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(123, 97, 255, 0.12), rgba(255, 255, 255, 0.72));
}

.growth-level-card__identity {
  display: flex;
  align-items: center;
  gap: 10px;
}

.growth-level-card__badge {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(91, 87, 243, 0.14);
  color: #5b57f3;
  font-size: 14px;
  font-weight: 700;
}

.growth-stars {
  display: inline-flex;
  gap: 2px;
  color: rgba(130, 142, 207, 0.28);
}

.growth-stars :deep(svg.on) {
  color: #f5b942;
}

.growth-level-card__exp {
  display: grid;
  gap: 6px;
}

.growth-level-card__exp-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #66709d;
  font-size: 11px;
}

.growth-level-card__exp-row em {
  font-style: normal;
  color: #17205a;
  font-weight: 650;
}

.growth-level-card__bar {
  height: 6px;
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

.growth-grid {
  display: grid;
  grid-template-columns: minmax(240px, 0.9fr) minmax(0, 1.4fr);
  gap: 12px;
}

.growth-panel {
  padding: 14px;
  min-height: 168px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.42);
}

.growth-panel h3 {
  margin: 0;
  color: #17205a;
  font-size: 14px;
}

.growth-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.growth-panel__head span {
  color: #9aa3c7;
  font-size: 11px;
}

.growth-panel--radar h3 {
  margin-bottom: 0;
}

.growth-panel__intro {
  margin-bottom: 8px;
}

.growth-panel__intro p {
  margin: 4px 0 0;
  color: #9aa3c7;
  font-size: 11px;
  line-height: 1.45;
}

.skill-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.skill-card {
  padding: 10px;
  border-radius: 12px;
  background: rgba(112, 105, 255, 0.08);
  min-height: 88px;
}

.skill-card.locked {
  opacity: 0.55;
}

.skill-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 6px;
}

.skill-card__top strong {
  color: #4338ca;
  font-size: 12px;
}

.skill-card__top span {
  color: #5b57f3;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}

.skill-card__top span.muted {
  color: #9aa3c7;
}

.skill-card__meta {
  margin: 0;
  display: grid;
  gap: 4px;
}

.skill-card__meta div {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 4px;
  align-items: start;
}

.skill-card__meta dt {
  color: #9aa3c7;
  font-size: 10px;
  font-weight: 600;
}

.skill-card__meta dd {
  margin: 0;
  color: #59649b;
  font-size: 10px;
  line-height: 1.4;
}

.skill-card__locked {
  margin: 0;
  color: #7a85b0;
  font-size: 10px;
  line-height: 1.4;
}

@media (max-width: 980px) {
  .growth-level-card {
    grid-template-columns: 1fr;
  }

  .growth-grid {
    grid-template-columns: 1fr;
  }

  .skill-grid {
    grid-template-columns: 1fr;
  }
}
</style>
