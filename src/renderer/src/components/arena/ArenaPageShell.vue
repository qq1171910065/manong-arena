<script setup lang="ts">
defineProps<{
  padded?: boolean
}>()
</script>

<template>
  <div class="aa-subpage">
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
  height: 100%;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.aa-page-scroll {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.aa-page-inner {
  width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  overflow: hidden;
}

.aa-page-inner--padded {
  padding-top: 0;
  padding-bottom: 0;
}
</style>
