<script setup lang="ts">
import { computed } from 'vue'
import type { HomeCharacterActivity } from '@renderer/services/arena/home-mapper'

const props = defineProps<{
  items: HomeCharacterActivity[]
}>()

const emit = defineEmits<{
  select: [activity: HomeCharacterActivity]
}>()

const scrollDuration = computed(() => {
  const count = props.items.length
  if (count <= 3) return `${Math.max(count * 5, 18)}s`
  return `${Math.min(Math.max(count * 3.2, 24), 72)}s`
})

const canScroll = computed(() => props.items.length > 2)
</script>

<template>
  <div class="activity-ticker" :class="{ 'activity-ticker--static': !canScroll }">
    <div
      class="activity-ticker__track"
      :style="canScroll ? { '--scroll-duration': scrollDuration } : undefined"
    >
      <ul class="activity-ticker__list">
        <li v-for="activity in items" :key="activity.id">
          <button
            type="button"
            class="activity-ticker__item"
            :class="{ 'activity-ticker__item--static': !activity.clickable }"
            @click="emit('select', activity)"
          >
            <img class="activity-ticker__avatar" :src="activity.avatar" :alt="activity.characterName" />
            <span class="activity-ticker__body">
              <span class="activity-ticker__row">
                <strong>{{ activity.characterName }}</strong>
                <span v-if="activity.kindLabel" class="activity-ticker__tag">{{ activity.kindLabel }}</span>
              </span>
              <span class="activity-ticker__title">{{ activity.title }}</span>
            </span>
            <time>{{ activity.timeLabel }}</time>
          </button>
        </li>
      </ul>
      <ul v-if="canScroll" class="activity-ticker__list" aria-hidden="true">
        <li v-for="activity in items" :key="`dup-${activity.id}`">
          <button
            type="button"
            class="activity-ticker__item"
            :class="{ 'activity-ticker__item--static': !activity.clickable }"
            tabindex="-1"
            @click="emit('select', activity)"
          >
            <img class="activity-ticker__avatar" :src="activity.avatar" :alt="activity.characterName" />
            <span class="activity-ticker__body">
              <span class="activity-ticker__row">
                <strong>{{ activity.characterName }}</strong>
                <span v-if="activity.kindLabel" class="activity-ticker__tag">{{ activity.kindLabel }}</span>
              </span>
              <span class="activity-ticker__title">{{ activity.title }}</span>
            </span>
            <time>{{ activity.timeLabel }}</time>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.activity-ticker {
  position: relative;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  mask-image: linear-gradient(
    180deg,
    transparent 0%,
    #000 10%,
    #000 90%,
    transparent 100%
  );
  -webkit-mask-image: linear-gradient(
    180deg,
    transparent 0%,
    #000 10%,
    #000 90%,
    transparent 100%
  );
}

.activity-ticker--static {
  mask-image: none;
  -webkit-mask-image: none;
}

.activity-ticker__track {
  display: grid;
  gap: 0;
  animation: activityTickerScroll var(--scroll-duration, 36s) linear infinite;
  will-change: transform;
}

.activity-ticker--static .activity-ticker__track {
  animation: none;
}

.activity-ticker:hover .activity-ticker__track {
  animation-play-state: paused;
}

.activity-ticker__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0;
}

.activity-ticker__item {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 46px;
  padding: 8px 4px;
  border: 0;
  border-bottom: 1px solid rgba(132, 142, 204, 0.1);
  border-radius: 10px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.16s ease, transform 0.16s ease;
}

.activity-ticker__list li:last-child .activity-ticker__item {
  border-bottom: 0;
}

.activity-ticker__item--static {
  cursor: default;
}

.activity-ticker__item:not(.activity-ticker__item--static):hover {
  background: rgba(255, 255, 255, 0.48);
}

.activity-ticker__avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  background: #fff;
  box-shadow: 0 2px 8px rgba(91, 101, 174, 0.12);
}

.activity-ticker__body {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.activity-ticker__row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.activity-ticker__row strong {
  overflow: hidden;
  color: #17205a;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-ticker__tag {
  flex: 0 0 auto;
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(112, 105, 255, 0.1);
  color: #5b57f3;
  font-size: 10px;
  font-weight: 650;
  line-height: 1.4;
}

.activity-ticker__title {
  overflow: hidden;
  color: #6973a1;
  font-size: 12px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-ticker__item time {
  flex: 0 0 auto;
  color: #8a94bd;
  font-size: 11px;
  white-space: nowrap;
}

@keyframes activityTickerScroll {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(-50%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .activity-ticker__track {
    animation: none;
  }
}
</style>
