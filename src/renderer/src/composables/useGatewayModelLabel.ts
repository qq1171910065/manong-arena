import { onMounted, ref } from 'vue'
import { entryFromGateway, resolveModelInfo, type ModelCatalogEntry } from '@renderer/data/model-catalog'
import { listChatGatewayModels } from '@renderer/services/gateway-api'

let sharedCache: Map<string, ModelCatalogEntry> | null = null
let sharedLoading: Promise<void> | null = null

async function ensureGatewayModelCache() {
  if (sharedCache) return
  if (sharedLoading) {
    await sharedLoading
    return
  }
  sharedLoading = (async () => {
    try {
      const rows = await listChatGatewayModels()
      sharedCache = new Map(rows.map((row) => [row.id, entryFromGateway(row)]))
    } catch {
      sharedCache = new Map()
    }
  })()
  await sharedLoading
  sharedLoading = null
}

export function useGatewayModelLabel() {
  const ready = ref(false)

  onMounted(async () => {
    await ensureGatewayModelCache()
    ready.value = true
  })

  function modelInfo(id: string): ModelCatalogEntry {
    return sharedCache?.get(id) || resolveModelInfo(id)
  }

  function modelLabel(id: string): string {
    return modelInfo(id).label
  }

  return { ready, modelInfo, modelLabel }
}

export async function prefetchGatewayModels() {
  await ensureGatewayModelCache()
}
