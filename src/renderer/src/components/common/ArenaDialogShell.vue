<script setup lang="ts">
import { computed } from 'vue'
import { X } from 'lucide-vue-next'

export type ArenaDialogVariant = 'form' | 'preview'
export type ArenaDialogSize = 'md' | 'lg' | 'xl' | 'full'

const show = defineModel<boolean>({ default: false })

const props = withDefaults(
  defineProps<{
    title: string
    variant?: ArenaDialogVariant
    size?: ArenaDialogSize
    maskClosable?: boolean
    showFooter?: boolean
    showHeaderClose?: boolean
    zIndex?: number
    height?: string
    bodyClass?: string
    bodyFlush?: boolean
    subtitle?: string
    footerStack?: boolean
  }>(),
  {
    variant: 'preview',
    size: 'md',
    showFooter: false,
    showHeaderClose: false,
    zIndex: 1200,
    bodyFlush: false,
    footerStack: false,
  },
)

const emit = defineEmits<{
  close: []
}>()

const canCloseOnMask = computed(() => props.maskClosable ?? props.variant === 'preview')

const dialogClass = computed(() => {
  const classes = ['arena-dialog']
  if (props.variant === 'form') {
    classes.push('arena-dialog--form')
  } else {
    classes.push(`arena-dialog--preview-${props.size}`)
  }
  if (!props.showFooter) {
    classes.push('arena-dialog--no-footer')
  }
  if (props.height) {
    classes.push('arena-dialog--fixed-height')
  }
  return classes
})

const overlayStyle = computed(() => ({
  '--arena-dialog-z': String(props.zIndex),
  ...(props.height ? { '--arena-dialog-height': props.height } : {}),
}))

function close() {
  show.value = false
  emit('close')
}

function onMaskClick() {
  if (!canCloseOnMask.value) return
  close()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="arena-dialog-fade">
      <div v-if="show" class="arena-dialog-overlay" :style="overlayStyle" @click.self="onMaskClick">
        <section
          :class="dialogClass"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
        >
          <header class="arena-dialog__head" :class="{ 'arena-dialog__head--with-close': showHeaderClose }">
            <h2 class="arena-dialog__title">{{ title }}</h2>
            <button
              v-if="showHeaderClose"
              type="button"
              class="arena-dialog__head-close"
              aria-label="关闭"
              @click="close"
            >
              <X :size="18" />
            </button>
          </header>

          <div
            class="arena-dialog__body"
            :class="[bodyClass, { 'arena-dialog__body--flush': bodyFlush }]"
          >
            <p v-if="subtitle" class="arena-dialog__subtitle">{{ subtitle }}</p>
            <slot />
          </div>

          <footer v-if="showFooter" class="arena-dialog__foot" :class="{ 'arena-dialog__foot--stack': footerStack }">
            <slot name="footer">
              <slot name="footer-left" />
              <div class="arena-dialog__actions">
                <slot name="footer-actions">
                  <button type="button" class="arena-dialog__btn" @click="close">关闭</button>
                </slot>
              </div>
            </slot>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
