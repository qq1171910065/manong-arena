<script setup lang="ts">
import { computed, ref } from 'vue'
import { Sparkles, Plus, Trash2, Wand2 } from 'lucide-vue-next'
import { confirm } from '@renderer/composables/useAppDialog'
import { characterAgentService, formatUserMessage } from '@renderer/services/arena'
import DetailRegionEmpty from './DetailRegionEmpty.vue'
import {
  AGENT_SKILL_SCOPE_LABELS,
  MATCH_SKILL_PHASE_LABELS,
  normalizeAgentSkills,
  type AgentSkillScope,
  type CharacterAgentSkill,
  type MatchSkillPhase,
} from '@shared/arena/character-agent'
import type { Character } from '@shared/arena/types'

const props = defineProps<{ character: Character; embedded?: boolean }>()
const emit = defineEmits<{ updated: [Character] }>()

const busy = ref(false)
const error = ref('')
const editing = ref<CharacterAgentSkill | null>(null)
const templates = characterAgentService.listSkillTemplates()

const phaseOptions = Object.entries(MATCH_SKILL_PHASE_LABELS) as Array<[MatchSkillPhase, string]>
const scopeOptions = Object.entries(AGENT_SKILL_SCOPE_LABELS) as Array<[AgentSkillScope, string]>

const skills = computed(() => normalizeAgentSkills(props.character.agentSkills))
const enabledCount = computed(() => skills.value.filter((s) => s.enabled).length)

function startCreate() {
  editing.value = characterAgentService.createSkill()
}

function startEdit(skill: CharacterAgentSkill) {
  editing.value = { ...skill, matchPhases: [...(skill.matchPhases || ['speech'])] }
}

function applyTemplate(template: (typeof templates)[number]) {
  editing.value = characterAgentService.createSkill(template)
}

function cancelEdit() {
  editing.value = null
}

function togglePhase(phase: MatchSkillPhase) {
  if (!editing.value) return
  const current = editing.value.matchPhases || []
  editing.value.matchPhases = current.includes(phase)
    ? current.filter((item) => item !== phase)
    : [...current, phase]
  if (!editing.value.matchPhases.length) editing.value.matchPhases = ['speech']
}

function phaseLabel(phases?: MatchSkillPhase[]): string {
  const list = phases?.length ? phases : (['speech'] as MatchSkillPhase[])
  return list.map((p) => MATCH_SKILL_PHASE_LABELS[p]).join('·')
}

async function saveEdit() {
  if (!editing.value?.name.trim()) {
    error.value = '技能名称不能为空'
    return
  }
  busy.value = true
  error.value = ''
  try {
    const saved = await characterAgentService.upsertSkill(props.character, editing.value)
    emit('updated', saved)
    editing.value = null
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    busy.value = false
  }
}

async function toggleEnabled(skill: CharacterAgentSkill) {
  busy.value = true
  error.value = ''
  try {
    const saved = await characterAgentService.upsertSkill(props.character, { ...skill, enabled: !skill.enabled })
    emit('updated', saved)
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    busy.value = false
  }
}

async function remove(skill: CharacterAgentSkill) {
  if (!(await confirm({
    title: '删除技能',
    message: `确定删除技能「${skill.name}」吗？`,
    tone: 'danger',
    confirmText: '删除',
  }))) return
  busy.value = true
  error.value = ''
  try {
    const saved = await characterAgentService.deleteSkill(props.character, skill.id)
    emit('updated', saved)
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="agent-panel">
    <header class="agent-panel__head" :class="{ 'agent-panel__head--toolbar': embedded }">
      <h3 v-if="!embedded"><Sparkles :size="16" /> 技能库</h3>
      <div class="agent-panel__actions">
        <span v-if="!embedded">{{ enabledCount }}/{{ skills.length }}</span>
        <button type="button" class="agent-btn primary" :disabled="busy" @click="startCreate">
          <Plus :size="14" /> 新建
        </button>
      </div>
    </header>

    <div v-if="!editing && templates.length" class="template-row">
      <Wand2 :size="13" />
      <button
        v-for="tpl in templates"
        :key="tpl.name"
        type="button"
        class="template-chip"
        @click="applyTemplate(tpl)"
      >
        {{ tpl.name }}
      </button>
    </div>

    <div v-if="editing" class="skill-editor">
      <div class="skill-editor__row">
        <input v-model="editing.name" type="text" placeholder="技能名称" />
        <select v-model="editing.scope">
          <option v-for="[value, label] in scopeOptions" :key="value" :value="value">{{ label }}</option>
        </select>
      </div>
      <input v-model="editing.description" type="text" placeholder="一句话摘要" />
      <div class="skill-editor__grid">
        <label>
          <span>触发时机</span>
          <textarea v-model="editing.triggerTiming" rows="2" />
        </label>
        <label>
          <span>触发效果</span>
          <textarea v-model="editing.triggerEffect" rows="2" />
        </label>
        <label>
          <span>对局效果</span>
          <textarea v-model="editing.matchEffect" rows="2" />
        </label>
        <label>
          <span>私聊要点</span>
          <textarea v-model="editing.instructions" rows="2" />
        </label>
      </div>
      <div class="skill-editor__phases">
        <span>对局阶段</span>
        <button
          v-for="[phase, label] in phaseOptions"
          :key="phase"
          type="button"
          class="phase-chip"
          :class="{ on: editing.matchPhases?.includes(phase) }"
          @click="togglePhase(phase)"
        >
          {{ label }}
        </button>
      </div>
      <label class="skill-editor__toggle">
        <input v-model="editing.enabled" type="checkbox" /> 启用
      </label>
      <div class="skill-editor__actions">
        <button type="button" class="agent-btn" @click="cancelEdit">取消</button>
        <button type="button" class="agent-btn primary" :disabled="busy" @click="saveEdit">保存</button>
      </div>
    </div>

    <div v-if="skills.length" class="skill-grid">
      <article v-for="skill in skills" :key="skill.id" class="skill-card" :class="{ off: !skill.enabled }">
        <header>
          <div>
            <strong>{{ skill.name }}</strong>
            <span>{{ AGENT_SKILL_SCOPE_LABELS[skill.scope || 'both'] }} · {{ phaseLabel(skill.matchPhases) }}</span>
          </div>
          <div class="skill-card__ops">
            <button type="button" @click="toggleEnabled(skill)">{{ skill.enabled ? '开' : '关' }}</button>
            <button type="button" @click="startEdit(skill)">编</button>
            <button type="button" @click="remove(skill)"><Trash2 :size="13" /></button>
          </div>
        </header>
        <dl class="skill-card__meta">
          <div><dt>时机</dt><dd>{{ skill.triggerTiming }}</dd></div>
          <div><dt>效果</dt><dd>{{ skill.triggerEffect }}</dd></div>
          <div v-if="skill.matchEffect"><dt>对局</dt><dd>{{ skill.matchEffect }}</dd></div>
        </dl>
      </article>
    </div>
    <DetailRegionEmpty v-else title="暂无技能" description="可从模板添加或自定义能力模块" :icon="Sparkles" hint="" />
    <p v-if="error" class="agent-error">{{ error }}</p>
  </section>
</template>

<style scoped>
.agent-panel {
  display: grid;
  gap: 12px;
}

.agent-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.agent-panel__head--toolbar {
  justify-content: flex-end;
}

.agent-panel__head h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 15px;
  color: #17205a;
}

.agent-panel__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #9aa3c7;
  font-size: 11px;
}

.template-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  color: #9aa3c7;
}

.template-chip {
  border: 1px solid rgba(112, 105, 255, 0.18);
  background: rgba(255, 255, 255, 0.65);
  color: #5b57f3;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
}

.skill-editor {
  display: grid;
  gap: 8px;
  padding: 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(112, 105, 255, 0.16);
}

.skill-editor__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 110px;
  gap: 8px;
}

.skill-editor input,
.skill-editor textarea,
.skill-editor select {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid rgba(112, 105, 255, 0.18);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.72);
  font: inherit;
  font-size: 12px;
}

.skill-editor__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.skill-editor__grid label {
  display: grid;
  gap: 4px;
}

.skill-editor__grid span {
  color: #9aa3c7;
  font-size: 10px;
  font-weight: 600;
}

.skill-editor__phases {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.skill-editor__phases > span {
  color: #9aa3c7;
  font-size: 10px;
  font-weight: 600;
}

.phase-chip {
  border: 1px solid rgba(112, 105, 255, 0.16);
  background: rgba(255, 255, 255, 0.72);
  color: #7a85b0;
  border-radius: 999px;
  padding: 3px 8px;
  font-size: 10px;
  cursor: pointer;
}

.phase-chip.on {
  background: rgba(112, 105, 255, 0.14);
  color: #5b57f3;
  border-color: rgba(91, 87, 243, 0.28);
}

.skill-editor__toggle {
  font-size: 12px;
  color: #5a6594;
}

.skill-editor__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.skill-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.skill-card {
  padding: 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(112, 105, 255, 0.1);
}

.skill-card.off {
  opacity: 0.62;
}

.skill-card header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.skill-card header strong {
  display: block;
  color: #17205a;
  font-size: 13px;
}

.skill-card header span {
  display: block;
  margin-top: 2px;
  color: #9aa3c7;
  font-size: 10px;
}

.skill-card__ops {
  display: flex;
  gap: 4px;
  flex: none;
}

.skill-card__ops button {
  border: none;
  background: transparent;
  color: #5b57f3;
  font-size: 11px;
  cursor: pointer;
}

.skill-card__meta {
  margin: 0;
  display: grid;
  gap: 4px;
}

.skill-card__meta div {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 4px;
}

.skill-card__meta dt {
  color: #9aa3c7;
  font-size: 10px;
  font-weight: 600;
}

.skill-card__meta dd {
  margin: 0;
  color: #59649b;
  font-size: 10px;
  line-height: 1.4;
}

.agent-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  border-radius: 10px;
  background: rgba(112, 105, 255, 0.12);
  color: #5b57f3;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.agent-btn.primary {
  background: linear-gradient(135deg, #7069ff, #5b57f3);
  color: #fff;
}

.agent-empty {
  margin: 0;
  color: #7a85b0;
  font-size: 12px;
}

.agent-error {
  margin: 0;
  color: #dc2626;
  font-size: 12px;
}

@media (max-width: 760px) {
  .skill-editor__grid,
  .skill-grid {
    grid-template-columns: 1fr;
  }
}
</style>
