import { DEFAULT_ARENA_MODEL_ID, DEFAULT_ARENA_SETTINGS } from '@shared/arena/constants'
import { applyArenaSettingsEffects, notifyArenaSettingsChange } from './settings-runtime'
import { arenaInvoke, ensureArenaReady } from './client'
import type { ArenaSettings } from '@shared/arena/types'

function normalizeSettings(raw: Partial<ArenaSettings> | ArenaSettings): ArenaSettings {
  return {
    ...structuredClone(DEFAULT_ARENA_SETTINGS),
    ...raw,
    matchDefaults: {
      ...DEFAULT_ARENA_SETTINGS.matchDefaults,
      ...raw.matchDefaults,
    },
    characterEvolution: {
      ...DEFAULT_ARENA_SETTINGS.characterEvolution,
      ...raw.characterEvolution,
    },
  }
}

export const settingsService = {
  async get(): Promise<ArenaSettings> {
    await ensureArenaReady()
    const settings = normalizeSettings(
      await arenaInvoke('storage', 'getSettings', () => window.api.getSettings())
    )
    applyArenaSettingsEffects(settings)
    return settings
  },

  async save(partial: Partial<ArenaSettings>): Promise<ArenaSettings> {
    await ensureArenaReady()
    const settings = normalizeSettings(
      await arenaInvoke('storage', 'saveSettings', () =>
        window.api.saveSettings(JSON.parse(JSON.stringify(partial)) as Partial<ArenaSettings>)
      )
    )
    applyArenaSettingsEffects(settings)
    notifyArenaSettingsChange(settings)
    return settings
  },

  defaults(): ArenaSettings {
    return structuredClone(DEFAULT_ARENA_SETTINGS)
  },

  async getDefaultModelId(): Promise<string> {
    const settings = await this.get()
    const id = settings.defaultModelId?.trim()
    return id || DEFAULT_ARENA_MODEL_ID
  },
}

