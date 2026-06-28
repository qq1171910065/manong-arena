/**
 * mntools UI 层：基于 Naive UI + ECharts，与脚手架主题变量联动。
 * 业务页优先从此处导入，避免散落 naive-ui 引用。
 */
export { default as UiProvider } from './UiProvider.vue'
export { default as AppChart } from './charts/AppChart.vue'
export { buildChartBaseOption, mergeChartTheme } from './charts/chart-theme'
export { default as AppEmptyState } from './AppEmptyState.vue'
export { buildNaiveThemeOverrides, isDarkMode } from './naive-theme'

export {
  NAlert,
  NAvatar,
  NButton,
  NCard,
  NCheckbox,
  NDataTable,
  NDivider,
  NDropdown,
  NEmpty,
  NForm,
  NFormItem,
  NGi,
  NGrid,
  NInput,
  NInputGroup,
  NModal,
  NPopconfirm,
  NRadio,
  NRadioGroup,
  NSelect,
  NSlider,
  NSpace,
  NSpin,
  NSwitch,
  NTab,
  NTabs,
  NTag,
  NText,
  NTimeline,
  NTimelineItem,
  NTooltip,
  useMessage,
  useNotification,
} from 'naive-ui'

export { useAppDialog, confirm, choose, alert } from '../composables/useAppDialog'
export type { AppDialogConfirmOptions, AppDialogChooseOptions, AppDialogTone } from '../composables/useAppDialog'

export type { DataTableColumns, FormInst, FormRules, SelectOption } from 'naive-ui'
