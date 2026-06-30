<script setup lang="ts">
import { inject } from 'vue'
import AppKeyPanel from '@renderer/components/settings/AppKeyPanel.vue'
import ArenaSettingsShell from '@renderer/components/settings/ArenaSettingsShell.vue'
import AudioSettingsPanel from '@renderer/components/settings/AudioSettingsPanel.vue'
import BugReportPanel from '@renderer/components/settings/BugReportPanel.vue'
import DataSettingsPanel from '@renderer/components/settings/DataSettingsPanel.vue'
import DisplaySettingsPanel from '@renderer/components/settings/DisplaySettingsPanel.vue'
import HelpChatPanel from '@renderer/components/settings/HelpChatPanel.vue'
import LeaderboardPanel from '@renderer/components/settings/LeaderboardPanel.vue'
import MatchSettingsPanel from '@renderer/components/settings/MatchSettingsPanel.vue'
import ModelDebugPanel from '@renderer/components/settings/ModelDebugPanel.vue'
import ModelOverviewPanel from '@renderer/components/settings/ModelOverviewPanel.vue'
import ModelServiceShell from '@renderer/components/settings/ModelServiceShell.vue'
import ModelStreamPanel from '@renderer/components/settings/ModelStreamPanel.vue'
import ProjectDocsPanel from '@renderer/components/settings/ProjectDocsPanel.vue'
import SecurityPanel from '@renderer/components/settings/SecurityPanel.vue'
import UsagePanel from '@renderer/components/settings/UsagePanel.vue'
import UserProfilePanel from '@renderer/components/settings/UserProfilePanel.vue'
import UserStatsPanel from '@renderer/components/settings/UserStatsPanel.vue'
import VersionNotesPanel from '@renderer/components/settings/VersionNotesPanel.vue'
import WalletPanel from '@renderer/components/settings/WalletPanel.vue'
import { isModelServiceTab, isSettingsTab, type PortalTab } from './portal-routes'
import { PORTAL_SHELL_KEY } from './portal-shell'

defineProps<{
  tab: PortalTab
}>()

const shell = inject(PORTAL_SHELL_KEY)!
const {
  profile,
  displayName,
  avatarUrl,
  gatewayReady,
  activeKeysCount,
  keys,
  appKeyPlain,
  oauthBindings,
  wallet,
  balancePoints,
  usageColumns,
  tickets,
  loading,
  rechargeConfig,
  rechargeReady,
  rechargeRecords,
  rechargeLoading,
  rechargeColumns,
  rechargePagination,
  appKeyName,
  appDisplayName,
  appSoftwareKey,
  newKeyPlain,
  creatingAppKey,
  usage,
  usageLoading,
  usagePagination,
  usagePageSummary,
  usageChartOption,
  accountDetails,
  securityItems,
  bindEmail,
  bindCode,
  bindSending,
  bindSubmitting,
  bindCountdown,
  arenaSettings,
  arenaSettingsSaving,
  settingsTabMeta,
  boolOptions,
  identityModeOptions,
  retentionDayOptions,
} = shell
</script>

<template>
  <div class="portal-tab-view">
    <UserProfilePanel
      v-if="tab === 'overview'"
      :profile="profile"
      :display-name="displayName"
      :avatar-url="avatarUrl"
      :gateway-ready="gatewayReady"
      :active-keys-count="activeKeysCount"
      :has-local-key="Boolean(appKeyPlain)"
      :wechat-bound="oauthBindings.some((item) => item.channel === 'wechat' && item.bound)"
      :wallet="wallet"
      :balance-points="balancePoints"
      @update-profile="shell.updateLocalProfile($event)"
    />

    <UserStatsPanel v-else-if="tab === 'user-stats'" />

    <SecurityPanel
      v-else-if="tab === 'security'"
      :account-details="accountDetails"
      :security-items="securityItems"
      :oauth-bindings="oauthBindings"
      :needs-email-bind="Boolean(profile?.needsEmailBind || profile?.emailVerified === false)"
      v-model:bind-email="bindEmail"
      v-model:bind-code="bindCode"
      :bind-sending="bindSending"
      :bind-submitting="bindSubmitting"
      :bind-countdown="bindCountdown"
      @send-bind-code="shell.sendBindCode()"
      @submit-bind-email="shell.submitBindEmail()"
      @unbind-oauth="(channel, label) => shell.unbindOAuth(channel, label)"
      @open-oauth-bind="shell.openOAuthBind($event)"
    />

    <VersionNotesPanel v-else-if="tab === 'support-version'" />

    <BugReportPanel
      v-else-if="tab === 'support-bug'"
      :tickets="tickets"
      :loading="loading"
      :on-submit="shell.handleBugSubmit"
    />

    <HelpChatPanel v-else-if="tab === 'support-help'" class="portal-help-chat" />

    <ProjectDocsPanel v-else-if="tab === 'support-docs'" />

    <AppKeyPanel
      v-else-if="tab === 'keys'"
      :app-key-name="appKeyName"
      :keys="keys"
      :app-key="appSoftwareKey"
      :key-plain="appKeyPlain"
      :new-key-plain="newKeyPlain"
      :creating="creatingAppKey"
      :loading="loading"
      @create="shell.createAppKey()"
      @copy-key="shell.copyNewAppKey()"
    />

    <WalletPanel
      v-else-if="tab === 'wallet'"
      :wallet="wallet"
      :balance-points="balancePoints"
      :recharge-config="rechargeConfig"
      :recharge-ready="rechargeReady"
      :recharge-records="rechargeRecords"
      :recharge-loading="rechargeLoading"
      :recharge-columns="rechargeColumns"
      :recharge-pagination="rechargePagination"
      @recharge="shell.openWechatRecharge"
      @page-change="shell.onRechargePageChange"
      @page-size-change="shell.onRechargePageSizeChange"
    />

    <LeaderboardPanel v-else-if="tab === 'model-leaderboard'" />

    <ModelServiceShell v-else-if="isModelServiceTab(tab)">
      <ModelOverviewPanel v-if="tab === 'model-overview'" />
      <ModelDebugPanel v-else-if="tab === 'model-debug'" />
      <ModelStreamPanel v-else-if="tab === 'model-stream'" />
    </ModelServiceShell>

    <ArenaSettingsShell
      v-else-if="isSettingsTab(tab)"
      :title="settingsTabMeta[tab].title"
      :desc="settingsTabMeta[tab].desc"
      :saving="arenaSettingsSaving"
      @reset="shell.resetArenaSettings()"
    >
      <DisplaySettingsPanel
        v-if="tab === 'settings-display'"
        :settings="arenaSettings"
        @update="(key, value) => shell.setArenaSetting(key, value)"
      />

      <AudioSettingsPanel
        v-else-if="tab === 'settings-audio'"
        :settings="arenaSettings"
        :bool-options="boolOptions"
        @update="(key, value) => shell.setArenaSetting(key, value)"
        @match-default="(key, value) => shell.setMatchDefault(key, value)"
        @save="shell.saveArenaSettings()"
      />

      <MatchSettingsPanel
        v-else-if="tab === 'settings-match'"
        :settings="arenaSettings"
        :bool-options="boolOptions"
        :identity-mode-options="identityModeOptions"
        @update="(key, value) => shell.setArenaSetting(key, value)"
        @match-default="(key, value) => shell.setMatchDefault(key, value)"
        @evolution="(key, value) => shell.setCharacterEvolution(key, value)"
        @save="shell.saveArenaSettings()"
      />

      <DataSettingsPanel
        v-else-if="tab === 'settings-data'"
        :settings="arenaSettings"
        :bool-options="boolOptions"
        :retention-day-options="retentionDayOptions"
        @update="(key, value) => shell.setArenaSetting(key, value)"
        @error="(msg) => msg && shell.message.error(msg)"
      />
    </ArenaSettingsShell>

    <UsagePanel
      v-else-if="tab === 'usage'"
      :usage="usage"
      :usage-loading="usageLoading"
      :usage-columns="usageColumns"
      :usage-pagination="usagePagination"
      :usage-page-summary="usagePageSummary"
      :usage-chart-option="usageChartOption"
      @page-change="shell.onUsagePageChange"
      @page-size-change="shell.onUsagePageSizeChange"
    />
  </div>
</template>

<style scoped>
.portal-tab-view {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.portal-help-chat {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
