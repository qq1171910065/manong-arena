<script setup lang="ts">
import { computed } from 'vue'
import { Check, X } from 'lucide-vue-next'
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
  <Teleport to="body">
    <div v-if="open" class="picker-backdrop" @click.self="open = false">
      <div class="picker-dialog" role="dialog" aria-modal="true" aria-label="身份扩展">
        <header class="picker-head">
          <div>
            <span>身份扩展</span>
            <h2>逐个选择扩展身份</h2>
            <p>{{ enabledNames || '未启用扩展' }}</p>
          </div>
          <button type="button" class="close-btn" aria-label="关闭" @click="open = false"><X :size="18" /></button>
        </header>
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
            <p class="rule-hint">白天放逐默认允许遗言；以下模块控制其他出局场景的遗言。</p>
            <button
              v-for="module in group.modules"
              :key="module.id"
              type="button"
              class="role-option"
              :class="{ active: isRuleOn(module.id) }"
              @click="toggleRule(module.id)"
            >
              <span class="check"><Check v-if="isRuleOn(module.id)" :size="14" /></span>
              <div>
                <b>{{ module.name }}</b>
                <em>{{ module.desc }}</em>
              </div>
            </button>
          </section>
        </div>
        <footer class="picker-foot">
          <button type="button" @click="open = false">完成</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(22, 18, 52, 0.42);
  backdrop-filter: blur(8px);
}
.picker-dialog {
  width: min(500px, 100%);
  max-height: min(80vh, 680px);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  border-radius: 24px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.92), rgba(249, 247, 255, 0.88));
  border: 1px solid rgba(255, 255, 255, 0.82);
  box-shadow: 0 28px 64px rgba(84, 68, 160, 0.22);
}
.picker-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 18px 10px;
}
.picker-head span {
  color: #8077a5;
  font-size: 12px;
  font-weight: 650;
}
.picker-head h2 {
  margin: 5px 0 4px;
  color: #151550;
  font-size: 22px;
}
.picker-head p {
  margin: 0;
  color: #756d99;
  font-size: 12px;
}
.close-btn {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(126, 99, 255, 0.12);
  border-radius: 12px;
  color: #5e52d8;
  background: rgba(255, 255, 255, 0.62);
  cursor: pointer;
}
.picker-body {
  min-height: 0;
  overflow: auto;
  padding: 0 18px 12px;
  display: grid;
  gap: 14px;
}
.expansion-group header {
  margin-bottom: 8px;
  color: #5e55a3;
  font-size: 12px;
  font-weight: 700;
}
.rule-hint {
  margin: 0 0 10px;
  color: #8a82ad;
  font-size: 11px;
  line-height: 1.45;
}
.role-option {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  width: 100%;
  margin-bottom: 8px;
  padding: 11px 12px;
  border: 1px solid rgba(126, 99, 255, 0.11);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.54);
  text-align: left;
  cursor: pointer;
}
.role-option.active {
  border-color: rgba(126, 99, 255, 0.42);
  background: rgba(126, 99, 255, 0.08);
}
.role-option.disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.check {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  border: 1px solid rgba(126, 99, 255, 0.18);
  color: #fff;
  background: rgba(255, 255, 255, 0.72);
}
.role-option.active .check {
  border-color: transparent;
  background: linear-gradient(135deg, #8d6bff, #5b58f7);
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
  line-height: 1.4;
}
.role-option small {
  display: block;
  margin-top: 5px;
  color: #b06a88;
  font-size: 11px;
}
.picker-foot {
  padding: 0 18px 18px;
}
.picker-foot button {
  width: 100%;
  height: 44px;
  border: 0;
  border-radius: 16px;
  color: #fff;
  background: linear-gradient(135deg, #8d6bff, #5b58f7);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}
</style>
