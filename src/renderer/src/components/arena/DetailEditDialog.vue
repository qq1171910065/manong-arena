<script setup lang="ts">
import { Loader2, X } from 'lucide-vue-next'

const show = defineModel<boolean>({ default: false })

defineProps<{
  title: string
  subtitle?: string
  saving?: boolean
  saveLabel?: string
  layout?: 'default' | 'wide'
}>()

const emit = defineEmits<{
  save: []
  close: []
}>()

function close() {
  show.value = false
  emit('close')
}

function save() {
  emit('save')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="detail-edit-fade">
      <div v-if="show" class="detail-edit-overlay" @click.self="close">
        <section
          class="detail-edit-dialog"
          :class="{ 'detail-edit-dialog--wide': layout === 'wide' }"
          role="dialog"
          :aria-label="title"
        >
          <header class="detail-edit-header">
            <div>
              <span v-if="subtitle">{{ subtitle }}</span>
              <strong>{{ title }}</strong>
            </div>
            <button type="button" title="关闭" @click="close"><X :size="18" /></button>
          </header>

          <div class="detail-edit-body">
            <slot />
          </div>

          <footer class="detail-edit-footer">
            <slot name="footer-left" />
            <div class="detail-edit-actions">
              <button type="button" @click="close">取消</button>
              <button class="primary" type="button" :disabled="saving" @click="save">
                <span class="detail-edit-save-label">
                  <Loader2 v-show="saving" :size="16" class="spin" />
                  {{ saving ? '保存中…' : saveLabel || '保存' }}
                </span>
              </button>
            </div>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.detail-edit-overlay {
  position: fixed;
  inset: 0;
  z-index: 1300;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(15, 18, 42, 0.42);
  backdrop-filter: blur(6px);
}

.detail-edit-dialog {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(560px, 100%);
  max-height: min(82vh, 760px);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.78);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 32px 80px rgba(50, 56, 120, 0.22);
  overflow: hidden;
}

.detail-edit-dialog--wide {
  width: min(960px, calc(100vw - 48px));
  max-height: min(86vh, 720px);
  min-height: min(86vh, 560px);
}

.detail-edit-dialog--wide .detail-edit-body {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  overflow: hidden;
  padding: 14px 18px 16px;
  min-height: 0;
}

.detail-edit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid rgba(130, 142, 207, 0.12);
}

.detail-edit-header span {
  display: block;
  color: #7b61ff;
  font-size: 12px;
  font-weight: 700;
}

.detail-edit-header strong {
  display: block;
  margin-top: 3px;
  color: #171145;
  font-size: 20px;
}

.detail-edit-header button {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.78);
  cursor: pointer;
  color: #4c4776;
}

.detail-edit-body {
  overflow: auto;
  padding: 16px 18px;
  scrollbar-width: thin;
}

.detail-edit-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-top: 1px solid rgba(130, 142, 207, 0.12);
}

.detail-edit-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.detail-edit-actions button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border: 1px solid rgba(130, 142, 207, 0.15);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.58);
  color: #26305e;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.detail-edit-actions .primary {
  color: #fff;
  border-color: transparent;
  background: linear-gradient(180deg, #7774ff, #5b57f3);
}

.detail-edit-save-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.detail-edit-fade-enter-active,
.detail-edit-fade-leave-active {
  transition: opacity 0.18s ease;
}

.detail-edit-fade-enter-active .detail-edit-dialog,
.detail-edit-fade-leave-active .detail-edit-dialog {
  transition: transform 0.2s ease, opacity 0.18s ease;
}

.detail-edit-fade-enter-from,
.detail-edit-fade-leave-to {
  opacity: 0;
}

.detail-edit-fade-enter-from .detail-edit-dialog,
.detail-edit-fade-leave-to .detail-edit-dialog {
  transform: translateY(10px) scale(0.97);
  opacity: 0;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
