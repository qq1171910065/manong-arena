<script setup lang="ts">
import { Camera } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import type { PortalWalletSummary } from '@renderer/services'
import type { UserInfo } from '@renderer/services'
import ProfileSectionLayout from './ProfileSectionLayout.vue'
import SettingsBlock from './SettingsBlock.vue'
import SettingsInfoRow from './SettingsInfoRow.vue'
import { NInput, NTag } from '../../ui'

const props = defineProps<{
  profile: UserInfo | null
  displayName: string
  avatarUrl: string
  gatewayReady: boolean
  activeKeysCount: number
  hasLocalKey: boolean
  wechatBound: boolean
  wallet: PortalWalletSummary | null
  balancePoints: number
}>()

const emit = defineEmits<{
  'update-profile': [payload: { displayName?: string; avatarDataUrl?: string }]
}>()

const nameDraft = ref(props.displayName)
const avatarInputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.displayName,
  (value) => {
    nameDraft.value = value
  }
)

const emailStatus = computed(() => {
  if (props.profile?.emailVerified === false) return '未验证'
  if (props.profile?.emailBound) return '已绑定'
  if (props.profile?.needsEmailBind) return '待绑定'
  return '未绑定'
})

const emailStatusType = computed(() => {
  if (props.profile?.emailVerified === false) return 'warning' as const
  if (props.profile?.emailBound) return 'success' as const
  return 'default' as const
})

function commitDisplayName() {
  const next = nameDraft.value.trim()
  if (!next || next === props.displayName) return
  emit('update-profile', { displayName: next })
}

function openAvatarPicker() {
  avatarInputRef.value?.click()
}

async function onAvatarSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) return
  if (file.size > 8 * 1024 * 1024) return
  const dataUrl = await readFileAsDataUrl(file)
  emit('update-profile', { avatarDataUrl: dataUrl })
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}
</script>

<template>
  <ProfileSectionLayout title="账户概览" desc="个人资料与账户状态。">
    <section class="portal-plain-block">
      <div class="user-profile-hero">
        <button type="button" class="profile-avatar profile-avatar--editable" @click="openAvatarPicker">
          <img :src="avatarUrl" alt="" />
          <i class="profile-avatar__overlay" aria-hidden="true">
            <Camera :size="16" />
          </i>
        </button>
        <input
          ref="avatarInputRef"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          class="profile-avatar-input"
          @change="onAvatarSelected"
        />
        <div class="user-profile-hero__body">
          <p class="profile-hero__eyebrow">当前用户</p>
          <NInput
            v-model:value="nameDraft"
            class="profile-name-input"
            maxlength="24"
            placeholder="输入显示名称"
            @blur="commitDisplayName"
            @keydown.enter="($event.target as HTMLInputElement)?.blur()"
          />
          <p v-if="profile?.username" class="profile-hero__meta">@{{ profile.username }}</p>
          <p v-if="profile?.emailDisplay" class="profile-hero__meta">{{ profile.emailDisplay }}</p>
          <div class="profile-hero__tags">
            <NTag v-if="profile?.emailVerified === false" type="warning" size="small" :bordered="false">
              邮箱未验证
            </NTag>
            <NTag v-if="wechatBound" type="success" size="small" :bordered="false">微信已绑定</NTag>
            <NTag v-if="hasLocalKey" type="default" size="small" :bordered="false">本机 Key 已缓存</NTag>
          </div>
        </div>
      </div>
    </section>

    <SettingsBlock title="基本资料" desc="账号在平台侧登记的身份信息。">
      <SettingsInfoRow label="用户 ID" :value="profile?.id ? String(profile.id) : '—'" />
      <SettingsInfoRow label="用户名" :value="profile?.username || '—'" />
      <SettingsInfoRow label="显示名称" :value="displayName || '—'" />
      <SettingsInfoRow label="客户 ID" :value="profile?.customerId ? String(profile.customerId) : '—'" />
      <SettingsInfoRow v-if="profile?.role" label="账户角色" :value="profile.role" />
    </SettingsBlock>

    <SettingsBlock title="联系与安全" desc="邮箱验证、第三方绑定与网关开通状态。">
      <SettingsInfoRow label="邮箱" :value="profile?.emailDisplay || '未绑定'" />
      <SettingsInfoRow label="邮箱状态" hint="验证通过后可调模型">
        <NTag :type="emailStatusType" size="small" :bordered="false">{{ emailStatus }}</NTag>
      </SettingsInfoRow>
      <SettingsInfoRow label="微信绑定" hint="绑定后可扫码登录">
        <NTag :type="wechatBound ? 'success' : 'default'" size="small" :bordered="false">
          {{ wechatBound ? '已绑定' : '未绑定' }}
        </NTag>
      </SettingsInfoRow>
      <SettingsInfoRow label="模型网关" hint="邮箱验证通过后自动开通">
        <NTag :type="gatewayReady ? 'success' : 'warning'" size="small" :bordered="false">
          {{ gatewayReady ? '已就绪' : '待验证邮箱' }}
        </NTag>
      </SettingsInfoRow>
    </SettingsBlock>

    <SettingsBlock title="密钥与余额" desc="本机缓存、有效密钥数量与当前积分概览。">
      <SettingsInfoRow label="本机 Key 缓存" hint="客户端直连网关">
        <NTag :type="hasLocalKey ? 'success' : 'default'" size="small" :bordered="false">
          {{ hasLocalKey ? '已保存' : '未保存' }}
        </NTag>
      </SettingsInfoRow>
      <SettingsInfoRow label="有效密钥" :value="`${activeKeysCount} 个`" />
      <SettingsInfoRow label="积分余额" :value="balancePoints.toLocaleString()" />
      <SettingsInfoRow
        label="余额折合"
        :value="wallet ? `约 ${Number(wallet.balanceYuan || 0).toFixed(2)} 元` : '—'"
      />
      <SettingsInfoRow
        v-if="wallet"
        label="累计消费"
        :value="`${Number(wallet.totalConsumedYuan || wallet.usedYuan || 0).toFixed(2)} 元`"
      />
      <SettingsInfoRow
        v-if="wallet"
        label="累计充值"
        :value="`${Number(wallet.totalRechargedYuan || 0).toFixed(2)} 元`"
      />
    </SettingsBlock>
  </ProfileSectionLayout>
</template>

<style scoped>
.user-profile-hero {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.user-profile-hero__body {
  min-width: 0;
  flex: 1 1 auto;
}

.profile-avatar--editable {
  position: relative;
  border: 0;
  padding: 0;
  cursor: pointer;
  overflow: hidden;
}

.profile-avatar--editable img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.profile-avatar__overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: rgba(18, 27, 83, 0.42);
  color: #fff;
  opacity: 0;
  transition: opacity 0.18s ease;
}

.profile-avatar--editable:hover .profile-avatar__overlay,
.profile-avatar--editable:focus-visible .profile-avatar__overlay {
  opacity: 1;
}

.profile-avatar-input {
  display: none;
}

.profile-name-input {
  max-width: 320px;
}

.profile-name-input :deep(.n-input__input-el) {
  font-size: var(--text-h2);
  font-weight: 650;
  letter-spacing: -0.02em;
}

.profile-hero__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
</style>
