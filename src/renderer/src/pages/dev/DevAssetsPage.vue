<script setup lang="ts">
import DevAssetTile from '@renderer/components/dev/DevAssetTile.vue'
import DevAssetsTreePanel from '@renderer/components/dev/DevAssetsTreePanel.vue'
import { computed, onMounted, ref } from 'vue'
import { FolderOpen, Package, Trash2 } from 'lucide-vue-next'
import { NButton, NPopconfirm, NSpace, useMessage } from '@renderer/ui'
import type { DevAssetsEntry, DevAssetsTreeNode } from '@shared/arena/dev-assets-types'

const message = useMessage()

const loading = ref(true)
const loadingLabel = ref('正在加载素材目录…')
const tree = ref<DevAssetsTreeNode | null>(null)
const currentPath = ref('')
const entries = ref<DevAssetsEntry[]>([])
const working = ref(false)

const breadcrumb = computed(() => {
  if (!currentPath.value) return '.dev-assets'
  return `.dev-assets/${currentPath.value}`
})

const visibleEntries = computed(() => entries.value.filter((entry) => !entry.isReadme))

async function refreshAll() {
  loading.value = true
  loadingLabel.value = '正在加载素材目录…'
  const unsubscribe =
    typeof window.api.onAssetPackProgress === 'function'
      ? window.api.onAssetPackProgress((payload) => {
          if (payload.label) loadingLabel.value = payload.label
        })
      : undefined
  try {
    const ensureRes = await window.api.ensureDevAssets()
    if (ensureRes.assetPackFetched) {
      message.success(
        ensureRes.assetPackSource === 'local'
          ? '已从本地缓存解压素材包到 .dev-assets/'
          : '已下载并解压素材包到 .dev-assets/'
      )
    } else if (ensureRes.assetPackError) {
      message.error(`素材包拉取失败：${ensureRes.assetPackError}`)
    }
    const treeRes = await window.api.getDevAssetsTree()
    tree.value = treeRes.tree
    await loadDirectory(currentPath.value)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载素材目录失败')
  } finally {
    unsubscribe?.()
    loading.value = false
  }
}

async function loadDirectory(relativePath: string) {
  currentPath.value = relativePath
  const res = await window.api.listDevAssets(relativePath)
  if (!res.ok) {
    message.error(res.error || '读取目录失败')
    return
  }
  entries.value = res.entries || []
}

function openDirectory(entry: DevAssetsEntry) {
  if (entry.kind !== 'directory') return
  void loadDirectory(entry.relativePath)
}

async function openInExplorer() {
  const res = await window.api.openDevAssetsPath(currentPath.value)
  if (!res.ok) message.error(res.error || '打开目录失败')
}

async function revealFile(entry: DevAssetsEntry) {
  const res = await window.api.showDevAssetsItem(entry.relativePath)
  if (!res.ok) message.error(res.error || '打开文件位置失败')
}

async function deleteEntry(entry: DevAssetsEntry) {
  working.value = true
  try {
    const res = await window.api.deleteDevAsset(entry.relativePath)
    if (!res.ok) {
      message.error(res.error || '删除失败')
      return
    }
    message.success(`已删除 ${entry.name}`)
    await refreshAll()
  } finally {
    working.value = false
  }
}

async function syncToUserData() {
  working.value = true
  try {
    const res = await window.api.syncDevAssetsToUserData()
    if (!res.ok) {
      message.error(res.error || '同步失败')
      return
    }
    message.success('已同步素材包到 userData 安装目录')
  } finally {
    working.value = false
  }
}

async function packExport() {
  working.value = true
  try {
    const res = await window.api.packExportDevAssets()
    if (!res.ok) {
      if (res.error !== '已取消导出') message.error(res.error || '打包失败')
      return
    }
    message.success(`素材包已导出（${((res.sizeBytes || 0) / 1024 / 1024).toFixed(1)} MB）`)
    if (res.zipPath && window.api.showItemInFolder) {
      await window.api.showItemInFolder(res.zipPath)
    }
  } finally {
    working.value = false
  }
}

onMounted(() => {
  void refreshAll()
})
</script>

<template>
  <div class="dev-assets-page">
    <div class="dev-assets-page__toolbar">
      <span class="dev-assets-page__crumb">{{ breadcrumb }}</span>
      <NSpace :size="6" align="center" class="dev-assets-page__actions">
        <NButton size="small" quaternary :loading="working" @click="openInExplorer">
          <template #icon><FolderOpen :size="15" /></template>
          打开目录
        </NButton>
        <NButton size="small" quaternary :loading="working" @click="syncToUserData">同步运行时</NButton>
        <NButton size="small" type="primary" :loading="working" @click="packExport">
          <template #icon><Package :size="15" /></template>
          打包导出
        </NButton>
      </NSpace>
    </div>

    <div class="dev-assets-page__layout">
      <aside class="dev-assets-page__tree">
        <DevAssetsTreePanel
          :tree="tree"
          :active-path="currentPath"
          @select="(path) => loadDirectory(path)"
        />
      </aside>

      <section class="dev-assets-page__main">
        <div v-if="loading" class="dev-assets-page__empty">{{ loadingLabel }}</div>
        <div v-else-if="!visibleEntries.length" class="dev-assets-page__empty">
          此目录暂无素材，可在资源管理器中直接编辑
        </div>
        <div v-else class="dev-assets-page__tiles">
          <div v-for="entry in visibleEntries" :key="entry.relativePath" class="dev-assets-page__tile-wrap">
            <DevAssetTile :entry="entry" @open="openDirectory" @reveal="revealFile" />
            <NPopconfirm v-if="!entry.isReadme" @positive-click="deleteEntry(entry)">
              <template #trigger>
                <button type="button" class="dev-assets-page__delete" title="删除">
                  <Trash2 :size="13" />
                </button>
              </template>
              确定删除「{{ entry.name }}」？
            </NPopconfirm>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.dev-assets-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 72px - 50px);
  max-height: calc(100vh - 72px - 50px);
  overflow: hidden;
  padding: 10px 18px 14px;
  box-sizing: border-box;
}

.dev-assets-page__toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
  min-height: 40px;
  margin-bottom: 10px;
}

.dev-assets-page__crumb {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: #65709f;
}

.dev-assets-page__actions {
  flex: 0 0 auto;
}

.dev-assets-page__layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 210px minmax(0, 1fr);
  gap: 10px;
}

.dev-assets-page__tree,
.dev-assets-page__main {
  min-height: 0;
  border-radius: 16px;
  border: 1px solid rgba(132, 142, 204, 0.14);
  background: rgba(255, 255, 255, 0.62);
  overflow: hidden;
}

.dev-assets-page__tree {
  overflow-y: auto;
  padding: 8px 0 10px;
  scrollbar-width: none;
}

.dev-assets-page__tree::-webkit-scrollbar {
  display: none;
}

.dev-assets-page__main {
  display: flex;
  flex-direction: column;
}

.dev-assets-page__tiles {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 4px 2px;
  padding: 14px 12px;
  scrollbar-width: none;
}

.dev-assets-page__tiles::-webkit-scrollbar {
  display: none;
}

.dev-assets-page__tile-wrap {
  position: relative;
  flex: 0 0 76px;
  width: 76px;
}

.dev-assets-page__delete {
  position: absolute;
  top: 2px;
  right: 0;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.92);
  color: #8890b8;
  opacity: 0;
  cursor: pointer;
  transition: opacity 0.15s ease;
  box-shadow: 0 1px 4px rgba(40, 48, 100, 0.12);
}

.dev-assets-page__tile-wrap:hover .dev-assets-page__delete {
  opacity: 1;
}

.dev-assets-page__delete:hover {
  color: #e5484d;
}

.dev-assets-page__empty {
  flex: 1;
  display: grid;
  place-items: center;
  color: #8890b8;
  font-size: 13px;
}
</style>
