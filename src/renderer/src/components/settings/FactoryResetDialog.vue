<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AlertTriangle } from 'lucide-vue-next'
import ArenaDialogShell from '@renderer/components/common/ArenaDialogShell.vue'
import { FACTORY_RESET_PHRASE } from '@renderer/services/arena'

const props = defineProps<{
  open: boolean
  busy?: boolean
}>()

const emit = defineEmits<{
  close: []
  confirm: []
}>()

const confirmText = ref('')

watch(
  () => props.open,
  (next) => {
    if (next) confirmText.value = ''
  }
)

const canConfirm = computed(() => confirmText.value.trim() === FACTORY_RESET_PHRASE)

function submit() {
  if (!canConfirm.value || props.busy) return
  emit('confirm')
}
</script>

<template>
  <ArenaDialogShell
    :model-value="open"
    title="删除数据"
    variant="form"
    :mask-closable="false"
    show-footer
    @update:model-value="(value) => { if (!value) emit('close') }"
  >
    <div class="factory-reset-icon" aria-hidden="true">
      <AlertTriangle :size="28" />
    </div>

    <p class="factory-reset-lead">
      此操作将删除 Manong Arena 在本机的全部数据，包括角色、玩法、对局、快照、日志、玩法覆盖与设置，并退出当前登录。
    </p>

    <ul class="factory-reset-list">
      <li>所有角色与玩法配置将被永久删除</li>
      <li>对局记录、快照与操作日志将被清空</li>
      <li>应用设置将恢复为默认值</li>
      <li>登录状态与本地网关 Key 缓存将被清除</li>
      <li>下次登录将重新执行入门初始化</li>
    </ul>

    <label class="factory-reset-field">
      <span>
        请输入
        <strong>{{ FACTORY_RESET_PHRASE }}</strong>
        以确认
      </span>
      <input
        v-model="confirmText"
        type="text"
        autocomplete="off"
        spellcheck="false"
        :placeholder="FACTORY_RESET_PHRASE"
        :disabled="busy"
      />
    </label>

    <template #footer-actions>
      <button type="button" class="arena-dialog__btn" :disabled="busy" @click="emit('close')">取消</button>
      <button
        type="button"
        class="arena-dialog__btn arena-dialog__btn--danger"
        :disabled="!canConfirm || busy"
        @click="submit"
      >
        {{ busy ? '正在删除...' : '确认删除并退出登录' }}
      </button>
    </template>
  </ArenaDialogShell>
</template>

<style scoped>
.factory-reset-icon {
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  margin-bottom: 14px;
  border-radius: 16px;
  color: #dc2626;
  background: rgba(239, 68, 68, 0.1);
}

.factory-reset-lead {
  margin: 0 0 14px;
  color: #65709f;
  font-size: 14px;
  line-height: 1.7;
}

.factory-reset-list {
  margin: 0 0 18px;
  padding-left: 18px;
  color: #53619a;
  font-size: 13px;
  line-height: 1.75;
}

.factory-reset-field {
  display: grid;
  gap: 8px;
}

.factory-reset-field span {
  color: #53619a;
  font-size: 13px;
}

.factory-reset-field strong {
  color: #dc2626;
}

.factory-reset-field input {
  height: 42px;
  padding: 0 14px;
  border: 1px solid rgba(239, 68, 68, 0.22);
  border-radius: 12px;
  color: #17205a;
  background: rgba(255, 255, 255, 0.92);
  font: inherit;
}

.factory-reset-field input:focus {
  outline: 3px solid rgba(239, 68, 68, 0.14);
  border-color: rgba(239, 68, 68, 0.42);
}
</style>
