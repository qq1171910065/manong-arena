import type { IdentityAssignMode } from '@shared/arena/types'



const SELECTED_MODE_KEY = 'arena:selected-mode'

const CREATE_PRESET_KEY = 'arena:create-preset'



export interface CreateMatchPreset {

  gameModeId: string

  characterIds: string[]

  identityAssignMode?: IdentityAssignMode

  manualRoles?: Record<string, string>

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

}


