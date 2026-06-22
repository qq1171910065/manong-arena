<script setup lang="ts">

import { onMounted, onUnmounted, ref } from 'vue'

import { Copy, Edit3, MoreHorizontal, Power, Trash2 } from 'lucide-vue-next'

import type { CharacterStatus } from '@shared/arena/types'



const props = defineProps<{

  status: CharacterStatus

  compact?: boolean

}>()



const emit = defineEmits<{

  edit: []

  duplicate: []

  toggleStatus: []

  remove: []

}>()



const open = ref(false)

const rootRef = ref<HTMLElement | null>(null)



function toggleMenu(event: Event) {

  event.stopPropagation()

  open.value = !open.value

}



function closeMenu() {

  open.value = false

}



function run(action: 'edit' | 'duplicate' | 'toggleStatus' | 'remove') {

  closeMenu()

  emit(action)

}



function onDocumentClick(event: MouseEvent) {

  if (!open.value) return

  const target = event.target as Node | null

  if (rootRef.value && target && !rootRef.value.contains(target)) {

    closeMenu()

  }

}



onMounted(() => {

  document.addEventListener('click', onDocumentClick)

})



onUnmounted(() => {

  document.removeEventListener('click', onDocumentClick)

})

</script>



<template>

  <div ref="rootRef" class="char-menu" :class="{ 'char-menu--compact': compact }">

    <button type="button" class="char-menu__trigger" aria-label="更多操作" @click="toggleMenu">

      <MoreHorizontal :size="compact ? 18 : 20" />

    </button>

    <div v-if="open" class="char-menu__panel" @click.stop>

      <button type="button" @click="run('edit')"><Edit3 :size="15" /> 编辑角色</button>

      <button type="button" @click="run('duplicate')"><Copy :size="15" /> 复制角色</button>

      <button type="button" @click="run('toggleStatus')">

        <Power :size="15" />

        {{ status === 'enabled' ? '停用角色' : '启用角色' }}

      </button>

      <button type="button" class="danger" @click="run('remove')"><Trash2 :size="15" /> 删除角色</button>

    </div>

  </div>

</template>



<style scoped>

.char-menu {

  position: relative;

}



.char-menu__trigger {

  display: grid;

  place-items: center;

  width: 30px;

  height: 30px;

  border: 0;

  border-radius: 9px;

  background: rgba(255, 255, 255, 0.38);

  color: #66709d;

  cursor: pointer;

}



.char-menu--compact .char-menu__trigger {

  background: transparent;

}



.char-menu__panel {

  position: absolute;

  right: 0;

  bottom: calc(100% + 8px);

  z-index: 20;

  min-width: 148px;

  padding: 6px;

  border: 1px solid rgba(130, 142, 207, 0.18);

  border-radius: 12px;

  background: rgba(255, 255, 255, 0.96);

  box-shadow: 0 16px 36px rgba(82, 91, 168, 0.18);

  backdrop-filter: blur(16px);

}



.char-menu__panel button {

  display: flex;

  align-items: center;

  gap: 8px;

  width: 100%;

  padding: 9px 10px;

  border: 0;

  border-radius: 8px;

  background: transparent;

  color: #26305e;

  font: inherit;

  font-size: 13px;

  text-align: left;

  cursor: pointer;

}



.char-menu__panel button:hover {

  background: rgba(99, 102, 241, 0.08);

  color: #4f46e5;

}



.char-menu__panel button.danger:hover {

  background: rgba(239, 68, 68, 0.08);

  color: #dc2626;

}

</style>


