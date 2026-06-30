import { shallowRef } from 'vue'
import type { UserInfo } from './auth'

const STORAGE_KEY = 'arena-user-local-profile-v1'

export interface UserLocalProfile {
  displayName?: string
  avatarDataUrl?: string
}

type UserLocalProfileStore = Record<string, UserLocalProfile>

export const localProfileRevision = shallowRef(0)

function readStore(): UserLocalProfileStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as UserLocalProfileStore
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(store: UserLocalProfileStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function getUserLocalProfile(userId: number | null | undefined): UserLocalProfile {
  if (!userId) return {}
  return readStore()[String(userId)] ?? {}
}

export function setUserLocalProfile(
  userId: number,
  patch: Partial<UserLocalProfile>
): UserLocalProfile {
  const store = readStore()
  const key = String(userId)
  const prev = store[key] ?? {}
  const next: UserLocalProfile = { ...prev, ...patch }
  if (patch.displayName !== undefined) {
    const trimmed = patch.displayName.trim()
    if (trimmed) next.displayName = trimmed
    else delete next.displayName
  }
  if (patch.avatarDataUrl !== undefined) {
    if (patch.avatarDataUrl) next.avatarDataUrl = patch.avatarDataUrl
    else delete next.avatarDataUrl
  }
  store[key] = next
  writeStore(store)
  localProfileRevision.value += 1
  return next
}

export function resolveUserDisplayName(user: UserInfo | null, local?: UserLocalProfile): string {
  const localName = local?.displayName?.trim()
  if (localName) return localName
  return user?.name?.trim() || user?.username?.trim() || ''
}

export function resolveUserAvatarUrl(
  user: UserInfo | null,
  local: UserLocalProfile | undefined,
  fallback: string
): string {
  return local?.avatarDataUrl || user?.avatar || fallback
}
