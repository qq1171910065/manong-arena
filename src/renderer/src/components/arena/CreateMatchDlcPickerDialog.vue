<script setup lang="ts">
import { computed } from 'vue'
import { Check } from 'lucide-vue-next'
import ArenaDialogShell from '@renderer/components/common/ArenaDialogShell.vue'
import {
  werewolfExpansionGroups,
  werewolfRuleModuleGroups,
  WEREWOLF_EXPANSION_ROLES,
  WEREWOLF_RULE_MODULES,
  type WerewolfExpansionRoleId,
  type WerewolfRuleModuleId,
} from '@shared/arena/werewolf-dlc'

const props = defineProps<{
  playerCount: number
}>()

const open = defineModel<boolean>('open', { default: false })
const enabled = defineModel<WerewolfExpansionRoleId[]>('enabled', { default: () => [] })
const enabledRules = defineModel<WerewolfRuleModuleId[]>('enabledRules', { default: () => [] })

const groups = werewolfExpansionGroups()
const ruleGroups = werewolfRuleModuleGroups()
const enabledNames = computed(() => {
  const roles = WEREWOLF_EXPANSION_ROLES.filter((role) => enabled.value.includes(role.id)).map((role) => role.name)
  const rules = WEREWOLF_RULE_MODULES.filter((item) => enabledRules.value.includes(item.id)).map((item) => item.name)
  return [...roles, ...rules].join(' · ')
})

function isOn(id: WerewolfExpansionRoleId) {
  return enabled.value.includes(id)
}
function toggle(id: WerewolfExpansionRoleId) {
  const role = WEREWOLF_EXPANSION_ROLES.find((entry) => entry.id === id)
  if (!role || props.playerCount < role.minPlayers) return
  if (isOn(id)) enabled.value = enabled.value.filter((item) => item !== id)
  else enabled.value = [...enabled.value, id]
}
function isRuleOn(id: WerewolfRuleModuleId) {
  return enabledRules.value.includes(id)
}
function toggleRule(id: WerewolfRuleModuleId) {
  if (isRuleOn(id)) enabledRules.value = enabledRules.value.filter((item) => item !== id)
  else enabledRules.value = [...enabledRules.value, id]
}
</script>

<template>
  <ArenaDialogShell
    v-model="open"
    title="逐个选择扩展身份"
    :subtitle="enabledNames || '未启用扩展'"
    variant="preview"
    size="md"
  >
    <div class="picker-body">
      <section v-for="group in groups" :key="group.label" class="expansion-group">
        <header>{{ group.label }}</header>
        <button
          v-for="role in group.roles"
          :key="role.id"
          type="button"
          class="role-option"
          :class="{ active: isOn(role.id), disabled: playerCount < role.minPlayers }"
          :disabled="playerCount < role.minPlayers"
          @click="toggle(role.id)"
        >
          <span class="check"><Check v-if="isOn(role.id)" :size="14" /></span>
          <div>
            <b>{{ role.name }}</b>
            <em>{{ role.desc }}</em>
            <small v-if="playerCount < role.minPlayers">{{ role.minPlayers }} 人局起可用</small>
          </div>
        </button>
      </section>
      <section v-for="group in ruleGroups" :key="group.label" class="expansion-group">
        <header>{{ group.label }}</header>
        <button
          v-for="rule in group.modules"
          :key="rule.id"
          type="button"
          class="role-option"
          :class="{ active: isRuleOn(rule.id) }"
          @click="toggleRule(rule.id)"
        >
          <span class="check"><Check v-if="isRuleOn(rule.id)" :size="14" /></span>
          <div>
            <b>{{ rule.name }}</b>
            <em>{{ rule.desc }}</em>
          </div>
        </button>
      </section>
    </div>
  </ArenaDialogShell>
</template>

<style scoped>
.picker-body {
  display: grid;
  gap: 14px;
}

.expansion-group header {
  margin-bottom: 8px;
  color: #756d99;
  font-size: 12px;
  font-weight: 650;
}

.role-option {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  width: 100%;
  margin-bottom: 8px;
  padding: 10px 12px;
  border: 1px solid rgba(126, 99, 255, 0.1);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.54);
  text-align: left;
  cursor: pointer;
}

.role-option.active {
  border-color: rgba(126, 99, 255, 0.42);
  background: rgba(126, 99, 255, 0.08);
}

.role-option.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.role-option .check {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: rgba(126, 99, 255, 0.12);
  color: #5b58f7;
}

.role-option b {
  display: block;
  color: #1b1856;
  font-size: 14px;
}

.role-option em {
  display: block;
  margin-top: 4px;
  color: #756d99;
  font-size: 12px;
  font-style: normal;
  line-height: 1.45;
}

.role-option small {
  display: block;
  margin-top: 4px;
  color: #c2410c;
  font-size: 11px;
}
</style>
