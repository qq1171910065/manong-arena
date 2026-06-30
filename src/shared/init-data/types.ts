import type { Character } from '../arena/types'

/** 内置角色初始化数据（不含 id / stats / modelId / 时间戳） */
export type StarterSeedCharacter = Omit<
  Character,
  'id' | 'createdAt' | 'updatedAt' | 'stats' | 'modelId'
> & {
  seedKey: string
}
