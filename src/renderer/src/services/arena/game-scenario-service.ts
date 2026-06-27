import { BUILTIN_GAME_SCENARIOS, BUILTIN_PROMPT_PACKS } from '@shared/arena/prompt-defaults'
import { arenaInvoke, ensureArenaReady } from './client'
import { gameModeService } from './character-service'
import type { GameScenarioDefinition, PromptPack, SystemRoleConfig } from '@shared/arena/game-scenario'

let customScenarios: GameScenarioDefinition[] = []
let customPromptPacks: PromptPack[] = []

export async function loadGameScenarios(): Promise<void> {
  await ensureArenaReady()
  const data = await arenaInvoke('storage', 'getScenarioData', () => window.api.getScenarioData())
  customScenarios = data.customScenarios || []
  customPromptPacks = data.customPromptPacks || []
}

export function mergeSystemRoles(base: SystemRoleConfig[], patches: SystemRoleConfig[]): SystemRoleConfig[] {
  const byId = new Map(base.map((role) => [role.id, { ...role }]))
  for (const patch of patches) {
    const prev = byId.get(patch.id)
    if (prev) byId.set(patch.id, { ...prev, ...patch })
    else byId.set(patch.id, patch)
  }
  return Array.from(byId.values())
}

function systemRolesMatchBuiltin(roles: SystemRoleConfig[], base: GameScenarioDefinition): boolean {
  return roles.every((role) => {
    const builtin = base.systemRoles.find((item) => item.id === role.id)
    if (!builtin) return false
    return role.enabled === builtin.enabled && !role.modelId?.trim()
  })
}

function mergeScenario(base: GameScenarioDefinition): GameScenarioDefinition {
  const override = customScenarios.find((s) => s.id === base.id)
  if (!override) return structuredClone(base)
  const merged = { ...structuredClone(base), ...override }
  if (override.systemRoles?.length) {
    merged.systemRoles = mergeSystemRoles(base.systemRoles, override.systemRoles)
  }
  return merged
}

export const gameScenarioService = {
  async refresh(): Promise<void> {
    await loadGameScenarios()
  },

  list(): GameScenarioDefinition[] {
    const installedModeIds = new Set(
      gameModeService.list().map((mode) => mode.id)
    )
    if (!installedModeIds.size) return []

    const builtin = BUILTIN_GAME_SCENARIOS.filter((scenario) =>
      installedModeIds.has(scenario.gameModeId)
    ).map(mergeScenario)
    const userOnly = customScenarios.filter(
      (s) => !BUILTIN_GAME_SCENARIOS.some((b) => b.id === s.id) && installedModeIds.has(s.gameModeId)
    )
    return [...builtin, ...userOnly.map((s) => structuredClone(s))]
  },

  get(id: string): GameScenarioDefinition | undefined {
    return this.list().find((s) => s.id === id)
  },

  getByGameModeId(gameModeId: string): GameScenarioDefinition | undefined {
    return this.list().find((s) => s.gameModeId === gameModeId)
  },

  isAvailable(id: string): boolean {
    const scenario = this.get(id)
    return Boolean(scenario?.isAvailable)
  },

  listPromptPacks(scenarioId: string): PromptPack[] {
    return [
      ...BUILTIN_PROMPT_PACKS.filter((p) => p.scenarioId === scenarioId),
      ...customPromptPacks.filter((p) => p.scenarioId === scenarioId),
    ]
  },

  getPromptPack(packId: string): PromptPack | undefined {
    return BUILTIN_PROMPT_PACKS.find((p) => p.id === packId) || customPromptPacks.find((p) => p.id === packId)
  },

  async saveCustomScenario(scenario: GameScenarioDefinition): Promise<GameScenarioDefinition> {
    await ensureArenaReady()
    const saved = await arenaInvoke('storage', 'saveCustomScenario', () => window.api.saveCustomScenario(scenario))
    customScenarios = saved.customScenarios || []
    return scenario
  },

  async saveSystemRoleModels(
    scenarioId: string,
    patches: Array<Partial<SystemRoleConfig> & { id: string }>
  ): Promise<void> {
    await ensureArenaReady()
    const base = BUILTIN_GAME_SCENARIOS.find((s) => s.id === scenarioId)
    if (!base) return

    const existing = customScenarios.find((s) => s.id === scenarioId)
    const nextRoles = mergeSystemRoles(
      base.systemRoles,
      [...(existing?.systemRoles ?? []), ...patches.map((patch) => ({ ...patch } as SystemRoleConfig))]
    )

    if (systemRolesMatchBuiltin(nextRoles, base) && !hasNonRoleScenarioOverride(existing, base)) {
      if (existing) await this.clearCustomScenario(scenarioId)
      return
    }

    await arenaInvoke('storage', 'saveCustomScenario', () =>
      window.api.saveCustomScenario({
        id: scenarioId,
        gameModeId: base.gameModeId,
        systemRoles: nextRoles,
      } as GameScenarioDefinition)
    )
    const data = await arenaInvoke('storage', 'getScenarioData', () => window.api.getScenarioData())
    customScenarios = data.customScenarios || []
  },

  async clearCustomScenario(scenarioId: string): Promise<void> {
    await ensureArenaReady()
    const saved = await arenaInvoke('storage', 'clearCustomScenario', () => window.api.clearCustomScenario(scenarioId))
    customScenarios = saved.customScenarios || []
  },

  async saveCustomPromptPack(pack: PromptPack): Promise<PromptPack> {
    await ensureArenaReady()
    const saved = await arenaInvoke('storage', 'saveCustomPromptPack', () => window.api.saveCustomPromptPack(pack))
    customPromptPacks = saved.customPromptPacks || []
    return pack
  },
}

function hasNonRoleScenarioOverride(
  override: GameScenarioDefinition | undefined,
  base: GameScenarioDefinition
): boolean {
  if (!override) return false
  const keys = Object.keys(override).filter((key) => key !== 'id' && key !== 'systemRoles' && key !== 'isBuiltin' && key !== 'updatedAt')
  return keys.some((key) => {
    const value = override[key as keyof GameScenarioDefinition]
    return value !== undefined && value !== base[key as keyof GameScenarioDefinition]
  })
}
