import { BUILTIN_GAME_MODES } from './constants'

const CAMP_LABEL: Record<string, string> = {
  wolf: '狼人阵营',
  good: '好人阵营',
  neutral: '中立',
  evil: '邪恶阵营',
}

function roleSection(modeId: string): string {
  const mode = BUILTIN_GAME_MODES.find((m) => m.id === modeId)
  if (!mode?.roles.length) return ''
  const lines = ['## 身份与技能', '']
  for (const role of mode.roles) {
    lines.push(`### ${role.name}`)
    lines.push(`- **阵营**：${CAMP_LABEL[role.camp] || role.camp}`)
    if (role.hidden) lines.push('- **隐藏身份**：是（仅本人与裁判知晓）')
    if (role.isGod) lines.push('- **类型**：神职')
    if (role.description) lines.push(`- **定位**：${role.description}`)
    if (role.skillName) lines.push(`- **技能**：${role.skillName}`)
    if (role.skillDescription) lines.push(`- **技能说明**：${role.skillDescription}`)
    if (role.timing) lines.push(`- **发动时机**：${role.timing}`)
    if (role.nightOrder != null) lines.push(`- **夜晚行动顺序**：${role.nightOrder}`)
    if (role.publicInfo) lines.push(`- **公开信息**：${role.publicInfo}`)
    lines.push('')
  }
  return lines.join('\n')
}

function phaseSection(modeId: string): string {
  const mode = BUILTIN_GAME_MODES.find((m) => m.id === modeId)
  if (!mode?.phases.length) return ''
  const sorted = [...mode.phases].sort((a, b) => a.order - b.order)
  const lines = ['## 流程阶段', '']
  sorted.forEach((phase, index) => {
    lines.push(`### ${index + 1}. ${phase.name}`)
    lines.push(`- **阶段类型**：${phase.kind}`)
    lines.push(`- **说明**：${phase.description}`)
    lines.push('')
  })
  return lines.join('\n')
}

export const WEREWOLF_CONTENT_DOCUMENT = [
  '# 狼人杀 · 完整玩法说明',
  '',
  modeDescription('werewolf'),
  '',
  '## 游戏目标',
  '',
  '- **好人阵营**：找出并放逐所有狼人，或在屠边/屠城规则下阻止狼人达成对应屠边/屠城条件。',
  '- **狼人阵营**：隐藏身份，在夜晚淘汰好人；**屠边**时杀光所有平民或所有神职即胜，**屠城**时杀光所有好人即胜。',
  '',
  '## 核心规则',
  '',
  '### 信息公开原则',
  '- 身份、查验结果、用药细节等**仅对对应玩家**生效，不得在对局中直接泄露。',
  '- 公开频道只展示：阶段变化、公开发言、投票结果、规则允许的死亡与技能结算。',
  '- 玩家应基于**公开信息**推理，而非上帝视角。',
  '',
  '### 警长规则',
  '- 首轮进入警长竞选（**警上**），位于**首夜行动之前**。',
  '- 警上阶段预言家**尚未进行任何查验**，因此警上跳预言家只能说明身份与警徽流，**无法也不应**公布验人结果；发言相对模糊是正常现象。',
  '- 其他玩家不要仅因警上预言家「没有验人」「信息不足」就集体质疑或扣「假预言家」；应结合警徽流、竞选态度与逻辑，白天再结合票型判断。',
  '- 投票选出警长；警长拥有 **1.5 票**归票权。',
  '- 警长死亡后警徽移交或流失，由裁判按规则处理。',
  '',
  '### 夜晚行动顺序（典型）',
  '警长产生后，首个夜晚起按序行动：',
  '1. 守卫守护',
  '2. 狼人刀人',
  '3. 预言家查验（**首验在警上之后的第一个夜晚**）',
  '4. 女巫用药（解药 / 毒药）',
  '5. 其他神职按配置行动',
  '',
  '守卫与狼人同守同刀时，目标**免死**（平安夜的一种情况）。守卫**不能连续两晚**守护同一人。',
  '',
  '### 狼人自刀（高级战术）',
  '- 狼人夜晚袭击目标**可以是狼队友甚至自己**（自刀），规则上允许。',
  '- 常见目的：让刀口落在看似好人的狼队友身上，**骗取女巫解药**，或扰乱好人判断。',
  '- 属于高级玩法，需狼队统一战术；好人侧应结合票型与发言判断，勿仅凭「像好人」就认定刀口必为好人。',
  '',
  '### 白天流程',
  '- 公布夜晚死亡信息（或平安夜）。',
  '- 按席位轮流发言，警长可引导归票。',
  '- 放逐投票：存活且有票权者投票，警长票计 1.5 票；平票则无人出局（具体以局内裁判为准）。',
  '',
  '### 遗言规则',
  '- **标准规则**：仅**第一个夜晚**出局（在首个白天公布前）的玩家可以发表遗言。',
  '- 白天被投票放逐、第二夜及以后夜间出局、被女巫毒杀等，**默认不能**发表遗言。',
  '- 创建对局时可勾选规则扩展：放逐遗言、夜间遗言（次夜起）、毒杀遗言。',
  '',
  '### 胜负判定',
  '- 狼人全部出局 → **好人胜**（两种模式通用）。',
  '- **屠边**（创建对局可选）：狼人杀光所有**平民**或所有**神职** → **狼人胜**。',
  '- **屠城**（创建对局可选，默认）：狼人杀光所有**好人** → **狼人胜**。',
  '',
  '## 规则要点',
  '',
  ...(BUILTIN_GAME_MODES.find((m) => m.id === 'werewolf')?.ruleHighlights || []).map((r) => `- ${r}`),
  '',
  phaseSection('werewolf'),
  roleSection('werewolf'),
  '## 开局说明',
  '',
  BUILTIN_GAME_MODES.find((m) => m.id === 'werewolf')?.setupSummary || '',
  '',
  '## 给 AI 角色的学习建议',
  '',
  '- 不要只背规则条文，要理解**信息如何在不同阶段产生与隐藏**。',
  '- 对每种身份思考：「若我是该身份，第一夜/第一天最该验证的假设是什么？」',
  '- 关注票型、发言顺序与警长流转等**可观察行为**，而非单一发言内容。',
].join('\n')

export const ROUNDTABLE_CONTENT_DOCUMENT = [
  '# 自定义圆桌讨论 · 完整玩法说明',
  '',
  modeDescription('roundtable'),
  '',
  '## 游戏目标',
  '',
  '多位 AI 角色围绕**同一议题**进行多轮讨论，各抒己见、回应他人、推进话题深度。本玩法无胜负判定，重在观点碰撞与角色互动。',
  '',
  '## 核心规则',
  '',
  '- **无隐藏身份**：所有参与者身份公开，均为「参与者」。',
  '- **无投票出局**：不因投票淘汰任何角色。',
  '- **按席发言**：每轮按席位顺序轮流发言，需回应近期观点而非独白。',
  '- **保持人设**：发言应符合角色性格、说话风格与行为原则。',
  '- **尊重讨论**：可质疑观点，不对人身攻击；可提出反例与假设。',
  '',
  '## 系统角色',
  '',
  '### 主持人（可选）',
  '- 开场介绍议题与讨论规则。',
  '- 每轮开始前简要归纳上一轮要点，引导下一轮发言。',
  '- 不代替参与者表达立场。',
  '',
  '### 解说（可选）',
  '- 中立概括讨论氛围、分歧点与共识进展。',
  '- 不泄露未发生的「剧情」或替玩家做决定。',
  '',
  phaseSection('roundtable'),
  '## 议题与轮数',
  '',
  '- 开局前由用户设定**讨论议题**（如社会议题、剧情走向、技术选型等）。',
  '- 默认进行多轮发言（通常 3 轮），每轮全员发言完毕后进入下一轮。',
  '- 最后一轮可侧重总结、收敛或提出开放问题。',
  '',
  '## 与狼人杀等规则游戏的区别',
  '',
  '- **信息公开**：圆桌全部公开；狼人杀等有大量隐藏信息。',
  '- **目标**：圆桌深化议题；规则游戏追求阵营胜负。',
  '- **投票**：圆桌无投票；狼人杀等有放逐/选举。',
  '- **技能**：圆桌无身份技能；狼人杀等有身份技能。',
  '',
  '## 给 AI 角色的学习建议',
  '',
  '- 理解本玩法的重点是**论证结构**而非输赢。',
  '- 每次发言应至少：回应一位他人观点 + 提出一个新角度或假设。',
  '- 根据人设决定在讨论中扮演推进者、质疑者还是总结者。',
].join('\n')

function modeDescription(modeId: string): string {
  const mode = BUILTIN_GAME_MODES.find((m) => m.id === modeId)
  if (!mode) return ''
  return `> ${mode.description}\n\n**推荐人数**：${mode.recommendedPlayers} 人（${mode.minPlayers}–${mode.maxPlayers} 人） · **约 ${mode.estimatedDurationMinutes} 分钟/局**`
}
