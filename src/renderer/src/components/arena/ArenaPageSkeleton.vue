<script setup lang="ts">
import { computed } from 'vue'
import type { ArenaSkeletonVariant } from './skeleton-variants'

const props = withDefaults(
  defineProps<{
    variant?: ArenaSkeletonVariant
    cards?: number
    rows?: number
    label?: string
    /** 列表页顶部搜索/筛选栏骨架（页面级加载时使用） */
    toolbar?: boolean
    /** 角色库「新建」按钮占位 */
    toolbarAction?: boolean
    /** 嵌在列表页内（工具栏已在外部，仅渲染内容区骨架） */
    embedded?: boolean
  }>(),
  {
    variant: 'generic',
    cards: 8,
    rows: 6,
    label: '加载中',
    toolbar: false,
    toolbarAction: false,
    embedded: false,
  }
)

const cardItems = computed(() => Array.from({ length: props.cards }, (_, i) => i))
const rowItems = computed(() => Array.from({ length: props.rows }, (_, i) => i))
</script>

<template>
  <div class="aa-skeleton" :class="`aa-skeleton--${variant}`" role="status" :aria-label="label">
    <!-- 首页 -->
    <template v-if="variant === 'home'">
      <section class="aa-skeleton-home">
        <div class="aa-skeleton-home__hero">
          <div class="aa-skeleton-home__copy">
            <div class="aa-skel aa-skel--title aa-skel--w70" />
            <div class="aa-skel aa-skel--title aa-skel--w45" />
            <div class="aa-skel aa-skel--text aa-skel--w55" />
            <div class="aa-skeleton-home__actions">
              <div class="aa-skel aa-skel--pill aa-skel--w140" />
              <div class="aa-skel aa-skel--pill aa-skel--w120" />
            </div>
          </div>
          <div class="aa-skeleton-home__stage">
            <div v-for="i in 6" :key="i" class="aa-skeleton-home__char">
              <div class="aa-skel aa-skel--rect aa-skel--h120" />
              <div class="aa-skel aa-skel--text aa-skel--w60" />
            </div>
          </div>
        </div>
        <div class="aa-skeleton-home__panels">
          <div class="aa-skel aa-skel--panel aa-skel--h220" />
          <div class="aa-skeleton-home__activity">
            <div v-for="i in 4" :key="i" class="aa-skeleton-home__activity-row">
              <div class="aa-skel aa-skel--circle aa-skel--sm" />
              <div class="aa-skeleton-home__activity-copy">
                <div class="aa-skel aa-skel--text aa-skel--w55" />
                <div class="aa-skel aa-skel--text aa-skel--w80" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>

    <!-- 卡片网格：角色库 / 玩法场景 -->
    <template v-else-if="variant === 'grid-cards'">
      <div v-if="embedded" class="aa-skeleton-grid aa-skeleton-grid--embedded">
        <article v-for="i in cardItems" :key="i" class="aa-skeleton-card">
          <div class="aa-skel aa-skel--rect aa-skeleton-card__banner" />
          <div class="aa-skeleton-card__body">
            <div class="aa-skel aa-skel--title aa-skel--w55" />
            <div class="aa-skel aa-skel--text aa-skel--w80" />
            <div class="aa-skeleton-card__chips">
              <div class="aa-skel aa-skel--chip" />
              <div class="aa-skel aa-skel--chip aa-skel--w48" />
            </div>
            <div class="aa-skel aa-skel--text aa-skel--w65" />
          </div>
        </article>
      </div>
      <div v-else class="aa-skeleton-list-page">
        <div v-if="toolbar" class="aa-skeleton-toolbar">
          <div class="aa-skel aa-skel--search-pill" />
          <div class="aa-skeleton-toolbar__right">
            <div class="aa-skel aa-skel--filter-cluster" />
            <div v-if="toolbarAction" class="aa-skel aa-skel--action-btn" />
          </div>
        </div>
        <div class="aa-skeleton-grid">
          <article v-for="i in cardItems" :key="i" class="aa-skeleton-card">
            <div class="aa-skel aa-skel--rect aa-skeleton-card__banner" />
            <div class="aa-skeleton-card__body">
              <div class="aa-skel aa-skel--title aa-skel--w55" />
              <div class="aa-skel aa-skel--text aa-skel--w80" />
              <div class="aa-skeleton-card__chips">
                <div class="aa-skel aa-skel--chip" />
                <div class="aa-skel aa-skel--chip aa-skel--w48" />
              </div>
              <div class="aa-skel aa-skel--text aa-skel--w65" />
            </div>
          </article>
        </div>
      </div>
    </template>

    <!-- 沉浸式卡片：玩法场景 -->
    <template v-else-if="variant === 'immersive-cards'">
      <div v-if="embedded" class="aa-skeleton-grid aa-skeleton-grid--embedded">
        <article v-for="i in cardItems" :key="i" class="aa-skeleton-immersive-card">
          <div class="aa-skel aa-skel--rect aa-skeleton-immersive-card__fill" />
        </article>
      </div>
      <div v-else class="aa-skeleton-list-page">
        <div v-if="toolbar" class="aa-skeleton-toolbar">
          <div class="aa-skel aa-skel--search-pill" />
          <div class="aa-skeleton-toolbar__right">
            <div class="aa-skel aa-skel--filter-cluster" />
            <div v-if="toolbarAction" class="aa-skel aa-skel--action-btn" />
          </div>
        </div>
        <div class="aa-skeleton-grid">
          <article v-for="i in cardItems" :key="i" class="aa-skeleton-immersive-card">
            <div class="aa-skel aa-skel--rect aa-skeleton-immersive-card__fill" />
          </article>
        </div>
      </div>
    </template>

    <!-- 列表行：对局记录 -->
    <template v-else-if="variant === 'list-rows'">
      <div v-if="embedded" class="aa-skeleton-list aa-skeleton-list--embedded">
        <article v-for="i in rowItems" :key="i" class="aa-skeleton-row">
          <div class="aa-skel aa-skel--emblem" />
          <div class="aa-skeleton-row__main">
            <div class="aa-skel aa-skel--title aa-skel--w35" />
            <div class="aa-skeleton-row__avatars">
              <div v-for="j in 4" :key="j" class="aa-skel aa-skel--circle aa-skel--sm" />
            </div>
          </div>
          <div class="aa-skeleton-row__meta">
            <div class="aa-skel aa-skel--text aa-skel--w80" />
            <div class="aa-skel aa-skel--chip aa-skel--w64" />
          </div>
          <div class="aa-skel aa-skel--row-action" />
          <div class="aa-skel aa-skel--row-action aa-skel--row-action-wide" />
        </article>
      </div>
      <div v-else class="aa-skeleton-list-page">
        <div v-if="toolbar" class="aa-skeleton-toolbar">
          <div class="aa-skel aa-skel--search-pill" />
          <div class="aa-skeleton-toolbar__right">
            <div class="aa-skel aa-skel--filter-cluster" />
          </div>
        </div>
        <div class="aa-skeleton-list">
          <article v-for="i in rowItems" :key="i" class="aa-skeleton-row">
            <div class="aa-skel aa-skel--emblem" />
            <div class="aa-skeleton-row__main">
              <div class="aa-skel aa-skel--title aa-skel--w35" />
              <div class="aa-skeleton-row__avatars">
                <div v-for="j in 4" :key="j" class="aa-skel aa-skel--circle aa-skel--sm" />
              </div>
            </div>
            <div class="aa-skeleton-row__meta">
              <div class="aa-skel aa-skel--text aa-skel--w80" />
              <div class="aa-skel aa-skel--chip aa-skel--w64" />
            </div>
            <div class="aa-skel aa-skel--row-action" />
            <div class="aa-skel aa-skel--row-action aa-skel--row-action-wide" />
          </article>
        </div>
      </div>
    </template>

    <!-- 详情页：仅中间内容列骨架（不展示左右侧栏） -->
    <template v-else-if="variant === 'detail-3col'">
      <div class="aa-skeleton-detail-3">
        <main class="aa-skeleton-detail-3__main aa-skel aa-skel--panel">
          <div class="aa-skel aa-skel--text aa-skel--w30" />
          <div class="aa-skel aa-skel--title aa-skel--w50" />
          <div class="aa-skel aa-skel--rect aa-skel--h100" />
          <div class="aa-skel aa-skel--rect aa-skel--h100" />
          <div class="aa-skel aa-skel--rect aa-skel--h80" />
        </main>
      </div>
    </template>

    <!-- 双栏编辑 -->
    <template v-else-if="variant === 'edit-2col'">
      <div class="aa-skeleton-edit-2">
        <aside class="aa-skel aa-skel--panel">
          <div class="aa-skel aa-skel--rect aa-skel--h280" />
          <div class="aa-skeleton-edit-2__identity">
            <div class="aa-skel aa-skel--circle" />
            <div>
              <div class="aa-skel aa-skel--title aa-skel--w65" />
              <div class="aa-skel aa-skel--text aa-skel--w80" />
            </div>
          </div>
        </aside>
        <main class="aa-skel aa-skel--panel">
          <div class="aa-skel aa-skel--title aa-skel--w25" />
          <div v-for="i in 5" :key="i" class="aa-skeleton-edit-2__field">
            <div class="aa-skel aa-skel--text aa-skel--w20" />
            <div class="aa-skel aa-skel--rect aa-skel--h42" />
          </div>
        </main>
      </div>
    </template>

    <!-- 创建对局 -->
    <template v-else-if="variant === 'create-match'">
      <div class="aa-skeleton-create">
        <aside class="aa-skel aa-skel--panel">
          <div class="aa-skel aa-skel--rect aa-skel--h150" />
          <div class="aa-skel aa-skel--title aa-skel--w60" />
          <div class="aa-skel aa-skel--text aa-skel--w90" />
          <div v-for="i in 3" :key="i" class="aa-skel aa-skel--row-item" />
        </aside>
        <section class="aa-skel aa-skel--panel">
          <div class="aa-skel aa-skel--title aa-skel--w30" />
          <div class="aa-skeleton-create__tiles">
            <div v-for="i in 8" :key="i" class="aa-skel aa-skel--tile" />
          </div>
        </section>
        <aside class="aa-skel aa-skel--panel">
          <div class="aa-skel aa-skel--title aa-skel--w40" />
          <div v-for="i in 4" :key="i" class="aa-skel aa-skel--rect aa-skel--h56" />
          <div class="aa-skel aa-skel--pill aa-skel--w100" />
        </aside>
      </div>
    </template>

    <!-- 设置页 -->
    <template v-else-if="variant === 'settings'">
      <div class="aa-skeleton-settings">
        <aside class="aa-skel aa-skel--panel aa-skeleton-settings__nav">
          <div v-for="i in 4" :key="i" class="aa-skel aa-skel--nav-item" />
        </aside>
        <main class="aa-skel aa-skel--panel">
          <div class="aa-skel aa-skel--title aa-skel--w25" />
          <div v-for="i in 5" :key="i" class="aa-skeleton-settings__row">
            <div>
              <div class="aa-skel aa-skel--text aa-skel--w40" />
              <div class="aa-skel aa-skel--text aa-skel--w60" />
            </div>
            <div class="aa-skel aa-skel--pill aa-skel--w72" />
          </div>
        </main>
      </div>
    </template>

    <!-- 对局详情 -->
    <template v-else-if="variant === 'match-detail'">
      <div class="aa-skeleton-match-detail">
        <div class="aa-skel aa-skel--panel aa-skeleton-match-detail__hero">
          <div class="aa-skel aa-skel--square" />
          <div>
            <div class="aa-skel aa-skel--title aa-skel--w45" />
            <div class="aa-skel aa-skel--text aa-skel--w70" />
          </div>
        </div>
        <div class="aa-skeleton-match-detail__tabs">
          <div v-for="i in 3" :key="i" class="aa-skel aa-skel--pill aa-skel--w88" />
        </div>
        <div class="aa-skel aa-skel--panel aa-skel--h240" />
        <div class="aa-skel aa-skel--panel aa-skel--h120" />
      </div>
    </template>

    <!-- 对局房间 -->
    <template v-else-if="variant === 'match-room'">
      <div class="aa-skeleton-room">
        <aside class="aa-skel aa-skel--panel">
          <div class="aa-skel aa-skel--chip aa-skel--w100" />
          <div v-for="i in 6" :key="i" class="aa-skel aa-skel--row-item" />
        </aside>
        <section class="aa-skel aa-skel--panel">
          <div v-for="i in 4" :key="i" class="aa-skeleton-room__bubble">
            <div class="aa-skel aa-skel--circle aa-skel--sm" />
            <div class="aa-skel aa-skel--rect aa-skel--h72" />
          </div>
        </section>
      </div>
    </template>

    <!-- 通用 -->
    <template v-else>
      <div class="aa-skeleton-generic">
        <div class="aa-skel aa-skel--title aa-skel--w35" />
        <div class="aa-skel aa-skel--text aa-skel--w55" />
        <div class="aa-skel aa-skel--panel aa-skel--h180" />
        <div class="aa-skel aa-skel--panel aa-skel--h120" />
      </div>
    </template>
  </div>
</template>
