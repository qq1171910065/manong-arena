<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Loader2, MessageSquare, Sparkles, Vote } from 'lucide-vue-next'
import ArenaPageShell from '@renderer/components/arena/ArenaPageShell.vue'
import ArenaPageState from '@renderer/components/arena/ArenaPageState.vue'
import { navigate, route } from '../router'
import { arenaSession, formatUserMessage, matchService, matchWindowService } from '@renderer/services/arena'
import { formatTimeLabel, formatYuan, matchStatusLabel } from '@renderer/utils/id'
import type { Match } from '@shared/arena/types'

const activeTab = ref<'speeches' | 'votes' | 'events'>('speeches')
const match = ref<Match | null>(null)
const loading = ref(true)
const error = ref('')

const deleting = ref(false)

async function load() {
  if (!route.value.id) return
  loading.value = true
  error.value = ''
  try {
    match.value = await matchService.get(route.value.id)
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    loading.value = false
  }
}

function copyConfig() {
  if (!match.value) return
  arenaSession.setCreatePreset({
    gameModeId: match.value.gameModeId,
    characterIds: [...match.value.participantIds],
    identityAssignMode: match.value.identityAssignMode,
  })
  navigate('/create-match')
}

async function removeMatch() {
  if (!match.value) return
  if (!window.confirm('确定删除这条对局记录吗？')) return
  deleting.value = true
  try {
    await matchService.remove(match.value.id)
    navigate('/match-records')
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  void load()
})
</script>

<template>
  <ArenaPageShell class="match-detail-page">
    <ArenaPageState :loading="loading" :error="error || undefined" skeleton="match-detail" loading-label="加载对局详情..." @retry="load">
      <div v-if="match" class="aa-detail-layout">
      <div class="aa-card aa-detail-hero">
        <div class="aa-detail-icon">{{ match.gameModeName[0] }}</div>
        <div>
          <h1>{{ match.title }}</h1>
          <p>{{ match.participants.length }} 人局 · {{ matchStatusLabel(match.status) }} · {{ formatTimeLabel(match.updatedAt) }}</p>
          <p v-if="match.resultSummary" class="aa-result">{{ match.resultSummary }}</p>
        </div>
        <div class="aa-detail-cost"><Sparkles :size="14" /> 消耗 {{ formatYuan(match.totalCostCents) }}</div>
      </div>

      <div class="aa-tabs">
        <button :class="{ active: activeTab === 'speeches' }" @click="activeTab = 'speeches'"><MessageSquare :size="14" /> 公开发言</button>
        <button :class="{ active: activeTab === 'votes' }" @click="activeTab = 'votes'"><Vote :size="14" /> 投票记录</button>
        <button :class="{ active: activeTab === 'events' }" @click="activeTab = 'events'">公开事件</button>
      </div>

      <div v-if="activeTab === 'speeches'" class="aa-card">
        <div v-if="!match.messages.length" class="aa-muted">暂无发言记录</div>
        <div v-for="msg in match.messages" :key="msg.id" class="aa-speech-item">
          <strong>{{ msg.participantName }}</strong>
          <span v-if="msg.roleLabel"> · {{ msg.roleLabel }}</span>
          <p>{{ msg.content }}</p>
          <small>{{ formatTimeLabel(msg.createdAt) }}</small>
        </div>
      </div>

      <div v-else-if="activeTab === 'votes'" class="aa-card">
        <div v-if="!match.votes.length" class="aa-muted">暂无投票记录</div>
        <div v-for="vote in match.votes" :key="vote.id" class="aa-speech-item">
          <strong>{{ vote.voterName }}</strong>
          <p>{{ vote.abstain ? '弃权' : `投票给 ${vote.targetName || '未知'}` }}</p>
        </div>
      </div>

      <div v-else class="aa-card">
        <div v-for="event in match.events" :key="event.id" class="aa-speech-item">
          <strong>{{ event.icon }} {{ event.text }}</strong>
          <small>{{ formatTimeLabel(event.createdAt) }}</small>
        </div>
      </div>

      <div class="aa-card">
        <h3>参与角色</h3>
        <div class="aa-participants">
          <span v-for="p in match.participants" :key="p.characterId" class="aa-tag aa-tag--primary">
            {{ p.characterName }}<template v-if="p.roleName"> · {{ p.roleName }}</template>
          </span>
        </div>
      </div>

      <div class="aa-actions">
        <button v-if="match.status === 'active' || match.status === 'paused'" class="aa-btn aa-btn-primary" @click="matchWindowService.open(match.id)">继续对局</button>
        <button class="aa-btn aa-btn-secondary" @click="copyConfig">复制配置重新开局</button>
        <button class="aa-btn aa-btn-secondary" :disabled="deleting" @click="removeMatch">{{ deleting ? '删除中…' : '删除记录' }}</button>
      </div>
    </div>
    </ArenaPageState>
  </ArenaPageShell>
</template>

<style scoped>
.match-detail-page :deep(.aa-page-inner) {
  max-width: none;
  height: 100%;
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  padding: 34px 46px 22px;
  overflow: hidden;
}

.aa-state { display: flex; gap: 8px; align-items: center; color: var(--aa-text-muted); }
.aa-detail-layout { min-height: 0; overflow: hidden; display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto auto; gap: 14px; padding-right: 2px; scrollbar-width: none; -ms-overflow-style: none; }
.aa-detail-layout::-webkit-scrollbar { display: none; }
.aa-detail-hero { display: flex; align-items: center; gap: 16px; min-height: 92px; }
.aa-detail-icon { width: 56px; height: 56px; border-radius: 12px; background: linear-gradient(135deg, #312e81, #4338ca); color: white; display: flex; align-items: center; justify-content: center; font-size: 24px; }
.aa-detail-hero h1 { margin: 0; font-size: 22px; color: var(--aa-text); }
.aa-detail-hero p { margin: 4px 0 0; color: var(--aa-text-muted); font-size: 13px; }
.aa-result { color: #22c55e !important; font-weight: 600; }
.aa-detail-cost { margin-left: auto; color: var(--aa-primary); font-weight: 600; display: flex; align-items: center; gap: 6px; }
.aa-tabs { display: flex; gap: 8px; }
.aa-tabs button { display: flex; align-items: center; gap: 6px; height: 38px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--aa-border); background: rgba(255,255,255,0.5); cursor: pointer; transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease; }
.aa-tabs button:hover { transform: translateY(-1px); background: rgba(255,255,255,0.78); box-shadow: 0 10px 18px rgba(91,101,174,0.09); }
.aa-tabs button.active { background: var(--aa-primary); color: white; border-color: transparent; }
.aa-tabs + .aa-card { min-height: 0; overflow: auto; scrollbar-width: none; -ms-overflow-style: none; }
.aa-tabs + .aa-card::-webkit-scrollbar { display: none; }
.aa-speech-item { padding: 10px 0; border-bottom: 1px solid var(--aa-border); }
.aa-speech-item p { margin: 6px 0; color: var(--aa-text-secondary); line-height: 1.6; }
.aa-speech-item small { color: var(--aa-text-muted); font-size: 11px; }
.aa-participants { display: flex; flex-wrap: wrap; gap: 6px; }
.aa-actions { display: flex; gap: 10px; justify-content: flex-end; }
.aa-muted { color: var(--aa-text-muted); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
