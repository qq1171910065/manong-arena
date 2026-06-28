<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AlertTriangle, X } from 'lucide-vue-next'
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
  <Teleport to="body">
    <div v-if="open" class="factory-reset-overlay" @click.self="emit('close')">
      <section class="factory-reset-dialog" role="dialog" aria-modal="true" aria-labelledby="factory-reset-title">
        <button type="button" class="factory-reset-close" aria-label="关闭" :disabled="busy" @click="emit('close')">
          <X :size="18" />
        </button>

        <div class="factory-reset-icon" aria-hidden="true">
          <AlertTriangle :size="28" />
        </div>

        <h2 id="factory-reset-title">删除数据</h2>
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

        <div class="factory-reset-actions">
          <button type="button" class="btn-muted" :disabled="busy" @click="emit('close')">取消</button>
          <button type="button" class="btn-danger" :disabled="!canConfirm || busy" @click="submit">
            {{ busy ? '正在删除...' : '确认删除并退出登录' }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.factory-reset-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(18, 24, 58, 0.42);
  backdrop-filter: blur(8px);
}

.factory-reset-dialog {
  position: relative;
  width: min(520px, 100%);
  padding: 28px 28px 24px;
  border: 1px solid rgba(255, 255, 255, 0.82);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 28px 64px rgba(53, 45, 110, 0.22);
}

.factory-reset-close {
  position: absolute;
  top: 14px;
  right: 14px;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 10px;
  color: #65709f;
  background: rgba(130, 142, 207, 0.1);
  cursor: pointer;
}

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

.factory-reset-dialog h2 {
  margin: 0 0 8px;
  color: #17205a;
  font-size: 22px;
  font-weight: 680;
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
  margin-bottom: 18px;
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

.factory-reset-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn-muted,
.btn-danger {
  height: 40px;
  padding: 0 16px;
  border: 0;
  border-radius: 11px;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

.btn-muted {
  color: #53619a;
  background: rgba(130, 142, 207, 0.12);
}

.btn-danger {
  color: #fff;
  background: linear-gradient(180deg, #ef4444, #dc2626);
}

.btn-danger:disabled,
.btn-muted:disabled,
.factory-reset-close:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
