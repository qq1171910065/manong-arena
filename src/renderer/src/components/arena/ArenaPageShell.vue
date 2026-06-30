<script setup lang="ts">
defineProps<{
  padded?: boolean
  /** 锁定视口高度，仅内容列内部滚动（详情/编辑页） */
  viewportLock?: boolean
  /** 列表页：随外层 shell 整体滚动，避免内容被内嵌区域裁切 */
  flowScroll?: boolean
}>()
</script>

<template>
  <div
    class="aa-subpage"
    :class="{
      'aa-subpage--viewport-lock': viewportLock && !$props.flowScroll,
      'aa-subpage--flow-scroll': flowScroll,
    }"
  >
    <div class="aa-page-scroll">
      <div class="aa-page-inner" :class="{ 'aa-page-inner--padded': padded !== false }">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.aa-subpage {
  width: 100%;
  min-height: 100%;
  overflow: visible;
  display: flex;
  flex-direction: column;
}

.aa-subpage--viewport-lock {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

.aa-subpage--viewport-lock .aa-page-scroll {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.aa-subpage--viewport-lock .aa-page-inner {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.aa-subpage--flow-scroll {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.aa-subpage--flow-scroll .aa-page-scroll,
.aa-subpage--flow-scroll .aa-page-inner {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.aa-page-scroll {
  flex: 1 0 auto;
  overflow: visible;
}

.aa-page-inner {
  width: 100%;
  min-height: 100%;
  box-sizing: border-box;
}
</style>
