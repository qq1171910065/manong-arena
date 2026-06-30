<script setup lang="ts">
import { computed } from 'vue'
import { AlertTriangle, Info, X } from 'lucide-vue-next'
import { resolveAppDialog, useAppDialogState } from '@renderer/composables/useAppDialog'

const state = useAppDialogState()

const iconComponent = computed(() => {
  if (state.tone === 'warning' || state.tone === 'danger') return AlertTriangle
  return Info
})

const iconClass = computed(() => {
  if (state.tone === 'danger') return 'app-dialog-icon app-dialog-icon--danger'
  if (state.tone === 'warning') return 'app-dialog-icon app-dialog-icon--warning'
  return 'app-dialog-icon app-dialog-icon--default'
})

function dismiss() {
  if (state.mode === 'choose') {
    resolveAppDialog({ choice: null, remember: state.rememberChecked })
    return
  }
  resolveAppDialog(false)
}

function confirm() {
  resolveAppDialog(true)
}

function choose(id: string) {
  resolveAppDialog({ choice: id, remember: state.rememberChecked })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="state.open" class="app-dialog-overlay" @click.self="dismiss">
      <section
        class="app-dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="state.title ? 'app-dialog-title' : undefined"
      >
        <button type="button" class="app-dialog-close" aria-label="关闭" @click="dismiss">
          <X :size="18" />
        </button>

        <div :class="iconClass" aria-hidden="true">
          <component :is="iconComponent" :size="26" />
        </div>

        <h2 v-if="state.title" id="app-dialog-title">{{ state.title }}</h2>
        <p class="app-dialog-message">{{ state.message }}</p>
        <p v-if="state.detail" class="app-dialog-detail">{{ state.detail }}</p>
        <component :is="state.content" v-if="state.content" />

        <label v-if="state.mode === 'choose' && state.rememberLabel" class="app-dialog-remember">
          <input v-model="state.rememberChecked" type="checkbox" />
          <span>{{ state.rememberLabel }}</span>
        </label>

        <div
          v-if="state.mode === 'choose'"
          :class="[
            'app-dialog-actions',
            state.actionsLayout === 'row' ? 'app-dialog-actions--row' : 'app-dialog-actions--stack',
          ]"
        >
          <button
            v-for="choice in state.choices"
            :key="choice.id"
            type="button"
            :class="[
              'app-dialog-btn',
              choice.variant === 'primary'
                ? 'app-dialog-btn--primary'
                : choice.variant === 'danger'
                  ? 'app-dialog-btn--danger'
                  : 'app-dialog-btn--muted',
            ]"
            @click="choose(choice.id)"
          >
            {{ choice.label }}
          </button>
        </div>

        <div v-else class="app-dialog-actions">
          <button v-if="state.cancelText" type="button" class="app-dialog-btn app-dialog-btn--muted" @click="dismiss">
            {{ state.cancelText }}
          </button>
          <button
            type="button"
            :class="[
              'app-dialog-btn',
              state.tone === 'danger'
                ? 'app-dialog-btn--danger'
                : state.tone === 'warning'
                  ? 'app-dialog-btn--warning'
                  : 'app-dialog-btn--primary',
            ]"
            @click="confirm"
          >
            {{ state.confirmText }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.app-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 1400;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(18, 24, 58, 0.42);
  backdrop-filter: blur(8px);
}

.app-dialog {
  position: relative;
  width: min(520px, 100%);
  max-height: min(80vh, 720px);
  overflow: auto;
  padding: 28px 28px 24px;
  border: 1px solid rgba(255, 255, 255, 0.82);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 28px 64px rgba(53, 45, 110, 0.22);
}

.app-dialog-close {
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

.app-dialog-icon {
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  margin-bottom: 14px;
  border-radius: 16px;
}

.app-dialog-icon--default {
  color: #4f46e5;
  background: rgba(99, 102, 241, 0.12);
}

.app-dialog-icon--warning {
  color: #d97706;
  background: rgba(245, 158, 11, 0.12);
}

.app-dialog-icon--danger {
  color: #dc2626;
  background: rgba(239, 68, 68, 0.1);
}

.app-dialog h2 {
  margin: 0 0 8px;
  color: #17205a;
  font-size: 22px;
  font-weight: 680;
}

.app-dialog-message {
  margin: 0;
  color: #17205a;
  font-size: 15px;
  line-height: 1.7;
  white-space: pre-wrap;
}

.app-dialog-detail {
  margin: 10px 0 0;
  color: #65709f;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
}

.app-dialog-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 22px;
}

.app-dialog-actions--stack {
  flex-direction: column;
  align-items: stretch;
}

.app-dialog-actions--row {
  flex-direction: row;
}

.app-dialog-actions--row .app-dialog-btn {
  flex: 1;
}

.app-dialog-remember {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 18px;
  color: #53619a;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
}

.app-dialog-remember input {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: #4f46e5;
  cursor: pointer;
}

.app-dialog-btn {
  min-height: 40px;
  padding: 0 16px;
  border: 0;
  border-radius: 11px;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

.app-dialog-btn--muted {
  color: #53619a;
  background: rgba(130, 142, 207, 0.12);
}

.app-dialog-btn--primary {
  color: #fff;
  background: linear-gradient(180deg, #6366f1, #4f46e5);
}

.app-dialog-btn--warning {
  color: #fff;
  background: linear-gradient(180deg, #f59e0b, #d97706);
}

.app-dialog-btn--danger {
  color: #fff;
  background: linear-gradient(180deg, #ef4444, #dc2626);
}
</style>
