<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus, X } from 'lucide-vue-next'
import DetailEditDialog from '@renderer/components/arena/DetailEditDialog.vue'
import { characterBannerUrl } from '@renderer/data/arena-visual-assets'
import { formatUserMessage, lineupService } from '@renderer/services/arena'
import { LINEUP_MAX_SIZE, resolveCharacterGrowth } from '@shared/arena/character-growth'
import type { Character, CharacterLineup } from '@shared/arena/types'

const show = defineModel<boolean>({ default: false })

const props = defineProps<{
  lineup?: CharacterLineup | null
  characters: Character[]
}>()

const emit = defineEmits<{
  saved: [lineup: CharacterLineup]
  deleted: [id: string]
}>()

const name = ref('')
const memberIds = ref<string[]>([])
const pickerOpen = ref(false)
const saving = ref(false)
const deleting = ref(false)
const error = ref('')

const isCreate = computed(() => !props.lineup?.id)

const members = computed(() =>
  memberIds.value
    .map((id) => props.characters.find((item) => item.id === id))
    .filter(Boolean) as Character[]
)

const availableCharacters = computed(() => {
  const used = new Set(memberIds.value)
  return props.characters.filter((item) => !used.has(item.id))
})

watch(
  () => [show.value, props.lineup] as const,
  ([open, lineup]) => {
    if (!open) return
    error.value = ''
    pickerOpen.value = false
    name.value = lineup?.name || ''
    memberIds.value = [...(lineup?.characterIds || [])]
  },
  { immediate: true }
)

function addCharacter(id: string) {
  if (memberIds.value.length >= LINEUP_MAX_SIZE) return
  memberIds.value = [...memberIds.value, id]
  pickerOpen.value = false
}

function removeCharacter(id: string) {
  memberIds.value = memberIds.value.filter((item) => item !== id)
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    const saved = await lineupService.save({
      ...props.lineup,
      name: name.value,
      characterIds: memberIds.value,
    })
    emit('saved', saved)
    show.value = false
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    saving.value = false
  }
}

async function removeLineup() {
  if (!props.lineup?.id || deleting.value) return
  deleting.value = true
  error.value = ''
  try {
    await lineupService.remove(props.lineup.id)
    emit('deleted', props.lineup.id)
    show.value = false
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <DetailEditDialog
    v-model="show"
    :title="isCreate ? '新建阵容' : '编辑阵容'"
    subtitle="最多 6 人 · 全员参战的对局会计入阵容战绩"
    :saving="saving"
    :save-label="isCreate ? '创建阵容' : '保存阵容'"
    @save="save"
  >
    <div class="lineup-edit">
      <label class="lineup-edit__field">
        <span>阵容名称</span>
        <input v-model="name" type="text" placeholder="例如：主力五人组" maxlength="32" />
      </label>

      <section class="lineup-edit__members">
        <header>
          <strong>成员</strong>
          <span>{{ memberIds.length }}/{{ LINEUP_MAX_SIZE }}</span>
        </header>

        <div class="lineup-edit__grid">
          <article
            v-for="char in members"
            :key="char.id"
            class="lineup-edit__card"
            :style="{ '--accent': char.accentColor }"
          >
            <img :src="characterBannerUrl(char)" :alt="char.name" />
            <div>
              <strong>{{ char.name }}</strong>
              <span>Lv.{{ resolveCharacterGrowth(char).level }}</span>
            </div>
            <button type="button" aria-label="移出阵容" @click="removeCharacter(char.id)">
              <X :size="14" />
            </button>
          </article>

          <button
            v-if="memberIds.length < LINEUP_MAX_SIZE"
            type="button"
            class="lineup-edit__card lineup-edit__card--add"
            @click="pickerOpen = !pickerOpen"
          >
            <Plus :size="24" />
            <span>加入角色</span>
          </button>
        </div>

        <div v-if="pickerOpen" class="lineup-edit__picker">
          <button
            v-for="char in availableCharacters"
            :key="char.id"
            type="button"
            class="lineup-edit__picker-item"
            @click="addCharacter(char.id)"
          >
            <img :src="characterBannerUrl(char)" :alt="char.name" />
            <span>{{ char.name }}</span>
            <em>Lv.{{ resolveCharacterGrowth(char).level }}</em>
          </button>
          <p v-if="!availableCharacters.length" class="lineup-edit__hint">没有可加入的角色</p>
        </div>
      </section>

      <p v-if="error" class="lineup-edit__error">{{ error }}</p>
    </div>

    <template v-if="!isCreate" #footer-left>
      <button type="button" class="lineup-edit__delete" :disabled="deleting" @click="removeLineup">
        {{ deleting ? '删除中…' : '删除阵容' }}
      </button>
    </template>
  </DetailEditDialog>
</template>

<style scoped>
.lineup-edit {
  display: grid;
  gap: 18px;
}

.lineup-edit__field {
  display: grid;
  gap: 8px;
}

.lineup-edit__field span {
  color: #66709d;
  font-size: 12px;
}

.lineup-edit__field input {
  height: 42px;
  padding: 0 14px;
  border: 1px solid rgba(130, 142, 207, 0.18);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.82);
  color: #17205a;
  font: inherit;
  font-size: 14px;
}

.lineup-edit__members {
  display: grid;
  gap: 12px;
}

.lineup-edit__members header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.lineup-edit__members header strong {
  color: #17205a;
  font-size: 14px;
}

.lineup-edit__members header span {
  color: #9aa3c7;
  font-size: 12px;
}

.lineup-edit__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.lineup-edit__card {
  position: relative;
  width: 132px;
  padding: 8px;
  border: 1px solid rgba(130, 142, 207, 0.14);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.72);
}

.lineup-edit__card img {
  width: 100%;
  aspect-ratio: 16 / 11;
  object-fit: cover;
  border-radius: 12px;
  background: #eef1f8;
}

.lineup-edit__card div {
  display: grid;
  gap: 2px;
  margin-top: 8px;
}

.lineup-edit__card strong {
  overflow: hidden;
  color: #17205a;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lineup-edit__card span {
  color: #9aa3c7;
  font-size: 10px;
}

.lineup-edit__card button {
  position: absolute;
  top: 6px;
  right: 6px;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #ef6a8a;
  color: #fff;
  cursor: pointer;
}

.lineup-edit__card--add {
  display: grid;
  place-items: center;
  gap: 6px;
  min-height: 168px;
  border-style: dashed;
  color: #7b61ff;
  background: rgba(255, 255, 255, 0.42);
  cursor: pointer;
  font: inherit;
}

.lineup-edit__card--add span {
  font-size: 11px;
  font-weight: 600;
}

.lineup-edit__picker {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
  padding: 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(130, 142, 207, 0.12);
}

.lineup-edit__picker-item {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 0;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.lineup-edit__picker-item img {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  object-fit: cover;
}

.lineup-edit__picker-item em {
  color: #9aa3c7;
  font-size: 10px;
  font-style: normal;
}

.lineup-edit__hint,
.lineup-edit__error {
  margin: 0;
  font-size: 12px;
}

.lineup-edit__hint {
  color: #9aa3c7;
}

.lineup-edit__error {
  color: #ef6a8a;
}

.lineup-edit__delete {
  border: 0;
  background: transparent;
  color: #ef6a8a;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.lineup-edit__delete:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
