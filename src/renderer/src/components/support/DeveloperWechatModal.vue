<script setup lang="ts">
import ArenaDialogShell from '@renderer/components/common/ArenaDialogShell.vue'
import { arenaHomeAssets } from '../../data/arena-home-assets'

const show = defineModel<boolean>({ default: false })
</script>

<template>
  <ArenaDialogShell v-model="show" title="添加开发者微信" variant="preview" size="md">
    <p class="developer-wechat-modal__desc">扫码添加，反馈建议或试用问题都可以找我</p>

    <div class="developer-wechat-modal__body">
      <div class="developer-wechat-modal__qr-frame">
        <img :src="arenaHomeAssets.developerWechatQr" alt="开发者微信二维码" class="developer-wechat-modal__qr" />
      </div>
      <p class="developer-wechat-modal__hint">打开微信扫一扫，添加开发者好友</p>
    </div>
  </ArenaDialogShell>
</template>

<style scoped>
.developer-wechat-modal__desc {
  margin: 0 0 14px;
  color: #65709f;
  font-size: 13px;
  line-height: 1.45;
}

.developer-wechat-modal__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.developer-wechat-modal__qr-frame {
  width: 220px;
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  border: 1px solid rgba(132, 142, 204, 0.18);
  border-radius: 16px;
  background: #fff;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    0 14px 28px rgba(86, 91, 190, 0.1);
}

.developer-wechat-modal__qr {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.developer-wechat-modal__hint {
  margin: 0;
  color: #65709f;
  font-size: 13px;
  text-align: center;
}
</style>
