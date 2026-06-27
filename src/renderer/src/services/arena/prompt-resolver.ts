import type { PromptOutputFormat, PromptPack, PromptRenderContext, PromptSlotId, ResolvedPrompt } from '@shared/arena/game-scenario'
import { BUILTIN_PROMPT_PACKS } from '@shared/arena/prompt-defaults'

function formatValue(value: string | number | string[] | undefined): string {
  if (value === undefined || value === null) return ''
  if (Array.isArray(value)) return value.filter(Boolean).join('、')
  return String(value)
}

/** 渲染 {{variable}} 占位符 */
export function renderPromptTemplate(template: string, context: PromptRenderContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => formatValue(context[key]))
}

export function resolvePromptFromPack(
  pack: PromptPack,
  slotId: PromptSlotId,
  context: PromptRenderContext,
  templateId?: string
): ResolvedPrompt | null {
  const templates = pack.templates.filter((t) => t.slotId === slotId)
  if (!templates.length) return null
  const picked = templateId
    ? templates.find((t) => t.id === templateId)
    : templates.find((t) => t.isDefault) || templates[0]
  if (!picked) return null
  return {
    system: renderPromptTemplate(picked.systemTemplate, context),
    user: picked.userTemplate ? renderPromptTemplate(picked.userTemplate, context) : '',
    outputFormat: (picked.outputFormat || 'text') as PromptOutputFormat,
    templateId: picked.id,
    packId: pack.id,
  }
}

export function listPromptPacksForScenario(scenarioId: string, customPacks: PromptPack[] = []): PromptPack[] {
  return [...BUILTIN_PROMPT_PACKS.filter((p) => p.scenarioId === scenarioId), ...customPacks.filter((p) => p.scenarioId === scenarioId)]
}

export function getPromptPackById(packId: string, customPacks: PromptPack[] = []): PromptPack | undefined {
  return BUILTIN_PROMPT_PACKS.find((p) => p.id === packId) || customPacks.find((p) => p.id === packId)
}

