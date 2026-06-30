import { randomUUID } from '@renderer/utils/id'
import { gatewayChatCompletion } from '../gateway-api'
import { gameScenarioService } from './game-scenario-service'
import { resolvePromptFromPack } from './prompt-resolver'
import { characterService } from './character-service'
import { characterGrowthService } from './character-growth-service'
import { arenaLog } from './logger'
import type { Character, CharacterGameSkill, SkillLearningEntry } from '@shared/arena/types'
import type { PromptRenderContext } from '@shared/arena/game-scenario'

function parseJsonLike(raw: string): Record<string, unknown> | null {
  const text = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0]) as Record<string, unknown>
    } catch {
      return null
    }
  }
}

function appendSkillLearning(skill: CharacterGameSkill, entry: SkillLearningEntry): void {
  if (!skill.learningLog) skill.learningLog = []
  skill.learningLog.unshift(entry)
  if (skill.learningLog.length > 30) skill.learningLog = skill.learningLog.slice(0, 30)
}

export function recordPostMatchSkillLearning(
  character: Character,
  scenarioId: string,
  scenarioName: string,
  matchId: string,
  summary: string,
  understanding?: string
): CharacterGameSkill {
  const skill = getOrCreateSkill(character, scenarioId, scenarioName)
  skill.learned = true
  appendSkillLearning(skill, {
    id: randomUUID(),
    source: 'post_match',
    matchId,
    summary,
    understanding,
    createdAt: new Date().toISOString(),
  })
  if (understanding) {
    const block = `【赛后复盘 ${new Date().toLocaleDateString('zh-CN')}】${summary}\n${understanding}`
    skill.initialUnderstanding = skill.initialUnderstanding ? skill.initialUnderstanding + '\n\n' + block : block
  } else if (summary) {
    const block = `【赛后复盘 ${new Date().toLocaleDateString('zh-CN')}】${summary}`
    skill.initialUnderstanding = skill.initialUnderstanding ? skill.initialUnderstanding + '\n\n' + block : block
  }
  return skill
}

function getOrCreateSkill(character: Character, scenarioId: string, scenarioName?: string): CharacterGameSkill {
  if (!character.gameSkills) character.gameSkills = []
  let skill = character.gameSkills.find((s) => s.scenarioId === scenarioId)
  if (!skill) {
    skill = {
      scenarioId,
      scenarioName,
      learned: false,
      examPassed: false,
      examBypassed: false,
    }
    character.gameSkills.push(skill)
  }
  return skill
}

function buildLearningContext(character: Character, scenarioId: string): PromptRenderContext {
  const scenario = gameScenarioService.get(scenarioId)
  const pack = scenario ? gameScenarioService.getPromptPack(scenario.defaultPromptPackId) : undefined
  const rulesTpl = pack?.templates.find((t) => t.slotId === 'game_rules')
  return {
    characterName: character.name,
    characterBio: character.bio,
    speechStyle: character.speechStyle,
    behaviorPrinciples: character.behaviorPrinciples,
    gameRules: rulesTpl?.systemTemplate || '',
    gameRulesDocument: scenario?.contentDocument || '',
  }
}

export function canJoinScenario(character: Character, scenarioId: string, skipCheck = false): { ok: boolean; reason?: string } {
  if (skipCheck) return { ok: true }
  const scenario = gameScenarioService.get(scenarioId)
  if (!scenario?.requiresLearning) return { ok: true }
  const skill = character.gameSkills?.find((s) => s.scenarioId === scenarioId)
  if (!skill?.learned) {
    return { ok: false, reason: `角色「${character.name}」尚未学习「${scenario.name}」玩法` }
  }
  if (scenario.requiresExam && !skill.examPassed && !skill.examBypassed) {
    return { ok: false, reason: `角色「${character.name}」尚未通过「${scenario.name}」考试` }
  }
  return { ok: true }
}

function applyDeepLearningFields(skill: CharacterGameSkill, parsed: Record<string, unknown>): void {
  const understanding = String(parsed.understanding || '').trim()
  const initialStrategy = String(parsed.initialStrategy || '').trim()
  const mentalModel = String(parsed.mentalModel || '').trim()
  const hypotheses = Array.isArray(parsed.hypotheses) ? parsed.hypotheses.map(String).filter(Boolean) : []
  const edgeCases = Array.isArray(parsed.edgeCases) ? parsed.edgeCases.map(String).filter(Boolean) : []
  const commonMistakes = Array.isArray(parsed.commonMistakes) ? parsed.commonMistakes.map(String).filter(Boolean) : []

  skill.initialUnderstanding = [understanding, mentalModel, initialStrategy].filter(Boolean).join('\n\n')
  skill.initialStrategy = initialStrategy || undefined
  skill.mentalModel = mentalModel || undefined
  skill.hypotheses = hypotheses.length ? hypotheses : skill.hypotheses
  skill.edgeCases = edgeCases.length ? edgeCases : skill.edgeCases
  skill.commonMistakes = commonMistakes.length ? commonMistakes : skill.commonMistakes
  skill.notes = String(parsed.notes || '').trim() || skill.notes
}

export const characterLearningService = {
  getSkill(character: Character, scenarioId: string): CharacterGameSkill | undefined {
    return character.gameSkills?.find((s) => s.scenarioId === scenarioId)
  },

  async learn(characterId: string, scenarioId: string): Promise<CharacterGameSkill> {
    const character = await characterService.get(characterId)
    const scenario = gameScenarioService.get(scenarioId)
    if (!scenario) throw new Error('玩法不存在')

    const pack = gameScenarioService.getPromptPack(scenario.defaultPromptPackId)
    if (!pack) throw new Error('提示词包不存在')

    const context = buildLearningContext(character, scenarioId)
    const resolved = resolvePromptFromPack(pack, 'learning', context)
    if (!resolved) throw new Error('学习提示词未配置')

    const response = await gatewayChatCompletion(character.modelId, [
      { role: 'system', content: resolved.system },
      { role: 'user', content: resolved.user || '请开始学习玩法。' },
    ])

    const parsed = parseJsonLike(response.content || '') || {}
    if (!parsed.understanding && !parsed.mentalModel) {
      throw new Error('学习结果过于浅显，请重试')
    }

    const skill = getOrCreateSkill(character, scenarioId, scenario.name)
    const isRelearn = skill.learned
    skill.learned = true
    skill.learnedAt = new Date().toISOString()
    applyDeepLearningFields(skill, parsed)
    appendSkillLearning(skill, {
      id: randomUUID(),
      source: isRelearn ? 'relearn' : 'initial',
      summary: isRelearn ? `深度再学「${scenario.name}」` : `深度学习「${scenario.name}」`,
      understanding: skill.initialUnderstanding,
      createdAt: new Date().toISOString(),
    })

    await characterService.save(character)
    await characterGrowthService
      .awardFromModelOutput(characterId, response.usage, response.content, {
        source: 'review',
        summary: isRelearn ? `再学「${scenario.name}」` : `学习「${scenario.name}」`,
      })
      .catch(() => undefined)
    arenaLog('info', 'character', `角色 ${character.name} ${isRelearn ? '再次' : ''}完成 ${scenario.name} 学习`)
    return skill
  },

  async exam(characterId: string, scenarioId: string): Promise<CharacterGameSkill> {
    const character = await characterService.get(characterId)
    const scenario = gameScenarioService.get(scenarioId)
    if (!scenario) throw new Error('玩法不存在')

    const skill = getOrCreateSkill(character, scenarioId, scenario.name)
    if (!skill.learned) throw new Error('请先完成玩法学习')

    const pack = gameScenarioService.getPromptPack(scenario.defaultPromptPackId)
    if (!pack) throw new Error('提示词包不存在')

    const context = buildLearningContext(character, scenarioId)
    context.initialUnderstanding = skill.initialUnderstanding || ''
    const resolved = resolvePromptFromPack(pack, 'exam', context)
    if (!resolved) throw new Error('考试提示词未配置')

    const response = await gatewayChatCompletion(character.modelId, [
      { role: 'system', content: resolved.system },
      { role: 'user', content: resolved.user || '开始考试。' },
    ])

    const parsed = parseJsonLike(response.content || '') || {}
    const passed = Boolean(parsed.passed) || Number(parsed.score) >= 60

    skill.examPassed = passed
    if (passed) skill.examPassedAt = new Date().toISOString()
    skill.notes = String(parsed.feedback || skill.notes || '').trim() || skill.notes

    await characterService.save(character)
    await characterGrowthService
      .awardFromModelOutput(characterId, response.usage, response.content, {
        source: 'review',
        summary: passed ? `通过「${scenario.name}」考试` : `完成「${scenario.name}」考试`,
      })
      .catch(() => undefined)
    return skill
  },

  async bypassExam(characterId: string, scenarioId: string): Promise<CharacterGameSkill> {
    const character = await characterService.get(characterId)
    const scenario = gameScenarioService.get(scenarioId)
    const skill = getOrCreateSkill(character, scenarioId, scenario?.name)
    if (!skill.learned) throw new Error('必须先完成学习才能免考加入')
    skill.examBypassed = true
    await characterService.save(character)
    return skill
  },
}
