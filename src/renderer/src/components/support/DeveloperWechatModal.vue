<script setup lang="ts">
import { MessageCircle } from 'lucide-vue-next'
import { NModal } from '../../ui'
import { arenaHomeAssets } from '../../data/arena-home-assets'

const show = defineModel<boolean>({ default: false })
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    class="developer-wechat-modal"
    :style="{ width: '380px', maxWidth: '94vw' }"
  >
    <template #header>
      <div class="developer-wechat-modal__head">
        <span class="developer-wechat-modal__icon" aria-hidden="true">
          <MessageCircle :size="20" />
        </span>
        <div>
          <div class="developer-wechat-modal__title">添加开发者微信</div>
          <div class="developer-wechat-modal__desc">扫码添加，反馈建议或试用问题都可以找我</div>
        </div>
      </div>
    </template>

    <div class="developer-wechat-modal__body">
      <div class="developer-wechat-modal__qr-frame">
        <img :src="arenaHomeAssets.developerWechatQr" alt="开发者微信二维码" class="developer-wechat-modal__qr" />
      </div>
      <p class="developer-wechat-modal__hint">打开微信扫一扫，添加开发者好友</p>
    </div>
  </NModal>
</template>

<style scoped>
.developer-wechat-modal__head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.developer-wechat-modal__icon {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(180deg, #7b76ff, #5c57ef);
  box-shadow: 0 8px 16px rgba(89, 77, 228, 0.22);
}

.developer-wechat-modal__title {
  color: #151e57;
  font-size: 16px;
  font-weight: 650;
}

.developer-wechat-modal__desc {
  margin-top: 4px;
  color: #65709f;
  font-size: 13px;
  line-height: 1.45;
}

.developer-wechat-modal__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 4px 0 8px;
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
