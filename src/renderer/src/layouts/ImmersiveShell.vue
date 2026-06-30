<script setup lang="ts">
import { ArrowLeft, Bug, Download, FileQuestion, FolderOpen, Info, Minus, Plus, X } from 'lucide-vue-next'
import { computed, h, onMounted, onUnmounted, ref, watch } from 'vue'
import { goBack, navigate, route } from '../router'
import { portalPathForTab } from '../pages/settings/portal-routes'
import { isSidebarFooterGroup } from '../types/registry'
import WechatRechargeModal from '../components/billing/WechatRechargeModal.vue'
import SleepyCatWidget from '../components/support/SleepyCatWidget.vue'
import { useArenaWallet } from '../composables/useArenaWallet'
import { useClientUpdate } from '../composables/useClientUpdate'
import { confirm } from '../composables/useAppDialog'
import { userInfoRef } from '../services/auth'
import MarkdownContent from '../components/common/MarkdownContent.vue'
import { arenaHomeAssets } from '../data/arena-home-assets'
import type { FeatureRegistry } from '../types/registry'

const props = defineProps<{
  appName: string
  registry: FeatureRegistry
}>()

const {
  updateAvailable,
  checkingUpdate,
  checkAndDownloadUpdate,
  runInAppUpdate,
  refreshAvailability,
  startPolling,
  stopPolling,
} = useClientUpdate()

const showRecharge = ref(false)
const showDevAssets = ref(false)
const { balanceCents, formatBalance, refresh } = useArenaWallet()
const userName = computed(() => userInfoRef.value?.name || userInfoRef.value?.username || 'Agent Player')
const userEmail = computed(() => userInfoRef.value?.emailDisplay || '模型服务账户')
const userStatus = computed(() => (userInfoRef.value?.gatewayReady === false ? '网关待验证' : '网关已就绪'))

const backEntry = computed(() => {
  const name = route.value.name
  if (name === 'character-detail') {
    return { label: '返回角色库', path: '/characters' }
  }
  if (name === 'game-mode-detail') {
    return { label: '返回玩法场景', path: '/game-modes' }
  }
  if (name === 'create-match') {
    return { label: '返回玩法场景', path: '/game-modes' }
  }
  if (name === 'match-detail') {
    return { label: '返回对局记录', path: '/match-records' }
  }
  return null
})

const navItems = computed(() =>
  props.registry
    .filter((item) => item.group === 'main' || isSidebarFooterGroup(item.group))
    .sort((a, b) => a.order - b.order)
)

function isActive(path: string): boolean {
  const current = route.value.path.split('?')[0]
  if (path.startsWith('/settings')) {
    return current === '/settings' || current.startsWith('/settings/')
  }
  if (path.startsWith('/profile')) {
    return current === '/profile' || current.startsWith('/profile/')
  }
  return current === path || current.startsWith(`${path}/`)
}

function minimizeWindow() {
  void window.windowControls?.minimize()
}

function closeWindow() {
  void window.windowControls?.close?.()
}

function onRechargePaid() {
  showRecharge.value = false
  void refresh(true)
}

function openProfile() {
  navigate('/profile')
}

function openSettingsHelp(tab: 'support-version' | 'support-bug' | 'support-help') {
  navigate(portalPathForTab(tab))
}

async function onTitlebarUpdateClick() {
  const result = await checkAndDownloadUpdate()
  if (!result?.res?.hasUpdate || !result.res.downloadUrl || !result.res.latestVersion) return
  const notes = (result.res.releaseNotes || '').trim() || '暂无更新说明'
  const confirmed = await confirm({
    title: `发现新版本 ${result.res.latestVersion}`,
    message: '是否下载并安装？',
    detail: `当前版本：${result.res.currentVersion}`,
    content: () =>
      h('div', { class: 'arena-update-dialog' }, [h(MarkdownContent, { source: notes })]),
    confirmText: '下载并安装',
  })
  if (confirmed) {
    void runInAppUpdate(result.res.downloadUrl!, result.res.latestVersion!)
  }
}

watch(
  () => route.value.name,
  () => void refreshAvailability()
)

onMounted(async () => {
  startPolling()
  if (import.meta.env.DEV) {
    try {
      const res = await window.api.isDevAssetsAvailable()
      showDevAssets.value = Boolean(res.available)
    } catch {
      showDevAssets.value = false
    }
  }
})

onUnmounted(() => {
  stopPolling()
})

</script>

<template>
  <div class="arena-shell" :style="{ '--arena-bg-image': `url(${arenaHomeAssets.bgClean})` }">
    <nav class="arena-nav">
      <button v-if="backEntry" type="button" class="arena-brand arena-back" @click="goBack()">
        <span class="arena-back__icon"><ArrowLeft :size="22" /></span>
        <span>返回</span>
      </button>
      <button v-else type="button" class="arena-brand" @click="navigate('/home')">
        <img class="arena-brand__lockup" :src="arenaHomeAssets.brandLockup" alt="Manong Arena" />
      </button>

      <div class="arena-tabs" aria-label="主导航">
        <button
          v-for="item in navItems"
          :key="item.key"
          type="button"
          class="arena-tab"
          :class="{ 'arena-tab--active': isActive(item.path) }"
          @click="navigate(item.path)"
        >
          <component v-if="item.icon" :is="item.icon" :size="19" :stroke-width="2.35" />
          <span>{{ item.label }}</span>
        </button>
      </div>

      <div class="arena-actions">
        <button
          v-if="updateAvailable"
          type="button"
          class="arena-update-btn"
          aria-label="下载更新"
          title="下载更新"
          :disabled="checkingUpdate"
          @click="onTitlebarUpdateClick"
        >
          <Download :size="18" />
        </button>
        <button type="button" class="arena-balance" aria-label="余额充值" @click="showRecharge = true">
          <span>余额</span>
          <strong>{{ formatBalance(balanceCents) }}</strong>
          <span class="arena-balance__plus"><Plus :size="18" /></span>
        </button>
        <div class="arena-profile-wrap">
          <button type="button" class="arena-profile" aria-label="用户信息" @click="openProfile">
            <img :src="arenaHomeAssets.charGemini" alt="" />
            <span></span>
          </button>
          <div class="arena-profile-popover" role="dialog" aria-label="用户信息">
            <div class="arena-profile-popover__head">
              <img :src="arenaHomeAssets.charGemini" alt="" />
              <div>
                <strong>{{ userName }}</strong>
                <span>{{ userEmail }}</span>
              </div>
            </div>
            <div class="arena-profile-popover__status">
              <i></i>
              {{ userStatus }}
            </div>
          </div>
        </div>
        <div class="arena-window-controls" aria-label="窗口控制">
          <button type="button" class="arena-window-btn" aria-label="最小化" @click="minimizeWindow">
            <Minus :size="20" />
          </button>
          <button type="button" class="arena-window-btn arena-window-btn--close" aria-label="关闭" @click="closeWindow">
            <X :size="20" />
          </button>
        </div>
      </div>
    </nav>

    <main class="arena-content">
      <slot />
    </main>

    <footer class="arena-footer">
      <div class="arena-footer__left">
        <div class="arena-footer__version">
          <img :src="arenaHomeAssets.mascotCat" alt="" />
          <span>Agent Arena v0.1.1</span>
        </div>
        <div class="arena-footer__links" aria-label="底部信息">
          <button
            v-if="showDevAssets"
            type="button"
            class="arena-footer__link-btn"
            @click="navigate('/dev-assets')"
          >
            <FolderOpen :size="16" />
            素材管理
          </button>
          <button type="button" class="arena-footer__link-btn" @click="openSettingsHelp('support-version')">
            <Info :size="17" />
            版本说明
          </button>
          <button type="button" class="arena-footer__link-btn" @click="openSettingsHelp('support-bug')">
            <Bug :size="17" />
            报 bug
          </button>
          <button type="button" class="arena-footer__link-btn" @click="openSettingsHelp('support-help')">
            <FileQuestion :size="17" />
            帮助
          </button>
        </div>
      </div>
      <SleepyCatWidget />
    </footer>

    <WechatRechargeModal v-model="showRecharge" @paid="onRechargePaid" />
  </div>
</template>

<style>
.arena-shell {
  --arena-ink: #121b53;
  --arena-muted: #59669a;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
  display: grid;
  grid-template-rows: 72px minmax(0, 1fr) 50px;
  color: var(--arena-ink);
  background:
    linear-gradient(90deg, rgba(245, 248, 255, 0.2) 0%, rgba(241, 240, 255, 0.34) 52%, rgba(237, 244, 255, 0.18) 100%),
    var(--arena-bg-image) center / cover no-repeat,
    linear-gradient(140deg, #f3edff 0%, #dbe9ff 52%, #f9e7ff 100%);
  font-family:
    'Source Han Sans SC',
    'Source Han Sans CN',
    'Noto Sans SC',
    'PingFang SC',
    'Microsoft YaHei UI',
    system-ui,
    sans-serif;
}

.arena-shell *,
.arena-shell *::before,
.arena-shell *::after {
  box-sizing: border-box;
}

.arena-shell button {
  font: inherit;
}

.arena-shell button:focus-visible {
  outline: 3px solid rgba(99, 91, 255, 0.28);
  outline-offset: 3px;
}

.arena-nav {
  position: relative;
  z-index: 10;
  display: grid;
  grid-template-columns: 274px minmax(540px, 1fr) 328px;
  align-items: center;
  padding: 0 18px;
  background: rgba(239, 242, 255, 0.69);
  border-bottom: 1px solid rgba(255, 255, 255, 0.64);
  box-shadow: 0 12px 34px rgba(100, 112, 190, 0.08);
  backdrop-filter: blur(22px);
  -webkit-app-region: drag;
}

.arena-nav button {
  -webkit-app-region: no-drag;
}

.arena-brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  width: fit-content;
  border: 0;
  background: transparent;
  color: #18205a;
  font-size: 22px;
  font-weight: 680;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    filter 0.18s ease;
}

.arena-brand:hover {
  transform: translateY(-1px);
  filter: drop-shadow(0 8px 14px rgba(86, 91, 190, 0.16));
}

.arena-brand:active {
  transform: translateY(0) scale(0.985);
}

.arena-brand__mascot {
  flex: 0 0 auto;
  width: 46px;
  height: 46px;
  border-radius: 15px;
  object-fit: cover;
  object-position: center;
  box-shadow:
    inset 0 0 0 2px rgba(255, 255, 255, 0.52),
    0 9px 16px rgba(66, 79, 159, 0.2);
}

.arena-brand__lockup {
  display: block;
  width: 230px;
  height: 54px;
  object-fit: contain;
  object-position: left center;
  filter: drop-shadow(0 8px 16px rgba(66, 79, 159, 0.12));
}

.arena-back {
  gap: 10px;
  padding: 0 18px 0 10px;
  height: 46px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.62);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    0 10px 20px rgba(86, 91, 190, 0.1);
  font-size: 16px;
  font-weight: 560;
}

.arena-back__icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  color: #fff;
  background: linear-gradient(180deg, #817cff, #5c57ef);
  box-shadow: 0 8px 14px rgba(89, 77, 228, 0.2);
  transition: transform 0.2s ease;
}

.arena-back:hover .arena-back__icon {
  transform: translateX(-2px);
}

.arena-tabs {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: 0;
}

.arena-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 44px;
  min-width: 90px;
  padding: 0 12px;
  border: 0;
  border-radius: 24px;
  background: transparent;
  color: #283166;
  font-size: 14px;
  font-weight: 560;
  cursor: pointer;
  transition:
    color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.arena-tab:not(:last-child)::after {
  content: '';
  position: absolute;
  right: -6px;
  top: 13px;
  width: 1px;
  height: 20px;
  background: rgba(91, 103, 174, 0.2);
}

.arena-tab--active {
  color: #3f3bea;
  background: rgba(255, 255, 255, 0.86);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.95),
    0 14px 26px rgba(86, 91, 190, 0.12);
}

.arena-tab:hover {
  color: #4542f0;
  background: rgba(255, 255, 255, 0.54);
  transform: translateY(-1px);
}

.arena-tab:active {
  transform: translateY(0) scale(0.985);
}

.arena-actions {
  display: flex;
  align-items: center;
  justify-self: end;
  gap: 10px;
  min-width: 0;
}

.arena-update-btn {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: #fff;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(79, 70, 229, 0.28);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    opacity 0.18s ease;
}

.arena-update-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(79, 70, 229, 0.34);
}

.arena-update-btn:active:not(:disabled) {
  transform: translateY(0) scale(0.96);
}

.arena-update-btn:disabled {
  opacity: 0.7;
  cursor: wait;
}

.arena-balance {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  min-width: 142px;
  padding: 0 8px 0 15px;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.84);
  color: #1c255c;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92);
  cursor: pointer;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}

.arena-balance:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.95),
    0 10px 18px rgba(86, 91, 190, 0.12);
}

.arena-balance:active {
  transform: translateY(0) scale(0.985);
}

.arena-balance:hover .arena-balance__plus {
  transform: rotate(90deg) scale(1.06);
}

.arena-balance span:first-child {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}

.arena-balance strong {
  font-size: 16px;
  font-weight: 700;
}

.arena-balance__plus {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  color: #fff;
  border-radius: 50%;
  background: linear-gradient(180deg, #9a95ff, #625cf0);
  box-shadow: 0 8px 14px rgba(89, 77, 228, 0.22);
  transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}

.arena-profile-wrap {
  position: relative;
  -webkit-app-region: no-drag;
}

.arena-profile {
  position: relative;
  width: 46px;
  height: 46px;
  border: 0;
  border-radius: 50%;
  padding: 2px;
  background: linear-gradient(180deg, #fff, #e9e6ff);
  box-shadow: 0 9px 16px rgba(71, 71, 150, 0.14);
  cursor: pointer;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.arena-profile::before {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 1px solid rgba(106, 94, 255, 0);
  transition:
    border-color 0.2s ease,
    transform 0.2s ease;
}

.arena-profile::after {
  content: '';
  position: absolute;
  inset: -7px;
  border-radius: 50%;
  background: conic-gradient(from 20deg, transparent, rgba(113, 103, 255, 0.34), transparent 42%);
  opacity: 0;
  transform: scale(0.8) rotate(0deg);
  transition:
    opacity 0.24s ease,
    transform 0.34s cubic-bezier(0.16, 1, 0.3, 1);
}

.arena-profile:hover {
  transform: translateY(-1px) scale(1.04);
  box-shadow: 0 12px 22px rgba(71, 71, 150, 0.2);
}

.arena-profile:hover::before {
  border-color: rgba(106, 94, 255, 0.28);
  transform: scale(1.08);
}

.arena-profile:hover::after {
  opacity: 1;
  transform: scale(1) rotate(35deg);
}

.arena-profile img {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.arena-profile span {
  position: absolute;
  right: 1px;
  bottom: 5px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #1ecb6f;
  border: 2px solid white;
  z-index: 2;
}

.arena-profile-popover {
  position: absolute;
  top: 58px;
  right: -42px;
  width: 230px;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 20px;
  background: rgba(251, 252, 255, 0.86);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 22px 44px rgba(72, 82, 154, 0.18);
  backdrop-filter: blur(24px) saturate(1.2);
  opacity: 0;
  pointer-events: none;
  transform: translateY(-8px) scale(0.96);
  transform-origin: 78% top;
  transition:
    opacity 0.2s ease,
    transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}

.arena-profile-popover::before {
  content: '';
  position: absolute;
  top: -16px;
  right: 44px;
  width: 92px;
  height: 18px;
}

.arena-profile-wrap:hover .arena-profile-popover,
.arena-profile-wrap:focus-within .arena-profile-popover {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0) scale(1);
}

.arena-profile-popover__head {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
}

.arena-profile-popover__head img {
  width: 46px;
  height: 46px;
  border-radius: 16px;
  object-fit: cover;
  box-shadow: 0 10px 18px rgba(86, 91, 190, 0.14);
}

.arena-profile-popover__head strong {
  display: block;
  overflow: hidden;
  color: #151e57;
  font-size: 15px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arena-profile-popover__head span {
  display: block;
  overflow: hidden;
  margin-top: 3px;
  color: #65709f;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arena-profile-popover__status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 28px;
  margin: 12px 0;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(35, 198, 121, 0.1);
  color: #1a9a61;
  font-size: 12px;
  font-weight: 520;
}

.arena-profile-popover__status i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #21c77a;
  box-shadow: 0 0 0 4px rgba(33, 199, 122, 0.12);
}


.arena-window-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-left: 14px;
  border-left: 1px solid rgba(91, 103, 174, 0.22);
}

.arena-window-btn {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #273060;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    transform 0.15s ease;
}

.arena-window-btn:hover {
  background: rgba(255, 255, 255, 0.72);
  transform: translateY(-1px);
}

.arena-window-btn:active {
  transform: translateY(0) scale(0.92);
}

.arena-window-btn--close:hover {
  color: white;
  background: #f35f7d;
}

.arena-content {
  position: relative;
  z-index: 2;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.arena-content::-webkit-scrollbar {
  display: none;
}

.arena-footer {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  padding: 0 32px;
  overflow: visible;
  background: rgba(248, 249, 255, 0.38);
  border-top: 1px solid rgba(255, 255, 255, 0.72);
  box-shadow: 0 -10px 26px rgba(97, 105, 181, 0.06);
  backdrop-filter: blur(18px);
}

.arena-footer__left {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.arena-footer__version {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  color: #65709f;
  font-size: 12px;
  font-weight: 500;
}

.arena-footer__version img {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  object-fit: cover;
  box-shadow: 0 6px 10px rgba(61, 78, 158, 0.14);
}

.arena-footer__links {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}

.arena-footer__link-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 30px;
  padding: 0 11px;
  border: 1px solid rgba(132, 142, 204, 0.14);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.38);
  color: #586397;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    color 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease;
}

.arena-footer__link-btn:hover {
  transform: translateY(-1px);
  color: #4f4bf1;
  border-color: rgba(103, 98, 240, 0.24);
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 10px 18px rgba(86, 91, 190, 0.1);
}
</style>
