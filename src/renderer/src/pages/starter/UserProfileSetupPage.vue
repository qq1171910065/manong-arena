<script setup lang="ts">
import { Loader2, Sparkles, UserRound } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { NAlert } from '@renderer/ui'
import { createUserProfileCharacter } from '@renderer/services/arena/user-profile-service'
import { userInfoRef } from '@renderer/services/auth'
import { arenaHomeAssets } from '@renderer/data/arena-home-assets'

const emit = defineEmits<{ complete: [] }>()

defineProps<{ appName: string }>()

const STYLE_OPTIONS = ['理性', '温柔', '幽默', '简洁', '活泼', '高冷'] as const

const displayName = ref('')
const speechStyle = ref<(typeof STYLE_OPTIONS)[number]>('理性')
const gender = ref<'female' | 'male' | 'other'>('other')
const busy = ref(false)
const error = ref('')

const loginBgStyle = {
  '--arena-login-bg': `url(${arenaHomeAssets.bgClean})`,
}

const previewBio = computed(
  () =>
    `这是 ${displayName.value.trim() || '你的 AI 分身'} 的竞技人格：${speechStyle.value}风格，可替你参与对局；轮到你时也可随时亲自接管发言。`
)

onMounted(() => {
  const user = userInfoRef.value
  const base = user?.name?.trim() || user?.username?.trim() || '我的分身'
  displayName.value = base.includes('分身') ? base : `${base}的分身`
})

async function submit() {
  const name = displayName.value.trim()
  if (!name) {
    error.value = '请为你的 AI 分身取一个名字'
    return
  }
  busy.value = true
  error.value = ''
  try {
    await createUserProfileCharacter({
      displayName: name,
      speechStyle: speechStyle.value,
      gender: gender.value,
      bio: previewBio.value,
    })
    emit('complete')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '创建失败，请重试'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="arena-profile-setup" :style="loginBgStyle">
    <header class="arena-profile-setup__nav">
      <img class="arena-profile-setup__brand" :src="arenaHomeAssets.brandLockup" :alt="appName" />
    </header>

    <main class="arena-profile-setup__body">
      <div class="arena-profile-setup__card">
        <div class="arena-profile-setup__icon">
          <UserRound :size="28" />
        </div>
        <p class="arena-profile-setup__eyebrow">YOUR AVATAR</p>
        <h1 class="arena-profile-setup__title">创建你的 AI 分身</h1>
        <p class="arena-profile-setup__desc">
          初始化已完成。接下来生成一个专属 AI 角色：它可替你参与对局，你也可以在任意时刻亲自接管发言。
        </p>

        <form class="arena-profile-setup__form" @submit.prevent="submit">
          <label class="arena-profile-setup__field">
            <span>分身昵称</span>
            <input v-model="displayName" type="text" maxlength="24" placeholder="例如：小明的分身" />
          </label>

          <label class="arena-profile-setup__field">
            <span>说话风格</span>
            <div class="arena-profile-setup__chips">
              <button
                v-for="item in STYLE_OPTIONS"
                :key="item"
                type="button"
                class="arena-profile-setup__chip"
                :class="{ 'is-active': speechStyle === item }"
                @click="speechStyle = item"
              >
                {{ item }}
              </button>
            </div>
          </label>

          <label class="arena-profile-setup__field">
            <span>形象气质</span>
            <div class="arena-profile-setup__chips">
              <button type="button" class="arena-profile-setup__chip" :class="{ 'is-active': gender === 'female' }" @click="gender = 'female'">偏女性</button>
              <button type="button" class="arena-profile-setup__chip" :class="{ 'is-active': gender === 'male' }" @click="gender = 'male'">偏男性</button>
              <button type="button" class="arena-profile-setup__chip" :class="{ 'is-active': gender === 'other' }" @click="gender = 'other'">中性</button>
            </div>
          </label>

          <p class="arena-profile-setup__preview">{{ previewBio }}</p>

          <NAlert v-if="error" type="error" :bordered="false">{{ error }}</NAlert>

          <button type="submit" class="arena-profile-setup__submit" :disabled="busy">
            <Loader2 v-if="busy" :size="16" class="spin" />
            <Sparkles v-else :size="16" />
            生成分身并进入大厅
          </button>
        </form>
      </div>
    </main>
  </div>
</template>

<style scoped>
.arena-profile-setup {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, rgba(251, 249, 255, 0.42), rgba(235, 226, 255, 0.76)), var(--arena-login-bg, none) center/cover no-repeat;
  color: #17134a;
  font-family: var(--arena-font-family);
}
.arena-profile-setup__nav {
  padding: 24px 32px;
}
.arena-profile-setup__brand {
  height: 28px;
}
.arena-profile-setup__body {
  flex: 1;
  display: grid;
  place-items: center;
  padding: 24px;
}
.arena-profile-setup__card {
  width: min(520px, 100%);
  padding: 32px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(126, 99, 255, 0.12);
  box-shadow: 0 24px 60px rgba(53, 45, 110, 0.12);
}
.arena-profile-setup__icon {
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  border-radius: 18px;
  color: #fff;
  background: linear-gradient(135deg, #8a68ff, #6c5cff);
  margin-bottom: 16px;
}
.arena-profile-setup__eyebrow {
  margin: 0 0 8px;
  font-size: 11px;
  letter-spacing: 0.14em;
  color: #8b7fd6;
}
.arena-profile-setup__title {
  margin: 0 0 8px;
  font-size: 28px;
}
.arena-profile-setup__desc {
  margin: 0 0 24px;
  color: #5f538f;
  line-height: 1.6;
}
.arena-profile-setup__form {
  display: grid;
  gap: 18px;
}
.arena-profile-setup__field {
  display: grid;
  gap: 8px;
  font-size: 13px;
  color: #4a3f8f;
}
.arena-profile-setup__field input {
  height: 42px;
  border-radius: 12px;
  border: 1px solid rgba(126, 99, 255, 0.18);
  padding: 0 14px;
  font-size: 15px;
}
.arena-profile-setup__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.arena-profile-setup__chip {
  height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid rgba(126, 99, 255, 0.16);
  background: rgba(255, 255, 255, 0.72);
  color: #5f538f;
  cursor: pointer;
}
.arena-profile-setup__chip.is-active {
  background: rgba(124, 92, 255, 0.12);
  border-color: rgba(124, 92, 255, 0.42);
  color: #4a3f8f;
  font-weight: 650;
}
.arena-profile-setup__preview {
  margin: 0;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(244, 240, 255, 0.88);
  color: #5f538f;
  line-height: 1.6;
  font-size: 13px;
}
.arena-profile-setup__submit {
  height: 46px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  border-radius: 14px;
  background: linear-gradient(135deg, #8a68ff, #6c5cff);
  color: #fff;
  font-size: 15px;
  font-weight: 650;
  cursor: pointer;
}
.arena-profile-setup__submit:disabled {
  opacity: 0.72;
  cursor: wait;
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
