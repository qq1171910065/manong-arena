<script setup lang="ts">

import ProfileSectionHeader from './ProfileSectionHeader.vue'



defineProps<{

  title?: string

  desc?: string

}>()

</script>



<template>

  <div class="profile-section">

    <ProfileSectionHeader v-if="title" :title="title" :desc="desc">

      <template v-if="$slots.actions" #actions>

        <slot name="actions" />

      </template>

    </ProfileSectionHeader>

    <div class="profile-section__body">

      <slot />

    </div>

  </div>

</template>

