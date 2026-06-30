import {
  buildCharacterScenarioDetail,
  listScenarioRecordSummaries,
  type CharacterScenarioDetail,
  type CharacterScenarioRecordSummary,
  type ScenarioRecordMeta,
} from '@shared/arena/character-scenario-record'
import type { Character } from '@shared/arena/types'
import { characterChatService } from './character-chat-service'
import { characterGrowthService } from './character-growth-service'
import { characterService } from './character-service'
import { gameScenarioService } from './game-scenario-service'
import { matchService } from './match-service'
import { postGameReviewService } from './post-game-review-service'

function scenarioMetas(): ScenarioRecordMeta[] {
  return gameScenarioService
    .list()
    .filter((s) => s.isAvailable)
    .map((s) => ({
      scenarioId: s.id,
      scenarioName: s.name,
      gameModeId: s.gameModeId,
      requiresExam: s.requiresExam,
    }))
}

export const characterScenarioRecordService = {
  async listSummaries(character: Character): Promise<CharacterScenarioRecordSummary[]> {
    await gameScenarioService.refresh()
    const matches = await matchService.list()
    return listScenarioRecordSummaries(character, scenarioMetas(), matches)
  },

  async getDetail(characterId: string, scenarioId: string): Promise<CharacterScenarioDetail | null> {
    await gameScenarioService.refresh()
    const character = await characterService.get(characterId)
    const meta = scenarioMetas().find((m) => m.scenarioId === scenarioId)
    if (!meta) return null
    const matches = await matchService.list()
    const snapshots = await characterGrowthService.listSnapshots(characterId)
    const growthRecords = await characterChatService.listGrowth(characterId)
    const behaviorChanges = await postGameReviewService.listBehaviorChanges(characterId)
    return buildCharacterScenarioDetail(
      character,
      meta,
      matches,
      snapshots,
      growthRecords,
      behaviorChanges
    )
  },
}
