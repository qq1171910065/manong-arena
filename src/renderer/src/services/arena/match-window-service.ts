export const matchWindowService = {
  async open(matchId: string): Promise<void> {
    if (typeof window.api?.openMatchRoomWindow !== 'function') {
      return
    }
    await window.api.openMatchRoomWindow(matchId)
  },

  async close(matchId: string): Promise<void> {
    if (typeof window.api?.closeMatchRoomWindow !== 'function') return
    await window.api.closeMatchRoomWindow(matchId)
  },

  async focusMain(): Promise<void> {
    if (typeof window.api?.focusMainWindow !== 'function') return
    await window.api.focusMainWindow()
  },

  async getKind(): Promise<'main' | 'match-room' | 'login'> {
    if (typeof window.api?.getWindowKind !== 'function') return 'main'
    return window.api.getWindowKind()
  },
}
