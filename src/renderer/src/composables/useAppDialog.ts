import { reactive, type VNode } from 'vue'

export type AppDialogTone = 'default' | 'warning' | 'danger'

export interface AppDialogChoice {
  id: string
  label: string
  variant?: 'default' | 'primary' | 'danger'
}

export interface AppDialogConfirmOptions {
  title?: string
  message: string
  detail?: string
  confirmText?: string
  cancelText?: string
  tone?: AppDialogTone
  content?: () => VNode
}

export interface AppDialogChooseOptions extends Omit<AppDialogConfirmOptions, 'confirmText' | 'cancelText'> {
  choices: AppDialogChoice[]
  /** 按钮横向排列（默认纵向堆叠） */
  actionsLayout?: 'stack' | 'row'
  /** 显示「记住选择」勾选框 */
  rememberLabel?: string
}

export interface AppDialogChooseResult {
  choice: string | null
  remember: boolean
}

interface AppDialogState {
  open: boolean
  title: string
  message: string
  detail: string
  tone: AppDialogTone
  confirmText: string
  cancelText: string
  mode: 'confirm' | 'choose'
  choices: AppDialogChoice[]
  content: (() => VNode) | null
  actionsLayout: 'stack' | 'row'
  rememberLabel: string
  rememberChecked: boolean
}

const state = reactive<AppDialogState>({
  open: false,
  title: '',
  message: '',
  detail: '',
  tone: 'default',
  confirmText: '确定',
  cancelText: '取消',
  mode: 'confirm',
  choices: [],
  content: null,
  actionsLayout: 'stack',
  rememberLabel: '',
  rememberChecked: false,
})

let pendingResolve: ((value: unknown) => void) | null = null

function normalizeConfirmOptions(options: AppDialogConfirmOptions | string): AppDialogConfirmOptions {
  return typeof options === 'string' ? { message: options } : options
}

function openDialog(next: Partial<AppDialogState>, resolve: (value: unknown) => void) {
  pendingResolve?.(false)
  pendingResolve = resolve
  Object.assign(state, next, { open: true })
}

export function confirm(options: AppDialogConfirmOptions | string): Promise<boolean> {
  const opts = normalizeConfirmOptions(options)
  return new Promise((resolve) => {
    openDialog(
      {
        title: opts.title ?? '确认',
        message: opts.message,
        detail: opts.detail ?? '',
        tone: opts.tone ?? 'default',
        confirmText: opts.confirmText ?? '确定',
        cancelText: opts.cancelText ?? '取消',
        mode: 'confirm',
        choices: [],
        content: opts.content ?? null,
      },
      (value) => resolve(Boolean(value))
    )
  })
}

export function choose(options: AppDialogChooseOptions): Promise<AppDialogChooseResult> {
  return new Promise((resolve) => {
    openDialog(
      {
        title: options.title ?? '请选择',
        message: options.message,
        detail: options.detail ?? '',
        tone: options.tone ?? 'default',
        confirmText: '',
        cancelText: '',
        mode: 'choose',
        choices: options.choices,
        content: options.content ?? null,
        actionsLayout: options.actionsLayout ?? 'stack',
        rememberLabel: options.rememberLabel ?? '',
        rememberChecked: false,
      },
      (value) => {
        if (value && typeof value === 'object' && 'choice' in value) {
          resolve(value as AppDialogChooseResult)
          return
        }
        resolve({ choice: typeof value === 'string' ? value : null, remember: false })
      }
    )
  })
}

export function alert(options: AppDialogConfirmOptions | string): Promise<void> {
  const opts = normalizeConfirmOptions(options)
  return new Promise((resolve) => {
    openDialog(
      {
        title: opts.title ?? '提示',
        message: opts.message,
        detail: opts.detail ?? '',
        tone: opts.tone ?? 'default',
        confirmText: opts.confirmText ?? '知道了',
        cancelText: '',
        mode: 'confirm',
        choices: [],
        content: opts.content ?? null,
      },
      () => resolve()
    )
  })
}

export function resolveAppDialog(value: unknown) {
  const payload =
    state.mode === 'choose'
      ? {
          choice:
            value && typeof value === 'object' && 'choice' in value
              ? (value as AppDialogChooseResult).choice
              : typeof value === 'string'
                ? value
                : null,
          remember:
            value && typeof value === 'object' && 'remember' in value
              ? Boolean((value as AppDialogChooseResult).remember)
              : state.rememberChecked,
        }
      : value
  state.open = false
  state.content = null
  state.rememberChecked = false
  pendingResolve?.(payload)
  pendingResolve = null
}

export function useAppDialogState() {
  return state
}

export function useAppDialog() {
  return { confirm, choose, alert }
}
