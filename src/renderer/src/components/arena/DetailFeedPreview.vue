<script setup lang="ts">
export type DetailFeedItem = {
  id: string
  label?: string
  title?: string
  text: string
  time?: string
}

withDefaults(
  defineProps<{
    items: DetailFeedItem[]
    moreCount?: number
    loading?: boolean
    loadingLabel?: string
    clamp?: number
  }>(),
  {
    clamp: 2,
  }
)
</script>

<template>
  <div class="detail-feed">
    <p v-if="loading" class="detail-feed__loading">{{ loadingLabel || '加载中…' }}</p>
    <ul v-else-if="items.length" class="detail-feed__list">
      <li v-for="item in items" :key="item.id" class="detail-feed__item">
        <header v-if="item.label || item.time" class="detail-feed__meta">
          <span v-if="item.label" class="detail-feed__label">{{ item.label }}</span>
          <time v-if="item.time">{{ item.time }}</time>
        </header>
        <strong v-if="item.title" class="detail-feed__title">{{ item.title }}</strong>
        <p
          class="detail-feed__text"
          :class="{ 'detail-feed__text--clamp': clamp > 0 }"
          :style="clamp > 0 ? { WebkitLineClamp: String(clamp) } : undefined"
        >
          {{ item.text }}
        </p>
      </li>
    </ul>
    <p v-if="!loading && moreCount" class="detail-feed__more">还有 {{ moreCount }} 项</p>
  </div>
</template>

<style scoped>
.detail-feed {
  display: grid;
  gap: 8px;
  min-height: 72px;
  align-content: start;
}

.detail-feed__loading {
  margin: 0;
  padding: 16px 0;
  color: #9aa3c7;
  font-size: 12px;
  text-align: center;
}

.detail-feed__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.detail-feed__item {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(130, 142, 207, 0.1);
}

.detail-feed__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.detail-feed__label {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(112, 105, 255, 0.1);
  color: #5b57f3;
  font-size: 10px;
  font-weight: 650;
}

.detail-feed__meta time {
  color: #9aa3c7;
  font-size: 10px;
  white-space: nowrap;
}

.detail-feed__title {
  display: block;
  margin-bottom: 4px;
  color: #17205a;
  font-size: 12px;
  font-weight: 650;
  line-height: 1.35;
}

.detail-feed__text {
  margin: 0;
  color: #59649b;
  font-size: 12px;
  line-height: 1.55;
}

.detail-feed__text--clamp {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.detail-feed__more {
  margin: 0;
  color: #9aa3c7;
  font-size: 11px;
}
</style>
