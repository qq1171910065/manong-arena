/**
 * mntools UI 层：基于 Naive UI + ECharts，与脚手架主题变量联动。
 * 业务页优先从此处导入，避免散落 naive-ui 引用。
 */
export { default as UiProvider } from './UiProvider.vue'
export { default as AppChart } from './charts/AppChart.vue'
export { default as AppChartCard } from './AppChartCard.vue'
export { buildChartBaseOption, mergeChartTheme } from './charts/chart-theme'
export { default as AppButton } from './AppButton.vue'
export { default as AppPageHeader } from './AppPageHeader.vue'
export { default as AppStatCard } from './AppStatCard.vue'
export { default as AppEmptyState } from './AppEmptyState.vue'
export { default as AppFilterBar } from './AppFilterBar.vue'
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
  useDialog,
  useMessage,
  useNotification,
} from 'naive-ui'

export type { DataTableColumns, FormInst, FormRules, SelectOption } from 'naive-ui'
