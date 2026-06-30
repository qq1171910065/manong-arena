import { arenaInvoke, ensureArenaReady } from './client'
import type { Character } from '@shared/arena/types'

export type UserProfileCharacterInput = {
  displayName: string
  speechStyle?: string
  gender?: 'female' | 'male' | 'other'
  bio?: string
}

export async function getUserProfileCharacterId(): Promise<string | null> {
  await ensureArenaReady()
  return arenaInvoke('storage', 'getUserProfileCharacterId', () => window.api.getUserProfileCharacterId())
}

export async function needsUserProfileSetup(): Promise<boolean> {
  const id = await getUserProfileCharacterId()
  return !id
}

export async function createUserProfileCharacter(input: UserProfileCharacterInput): Promise<Character> {
  await ensureArenaReady()
  return arenaInvoke('storage', 'createUserProfileCharacter', () =>
    window.api.createUserProfileCharacter(input)
  )
}
