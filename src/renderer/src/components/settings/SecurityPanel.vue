<script setup lang="ts">
import type { PortalOAuthBinding } from '@renderer/services'
import ProfileSectionLayout from './ProfileSectionLayout.vue'
import SettingsBlock from './SettingsBlock.vue'
import SettingsInfoRow from './SettingsInfoRow.vue'
import SettingsRow from './SettingsRow.vue'
import { NButton, NForm, NFormItem, NInput, NSpace, NTag } from '../../ui'

const bindEmail = defineModel<string>('bindEmail', { required: true })
const bindCode = defineModel<string>('bindCode', { required: true })

defineProps<{
  accountDetails: Array<{ id: string; label: string; hint?: string; value: string; status?: string }>
  securityItems: Array<{ id: string; label: string; desc: string; ok: boolean }>
  oauthBindings: PortalOAuthBinding[]
  needsEmailBind: boolean
  bindSending: boolean
  bindSubmitting: boolean
  bindCountdown: number
}>()

const emit = defineEmits<{
  sendBindCode: []
  submitBindEmail: []
  unbindOAuth: [channel: string, label: string]
  openOAuthBind: [binding: PortalOAuthBinding]
}>()
</script>

<template>
  <ProfileSectionLayout title="账号安全" desc="邮箱验证、第三方绑定与登录。">
    <SettingsBlock title="账户信息" desc="平台身份、网关与密钥状态。">
      <SettingsInfoRow v-for="item in accountDetails" :key="item.id" :label="item.label" :hint="item.hint">
        <span>{{ item.value }}</span>
        <span
          v-if="item.status"
          class="profile-detail-status"
          :class="`profile-detail-status--${item.status}`"
          aria-hidden="true"
        />
      </SettingsInfoRow>
    </SettingsBlock>

    <SettingsBlock title="安全状态" desc="邮箱、微信、网关与密钥检查。">
      <SettingsInfoRow v-for="item in securityItems" :key="item.id" :label="item.label" :hint="item.desc">
        <NTag :type="item.ok ? 'success' : 'warning'" size="small" :bordered="false">
          {{ item.ok ? '正常' : '待处理' }}
        </NTag>
      </SettingsInfoRow>
    </SettingsBlock>

    <SettingsBlock v-if="needsEmailBind" title="绑定邮箱" desc="已注册邮箱将合并到原账号。">
      <NForm label-placement="top">
        <NFormItem label="邮箱">
          <NInput v-model:value="bindEmail" type="text" placeholder="name@example.com" />
        </NFormItem>
        <NFormItem label="验证码">
          <NSpace>
            <NInput
              v-model:value="bindCode"
              inputmode="numeric"
              maxlength="6"
              placeholder="6 位验证码"
              style="min-width: 140px"
              :disabled="bindSubmitting"
            />
            <NButton
              :disabled="!bindEmail.trim() || bindCountdown > 0"
              :loading="bindSending"
              @click="emit('sendBindCode')"
            >
              {{ bindCountdown > 0 ? bindCountdown + 's 后重发' : '发送验证码' }}
            </NButton>
          </NSpace>
        </NFormItem>
        <NButton
          type="primary"
          :loading="bindSubmitting"
          :disabled="!bindEmail.trim() || !bindCode.trim()"
          @click="emit('submitBindEmail')"
        >
          绑定
        </NButton>
      </NForm>
    </SettingsBlock>

    <SettingsBlock v-if="oauthBindings.length" title="第三方账号" desc="绑定后可使用扫码等方式快捷登录。">
      <SettingsRow
        v-for="item in oauthBindings"
        :key="item.channel"
        :label="item.label"
        :hint="item.bound ? '已绑定，可快捷登录' : '尚未绑定'"
      >
        <NSpace align="center" :size="8">
          <NTag :type="item.bound ? 'success' : 'default'" size="small" :bordered="false">
            {{ item.bound ? '已绑定' : '未绑定' }}
          </NTag>
          <NButton
            v-if="item.bound"
            size="small"
            tertiary
            type="error"
            @click="emit('unbindOAuth', item.channel, item.label)"
          >
            解绑
          </NButton>
          <NButton v-else size="small" type="primary" @click="emit('openOAuthBind', item)">
            绑定
          </NButton>
        </NSpace>
      </SettingsRow>
    </SettingsBlock>
  </ProfileSectionLayout>
</template>
