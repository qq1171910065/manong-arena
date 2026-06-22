export { getApiBaseUrl, getDefaultApiBaseUrl, saveApiBaseUrlFromInput, API_BASE_URL_STORAGE_KEY } from './config'
export { isSuccessBusinessCode, parseCoolApiEnvelope, refreshSessionFromStorage } from './api'
export type { RefreshSessionResult, ApiResponse } from './api'
export {
  portalApi,
  getPortalSession,
  setPortalSession,
  isPortalLoggedIn,
  fetchPlatformPing,
} from './portal-api'
export type {
  PortalSession,
  PortalProfile,
  PortalOAuthBinding,
  PortalUserKey,
  PortalUsageRecord,
  PortalRechargeTier,
  PortalRechargeClientConfig,
  PortalRechargeWechatOrder,
  PortalRechargeOrderStatus,
  PortalRechargeRecord,
  PortalWalletSummary,
  PortalLicenseRecord,
  PortalTicketRecord,
} from './portal-api'
export { authApi, userInfoRef, getCurrentUserContext, setUserInfoCache } from './auth'
export type { UserInfo, LoginResult, OfficeWechatPollResult, OAuthBindPollResult } from './auth'
export { completeAuthSession, resolveAuthPhase, performAuthLogout } from './auth-session'
export {
  ensureGatewayKey,
  getAppKeyName,
  gatewayChatCompletion,
  gatewayChatStream,
  gatewayChatStreamCollect,
  listGatewayModelIds,
  listGatewayModels,
  testGatewayModel,
  testGatewayConnectivity,
  resolveGatewayEndpoints,
  getGatewayRootUrl,
  getGatewayBaseUrl,
  getStoredGatewayKey,
  setStoredGatewayKey,
  clearStoredGatewayKey,
  invalidateGatewayModelCache,
} from './gateway-api'
export type {
  GatewayEndpointConfig,
  GatewayModelInfo,
  ModelTestResult,
  GatewayConnectivityReport,
  GatewayChatResult,
  GatewayTokenUsage,
  StreamChatHandlers,
} from './gateway-api'
export type { PortalGatewayConfig } from './portal-api'
export {
  aggregateAgentLabs,
  buildSignalLeaders,
  formatAgentMetric,
  AGENT_SIGNAL_LABELS,
  getAgentLeaderboard,
  syncAgentLeaderboard,
  isLeaderboardCacheStale,
  getCachedAgentLeaderboard,
} from './arena-leaderboard-api'
export type {
  AgentSignalMetric,
  AgentSignalKey,
  AgentSignalLeader,
  ArenaAgentModelEntry,
  ArenaAgentLabEntry,
  ArenaAgentLeaderboard,
} from './arena-leaderboard-api'
export * from './arena'
