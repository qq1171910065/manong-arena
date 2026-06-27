import { clearStoredGatewayKey, invalidateGatewayModelCache } from '@renderer/services/gateway-api'
import { setPortalSession } from '@renderer/services/portal-api'
import { performAuthLogout } from '@renderer/services/auth-session'
import { arenaInvoke } from './client'
import { arenaSession } from './session'
import { loadGameModeOverrides } from './character-service'
import { loadGameScenarios } from './game-scenario-service'
import type { ArenaStoreData, ArenaStoreStats } from '@shared/arena/types'

export const FACTORY_RESET_PHRASE = '删除数据'

export const dataManagementService = {
  async getStats(): Promise<ArenaStoreStats> {
    return arenaInvoke('storage', 'getStoreStats', () => window.api.getStoreStats())
  },

  async exportBackup(): Promise<void> {
    const data = await arenaInvoke('storage', 'exportStore', () => window.api.exportStore())
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `agent-arena-backup-${stamp}.json`
    link.click()
    URL.revokeObjectURL(url)
  },

  async clearMatches(): Promise<void> {
    await arenaInvoke('storage', 'clearStoreMatches', () => window.api.clearStoreMatches())
  },

  async clearLogs(): Promise<void> {
    await arenaInvoke('storage', 'clearStoreLogs', () => window.api.clearStoreLogs())
  },

  async pruneExpired(retentionDays: number): Promise<number> {
    return arenaInvoke('storage', 'pruneStoreExpired', () => window.api.pruneStoreExpired(retentionDays))
  },

  async factoryResetStore(): Promise<ArenaStoreStats> {
    const stats = await arenaInvoke('storage', 'factoryResetStore', () => window.api.factoryResetStore())
    arenaSession.clearDrafts()
    localStorage.removeItem('arena-login-cache-v2')
    await loadGameScenarios()
    await loadGameModeOverrides()
    return stats
  },

  clearLocalSessionCaches(): void {
    arenaSession.clearDrafts()
    clearStoredGatewayKey()
    invalidateGatewayModelCache()
    setPortalSession(null)
    localStorage.removeItem('userInfo')
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
  },

  async factoryResetAndLogout(): Promise<void> {
    await this.factoryResetStore()
    this.clearLocalSessionCaches()
    await performAuthLogout()
  },
}

export type { ArenaStoreStats, ArenaStoreData }
