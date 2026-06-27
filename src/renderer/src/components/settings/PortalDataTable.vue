<script setup lang="ts">
import { NDataTable } from '../../ui'
</script>

<template>
  <div class="portal-data-table-wrap">
    <NDataTable class="portal-data-table" v-bind="$attrs" :bordered="false" size="small" />
  </div>
</template>
