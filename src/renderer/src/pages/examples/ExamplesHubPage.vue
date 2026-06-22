<script setup lang="ts">
import { computed, ref, shallowRef, type Component } from 'vue'
import {
  Boxes,
  Camera,
  Clipboard,
  Database,
  ExternalLink,
  Globe,
  HardDrive,
  Keyboard,
  MessageSquare,
  Bell,
  FolderOpen,
  Printer,
  Radio,
  AppWindow,
  Menu,
  Cpu,
} from 'lucide-vue-next'
import { AppButton, AppEmptyState, NCard, NEmpty, NSpin, NTab, NTabs } from '../../ui'
import { getRuntimeConfig } from '@renderer/composables/runtime-config'
import { useGeneralSettings } from '@renderer/composables/useGeneralSettings'

type ExampleId =
  | 'stream-demo'
  | 'file-demo'
  | 'db-demo'
  | 'notify-demo'
  | 'storage-demo'
  | 'bus-demo'
  | 'clipboard-demo'
  | 'shell-demo'
  | 'shortcut-demo'
  | 'tray-demo'
  | 'window-demo'
  | 'screenshot-demo'
  | 'print-demo'
  | 'worker-demo'
  | 'protocol-demo'

interface ExampleMeta {
  id: ExampleId
  label: string
  description: string
  icon: Component
  loader: () => Promise<{ default: Component }>
}

const DEMO_FILES: Record<ExampleId, string> = {
  'stream-demo': './StreamChatDemo.vue',
  'file-demo': './FileManagerDemo.vue',
  'db-demo': './LocalDatabaseDemo.vue',
  'notify-demo': './NotificationDemo.vue',
  'storage-demo': './StorageManagerDemo.vue',
  'bus-demo': './SystemBusDemo.vue',
  'clipboard-demo': './ClipboardDemo.vue',
  'shell-demo': './ShellDemo.vue',
  'shortcut-demo': './ShortcutDemo.vue',
  'tray-demo': './TrayDemo.vue',
  'window-demo': './WindowDemo.vue',
  'screenshot-demo': './ScreenshotDemo.vue',
  'print-demo': './PrintDemo.vue',
  'worker-demo': './WorkerDemo.vue',
  'protocol-demo': './ProtocolDemo.vue',
}

const DEMO_META: Record<
  ExampleId,
  Pick<ExampleMeta, 'label' | 'description' | 'icon'>
> = {
  'stream-demo': { label: '流式对话', description: 'SSE 流式调用大模型', icon: MessageSquare },
  'file-demo': { label: '文件管理', description: '文件对话框与读写', icon: FolderOpen },
  'db-demo': { label: '本地数据库', description: 'SQLite 本地存储', icon: Database },
  'notify-demo': { label: '系统通知', description: 'Electron 桌面通知', icon: Bell },
  'storage-demo': { label: '存储管理', description: 'electron-store 数据', icon: HardDrive },
  'bus-demo': { label: '系统总线', description: '跨窗口 IPC 广播', icon: Radio },
  'clipboard-demo': { label: '剪贴板', description: '读写系统剪贴板', icon: Clipboard },
  'shell-demo': { label: 'Shell', description: '打开链接与本地路径', icon: ExternalLink },
  'shortcut-demo': { label: '快捷键', description: '全局快捷键注册', icon: Keyboard },
  'tray-demo': { label: '系统托盘', description: '托盘图标与关闭隐藏', icon: Menu },
  'window-demo': { label: '窗口', description: '置顶、透明度、bounds', icon: AppWindow },
  'screenshot-demo': { label: '截图', description: 'desktopCapturer 源列表', icon: Camera },
  'print-demo': { label: '打印', description: '打印对话框与 PDF', icon: Printer },
  'worker-demo': { label: 'Worker', description: 'worker_threads 计算', icon: Cpu },
  'protocol-demo': { label: 'HTTP / Deeplink', description: 'request 与协议唤起', icon: Globe },
}

/** 仅索引磁盘上实际存在的 Demo 文件，避免 Vite 解析已裁剪模块的 import */
const vueModules = import.meta.glob<{ default: Component }>('./*.vue')

function buildExamples(): ExampleMeta[] {
  const enabled = getRuntimeConfig().exampleModules
  return enabled
    .filter((id): id is ExampleId => id in DEMO_FILES && id in DEMO_META)
    .filter((id) => DEMO_FILES[id] in vueModules)
    .map((id) => ({
      id,
      ...DEMO_META[id],
      loader: () => vueModules[DEMO_FILES[id]]!(),
    }))
}

const examples = buildExamples()
const { settings } = useGeneralSettings()

type TabId = ExampleId
const activeId = ref<TabId>(examples[0]?.id ?? 'stream-demo')
const activeComponent = shallowRef<Component | null>(null)
const loading = ref(false)
const loadError = ref('')

const activeMeta = computed(() => examples.find((e) => e.id === activeId.value))

async function selectExample(id: TabId) {
  if (activeId.value === id && activeComponent.value && !loadError.value) return
  activeId.value = id
  loading.value = true
  loadError.value = ''
  activeComponent.value = null
  try {
    const meta = examples.find((e) => e.id === id)
    if (!meta) return
    const mod = await meta.loader()
    activeComponent.value = mod.default
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : '示例加载失败'
  } finally {
    loading.value = false
  }
}

if (examples[0]) void selectExample(examples[0].id)
</script>

<template>
  <div class="page page-wide">
    <div class="page-head">
      <div>
        <h1>功能示例</h1>
        <p class="text-muted">Electron 主进程能力与 IPC 演示。图表样式见 UI 组件库 → 图表。</p>
      </div>
      <Boxes v-if="settings.showDemoBadge" :size="20" class="text-muted" />
    </div>

    <NEmpty v-if="examples.length === 0" description="未启用任何示例模块" />

    <template v-else>
      <NTabs :value="activeId" type="line" animated class="mb-4" @update:value="(v) => selectExample(v as TabId)">
        <NTab v-for="item in examples" :key="item.id" :name="item.id">
          <component :is="item.icon" :size="16" style="margin-right: 6px; vertical-align: -2px" />
          {{ item.label }}
        </NTab>
      </NTabs>

      <NCard v-if="activeMeta" class="mntools-panel mb-4">
        <strong>{{ activeMeta.label }}</strong>
        <p class="text-muted mb-0">{{ activeMeta.description }}</p>
      </NCard>

      <NSpin :show="loading">
        <AppEmptyState
          v-if="loadError"
          title="示例加载失败"
          :description="loadError"
        >
          <AppButton variant="primary" @click="selectExample(activeId)">重试</AppButton>
        </AppEmptyState>
        <component :is="activeComponent" v-else-if="activeComponent" embedded />
      </NSpin>
    </template>
  </div>
</template>
