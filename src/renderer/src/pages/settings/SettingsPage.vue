<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { HelpCircle, Info, Loader2, Lock, RotateCcw, Settings, Shield } from 'lucide-vue-next'
import ArenaPageShell from '@renderer/components/arena/ArenaPageShell.vue'
import ArenaPageState from '@renderer/components/arena/ArenaPageState.vue'
import { navigate } from '../../router'
import { formatUserMessage, settingsService } from '@renderer/services/arena'
import { applyTheme, getStoredThemeId } from '../../composables/useTheme'
import type { ArenaSettings } from '@shared/arena/types'

const activeSection = ref('settings')
const settings = ref<ArenaSettings>(settingsService.defaults())
const loading = ref(true)
const saving = ref(false)
const error = ref('')

const sections = [
  { id: 'settings', label: '设置', icon: Settings },
  { id: 'account', label: '账号与安全', icon: Lock },
  { id: 'about', label: '关于我们', icon: Info },
  { id: 'help', label: '帮助与反馈', icon: HelpCircle },
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    settings.value = await settingsService.get()
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  saving.value = true
  error.value = ''
  try {
    settings.value = await settingsService.save(settings.value)
    if (settings.value.themeMode === 'dark') applyTheme('enterprise-dark', 'enterprise-light')
    else if (settings.value.themeMode === 'light') applyTheme('enterprise-light', 'enterprise-light')
    else applyTheme(getStoredThemeId('enterprise-light'), 'enterprise-light')
  } catch (err) {
    console.warn(formatUserMessage(err))
  } finally {
    saving.value = false
  }
}

async function resetSettings() {
  saving.value = true
  error.value = ''
  try {
    settings.value = await settingsService.save(settingsService.defaults())
    if (settings.value.themeMode === 'dark') applyTheme('enterprise-dark', 'enterprise-light')
    else applyTheme('enterprise-light', 'enterprise-light')
  } catch (err) {
    console.warn(formatUserMessage(err))
  } finally {
    saving.value = false
  }
}

function toggle(key: keyof ArenaSettings) {
  const value = settings.value[key]
  if (typeof value === 'boolean') {
    ;(settings.value[key] as boolean) = !value
    void saveSettings()
  }
}

onMounted(() => {
  void load()
})
</script>

<template>
  <ArenaPageShell class="settings-page">
    <ArenaPageState :loading="loading" :error="error || undefined" skeleton="settings" loading-label="加载设置..." @retry="load">
      <section class="settings-layout">
      <aside class="settings-nav">
        <button
          v-for="section in sections"
          :key="section.id"
          type="button"
          :class="{ active: activeSection === section.id }"
          @click="activeSection = section.id"
        >
          <component :is="section.icon" :size="25" />
          {{ section.label }}
        </button>
      </aside>

      <main class="settings-content">
        <p v-if="error" class="settings-error">{{ error }}</p>

        <template v-if="activeSection === 'settings'">
          <section class="settings-group">
            <h2>显示</h2>
            <div class="setting-row">
              <div>
                <strong>主题模式</strong>
                <span>选择你喜欢的界面主题</span>
              </div>
              <select v-model="settings.themeMode" @change="saveSettings">
                <option value="light">浅色模式</option>
                <option value="dark">深色模式</option>
                <option value="system">跟随系统</option>
              </select>
            </div>
            <div class="setting-row">
              <div>
                <strong>界面缩放</strong>
                <span>调整界面元素大小</span>
              </div>
              <select v-model="settings.uiScale" @change="saveSettings">
                <option :value="100">100%（推荐）</option>
                <option :value="125">125%</option>
                <option :value="150">150%</option>
              </select>
            </div>
            <div class="setting-row">
              <div>
                <strong>动画效果</strong>
                <span>开启后将展示界面动画效果</span>
              </div>
              <button class="switch" :class="{ active: settings.animationEnabled }" @click="toggle('animationEnabled')"></button>
            </div>
          </section>

          <section class="settings-group">
            <h2>音效</h2>
            <div class="setting-row">
              <div>
                <strong>背景音乐</strong>
                <span>开启或关闭背景音乐</span>
              </div>
              <button class="switch" :class="{ active: settings.bgmEnabled }" @click="toggle('bgmEnabled')"></button>
            </div>
            <div class="setting-row">
              <div>
                <strong>音效</strong>
                <span>开启或关闭界面音效</span>
              </div>
              <button class="switch" :class="{ active: settings.sfxEnabled }" @click="toggle('sfxEnabled')"></button>
            </div>
            <div class="setting-row">
              <div>
                <strong>音乐音量</strong>
                <span>调整背景音乐音量</span>
              </div>
              <input v-model.number="settings.bgmVolume" type="range" min="0" max="100" @change="saveSettings" />
              <b>{{ settings.bgmVolume }}%</b>
            </div>
            <div class="setting-row">
              <div>
                <strong>音效音量</strong>
                <span>调整音效音量</span>
              </div>
              <input v-model.number="settings.sfxVolume" type="range" min="0" max="100" @change="saveSettings" />
              <b>{{ settings.sfxVolume }}%</b>
            </div>
          </section>

          <section class="settings-group">
            <h2>对局</h2>
            <div class="setting-row">
              <div>
                <strong>默认出场角色</strong>
                <span>新建对局时的默认出场角色</span>
              </div>
              <select v-model="settings.defaultIdentityAssignMode" @change="saveSettings">
                <option value="random">随机</option>
                <option value="semi-random">半随机</option>
                <option value="manual">手动</option>
              </select>
            </div>
            <div class="setting-row">
              <div>
                <strong>自动保存对局记录</strong>
                <span>对局结束后自动保存记录</span>
              </div>
              <button class="switch" :class="{ active: settings.autoSaveMatch }" @click="toggle('autoSaveMatch')"></button>
            </div>
          </section>

          <section class="settings-group">
            <h2>提醒</h2>
            <div class="setting-row">
              <div>
                <strong>对局结束提醒</strong>
                <span>对局结束时显示通知提醒</span>
              </div>
              <button class="switch" :class="{ active: settings.modelCallHints }" @click="toggle('modelCallHints')"></button>
            </div>
            <div class="setting-row">
              <div>
                <strong>活动与更新提醒</strong>
                <span>接收活动、更新等通知</span>
              </div>
              <button class="switch" :class="{ active: settings.balanceReminder }" @click="toggle('balanceReminder')"></button>
            </div>
          </section>

          <footer class="settings-footer">
            <button type="button" :disabled="saving" @click="resetSettings">
              <RotateCcw :size="18" />
              恢复默认
            </button>
          </footer>
        </template>

        <template v-else-if="activeSection === 'account'">
          <section class="settings-group single">
            <h2>账号与安全</h2>
            <p>钱包、API Key、OAuth 绑定等功能请在用户中心管理。</p>
            <button class="open-profile" type="button" @click="navigate('/profile')">
              <Shield :size="18" />
              打开用户中心
            </button>
          </section>
        </template>

        <template v-else-if="activeSection === 'about'">
          <section class="settings-group single">
            <h2>关于 Agent Arena</h2>
            <p>养成你的 AI 角色，让他们一起玩规则化社交游戏。</p>
          </section>
        </template>

        <template v-else>
          <section class="settings-group single">
            <h2>帮助与反馈</h2>
            <p>如遇对局异常，可在对局房间中使用“从快照恢复”；如模型调用失败，请检查用户中心中的 API Key 与余额。</p>
          </section>
        </template>
      </main>
    </section>
    </ArenaPageState>
  </ArenaPageShell>
</template>

<style scoped>
.settings-page :deep(.aa-page-inner) {
  max-width: none;
  height: 100%;
  padding: 30px 118px;
  overflow: hidden;
}

.settings-layout {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: 244px minmax(0, 1fr);
  gap: 26px;
}

.settings-nav,
.settings-content {
  border: 1px solid rgba(255, 255, 255, 0.76);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.68);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 22px 46px rgba(91, 101, 174, 0.1);
  backdrop-filter: blur(20px);
}

.settings-nav {
  min-height: 0;
  overflow: hidden;
  padding: 22px;
}

.settings-nav button {
  display: flex;
  align-items: center;
  gap: 18px;
  width: 100%;
  height: 60px;
  margin-bottom: 10px;
  padding: 0 22px;
  border: 1px solid transparent;
  border-radius: 13px;
  color: #2a346b;
  background: transparent;
  font: inherit;
  font-size: 18px;
  font-weight: 520;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    background 0.18s ease,
    color 0.18s ease,
    border-color 0.18s ease;
}

.settings-nav button:hover {
  transform: translateX(3px);
  background: rgba(255, 255, 255, 0.42);
}

.settings-nav button.active {
  color: #625cf0;
  border-left-color: #625cf0;
  background: linear-gradient(90deg, rgba(112, 105, 255, 0.13), rgba(255, 255, 255, 0.28));
}

.settings-content {
  min-height: 0;
  overflow: auto;
  padding: 28px 26px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.settings-content::-webkit-scrollbar {
  display: none;
}

.settings-group {
  margin-bottom: 25px;
}

.settings-group h2 {
  margin: 0 0 13px;
  color: #17205a;
  font-size: 20px;
  font-weight: 680;
}

.setting-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 206px 60px;
  align-items: center;
  min-height: 52px;
  padding: 8px 16px;
  border: 1px solid rgba(130, 142, 207, 0.12);
  border-bottom: 0;
  background: rgba(255, 255, 255, 0.38);
}

.setting-row:first-of-type {
  border-radius: 13px 13px 0 0;
}

.setting-row:last-child {
  border-bottom: 1px solid rgba(130, 142, 207, 0.12);
  border-radius: 0 0 13px 13px;
}

.setting-row:only-of-type {
  border-radius: 13px;
}

.setting-row strong {
  display: block;
  color: #26305e;
  font-size: 15px;
  font-weight: 600;
}

.setting-row span {
  display: block;
  margin-top: 3px;
  color: #7280b2;
  font-size: 12px;
}

.setting-row select {
  width: 178px;
  height: 35px;
  justify-self: end;
  padding: 0 14px;
  border: 1px solid rgba(130, 142, 207, 0.18);
  border-radius: 10px;
  color: #2a346b;
  background: rgba(255, 255, 255, 0.58);
  font: inherit;
}

.setting-row input[type='range'] {
  width: 260px;
  justify-self: end;
  accent-color: #6c63ff;
}

.setting-row b {
  justify-self: end;
  color: #53619a;
  font-size: 14px;
  font-weight: 520;
}

.switch {
  justify-self: end;
  position: relative;
  width: 40px;
  height: 23px;
  border: 0;
  border-radius: 999px;
  background: #dbe0f3;
  cursor: pointer;
  transition: background 0.18s ease;
}

.switch::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 3px 8px rgba(40, 48, 96, 0.16);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.switch.active {
  background: #6c63ff;
}

.switch.active::after {
  transform: translateX(17px);
}

.settings-footer {
  display: grid;
  place-items: center;
  gap: 7px;
  margin-top: 8px;
}

.settings-footer button,
.open-profile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 38px;
  padding: 0 18px;
  border: 1px solid rgba(130, 142, 207, 0.16);
  border-radius: 11px;
  color: #53619a;
  background: rgba(255, 255, 255, 0.48);
  font: inherit;
  cursor: pointer;
}

.settings-footer span {
  color: #7a83ae;
  font-size: 12px;
}

.settings-message,
.settings-error {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13px;
}

.settings-message {
  color: #1f9f65;
  background: rgba(34, 197, 94, 0.08);
}

.settings-error {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.08);
}

.settings-group.single {
  padding: 22px;
  border: 1px solid rgba(130, 142, 207, 0.12);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.36);
}

.settings-group.single p {
  color: #65709f;
  line-height: 1.8;
}

.settings-state {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 42px;
  color: #65709f;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
