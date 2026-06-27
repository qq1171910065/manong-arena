import type { IdentityAssignMode } from '@shared/arena/types'



const SELECTED_MODE_KEY = 'arena:selected-mode'

const CREATE_PRESET_KEY = 'arena:create-preset'
const LAST_CREATE_SELECTION_KEY = 'arena:last-create-selection'



export interface CreateMatchPreset {
  gameModeId: string
  characterIds: string[]
  identityAssignMode?: IdentityAssignMode
  manualRoles?: Record<string, string>
  targetPlayerCount?: number
  werewolfDlcs?: string[]
  werewolfRuleModules?: string[]
  sheriffEnabled?: boolean
  werewolfWinCondition?: string
}



export const arenaSession = {

  setSelectedMode(modeId: string): void {

    sessionStorage.setItem(SELECTED_MODE_KEY, modeId)

  },



  getSelectedMode(): string | null {

    return sessionStorage.getItem(SELECTED_MODE_KEY)

  },



  clearSelectedMode(): void {

    sessionStorage.removeItem(SELECTED_MODE_KEY)

  },



  setCreatePreset(preset: CreateMatchPreset): void {

    sessionStorage.setItem(CREATE_PRESET_KEY, JSON.stringify(preset))

  },



  getCreatePreset(): CreateMatchPreset | null {

    const raw = sessionStorage.getItem(CREATE_PRESET_KEY)

    if (!raw) return null

    try {

      return JSON.parse(raw) as CreateMatchPreset

    } catch {

      return null

    }

  },



  clearCreatePreset(): void {

    sessionStorage.removeItem(CREATE_PRESET_KEY)

  },

  setLastCreateSelection(gameModeId: string, characterIds: string[]): void {
    localStorage.setItem(
      LAST_CREATE_SELECTION_KEY,
      JSON.stringify({ gameModeId, characterIds, savedAt: new Date().toISOString() })
    )
  },

  getLastCreateSelection(gameModeId: string): string[] {
    const raw = localStorage.getItem(LAST_CREATE_SELECTION_KEY)
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw) as { gameModeId?: string; characterIds?: string[] }
      if (parsed.gameModeId !== gameModeId || !Array.isArray(parsed.characterIds)) return []
      return parsed.characterIds.filter((id) => typeof id === 'string' && id)
    } catch {
      return []
    }
  },

  clearDrafts(): void {
    this.clearSelectedMode()
    this.clearCreatePreset()
  },

}


