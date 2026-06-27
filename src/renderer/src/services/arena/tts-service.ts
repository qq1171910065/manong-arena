import { gatewayTtsSynthesize } from '../gateway-api'

import {

  getAppliedArenaSettings,

  playArenaAudioBuffer,

  stopArenaTtsPlayback,

  unlockArenaAudio,

} from './settings-runtime'

import {

  JUDGE_TTS_PLAYBACK_RATE,

  buildTtsAssistantTextWithTags,

  extractCompletedSentences,

  resolveCharacterPlaybackRate,

  resolveCharacterTtsParams,

  splitLongSentence,

  stripTtsMarkupForDisplay,

} from '@shared/arena/voice-presets'

import type { ArenaSettings, Character } from '@shared/arena/types'



type TtsScope = 'character' | 'judge'



type SpeakJob = {

  synthText: string

  voiceId: string

  styleInstruction: string

  volume: number

  playbackRate: number

  scope: TtsScope

  speakerId?: string

}



type FetchedSpeakJob = {

  job: SpeakJob

  buffer: ArrayBuffer

}



export type TtsSpeakingState = {

  participantId: string | null

}



function emitSpeaking(participantId: string | null): void {

  if (typeof window === 'undefined') return

  window.dispatchEvent(

    new CustomEvent<TtsSpeakingState>('arena:tts-speaking', {

      detail: { participantId },

    })

  )

  if (participantId === null) {

    window.dispatchEvent(new CustomEvent('arena:tts-idle'))

  }

}



function isCharacterTtsAllowed(settings: ArenaSettings | null): boolean {

  if (!settings?.ttsEnabled) return false

  return (settings.ttsVolume ?? 0) > 0

}



function isJudgeTtsAllowed(settings: ArenaSettings | null): boolean {

  return isCharacterTtsAllowed(settings) && Boolean(settings?.matchDefaults.judgeTtsEnabled)

}



function isJobAllowed(job: SpeakJob, settings: ArenaSettings | null): boolean {

  return job.scope === 'judge' ? isJudgeTtsAllowed(settings) : isCharacterTtsAllowed(settings)

}



class TtsPlaybackQueue {

  private sessionId = 0

  private pending: SpeakJob[] = []

  private running = false

  private idleWaiters: Array<() => void> = []



  private resolveIdleWaiters(): void {

    if (this.running || this.pending.length) return

    const waiters = this.idleWaiters

    this.idleWaiters = []

    waiters.forEach((resolve) => resolve())

  }



  waitUntilIdle(): Promise<void> {

    if (!this.running && !this.pending.length) return Promise.resolve()

    return new Promise((resolve) => {

      this.idleWaiters.push(resolve)

    })

  }



  isIdle(): boolean {

    return !this.running && !this.pending.length

  }



  interrupt(): void {

    this.sessionId++

    this.pending = []

    stopArenaTtsPlayback()

    this.running = false

    emitSpeaking(null)

    this.resolveIdleWaiters()

  }



  enqueueChunks(chunks: SpeakJob[]): void {

    if (!chunks.length) return

    this.pending.push(...chunks)

    void this.drain(false)

  }



  /** 插队到当前队列最前（用于开局身份分配等应先于发言播报的裁判语音） */

  enqueueChunksPriority(chunks: SpeakJob[]): void {

    if (!chunks.length) return

    this.pending.unshift(...chunks)

    void this.drain(false)

  }



  /** 试听：同步等待合成与播放，失败时抛出错误 */

  async playPreview(job: SpeakJob): Promise<void> {

    this.interrupt()

    unlockArenaAudio()

    const session = this.sessionId

    const buffer = await gatewayTtsSynthesize({

      text: job.synthText,

      voice: job.voiceId,

      styleInstruction: job.styleInstruction,

    })

    if (session !== this.sessionId) return

    await this.playBuffer(buffer, job, session)

  }



  private async drain(throwOnError: boolean): Promise<void> {

    if (this.running) return

    this.running = true

    const session = this.sessionId

    let nextFetch: Promise<FetchedSpeakJob | null> | null = null



    try {

      while (session === this.sessionId) {

        if (!nextFetch) {

          nextFetch = this.fetchNextJob(session, throwOnError)

        }



        const result = await nextFetch

        nextFetch = null

        if (!result) {

          if (this.pending.length) continue

          emitSpeaking(null)

          this.resolveIdleWaiters()

          break

        }



        if (this.pending.length) {

          nextFetch = this.fetchNextJob(session, throwOnError)

        }



        unlockArenaAudio()

        await this.playBuffer(result.buffer, result.job, session)

      }

    } finally {

      if (session === this.sessionId) {

        this.running = false

        if (!this.pending.length) {

          emitSpeaking(null)

          this.resolveIdleWaiters()

        }

      }

    }

  }



  private shiftNextJob(): SpeakJob | null {

    while (this.pending.length) {

      const job = this.pending.shift()

      if (job?.synthText.trim()) return job

    }

    return null

  }



  private async fetchNextJob(session: number, throwOnError: boolean): Promise<FetchedSpeakJob | null> {

    while (session === this.sessionId) {

      const job = this.shiftNextJob()

      if (!job) return null



      const settings = getAppliedArenaSettings()

      if (!isJobAllowed(job, settings)) continue



      try {

        const buffer = await gatewayTtsSynthesize({

          text: job.synthText,

          voice: job.voiceId,

          styleInstruction: job.styleInstruction,

        })

        if (session !== this.sessionId) return null



        const latest = getAppliedArenaSettings()

        if (!isJobAllowed(job, latest)) continue



        return { job, buffer }

      } catch (err) {

        if (throwOnError) throw err

      }

    }

    return null

  }



  private async playBuffer(buffer: ArrayBuffer, job: SpeakJob, session: number): Promise<void> {

    if (session !== this.sessionId) return



    const settings = getAppliedArenaSettings()

    if (!isJobAllowed(job, settings)) return



    emitSpeaking(job.speakerId ?? null)



    await playArenaAudioBuffer(buffer, job.volume, job.playbackRate)

    if (session !== this.sessionId) stopArenaTtsPlayback()

  }

}



const queue = new TtsPlaybackQueue()

const speechTtsCursor = new Map<string, number>()



function previewVolume(): number {

  const settings = getAppliedArenaSettings()

  const raw = settings?.ttsVolume ?? settings?.sfxVolume ?? 80

  return Math.max(0.15, Math.min(1, raw / 100))

}



function currentVolume(): number {

  const settings = getAppliedArenaSettings()

  const raw = settings?.ttsVolume ?? 80

  return Math.max(0, Math.min(1, raw / 100))

}



function buildSpeakJob(

  displayText: string,

  character: Character,

  volume = currentVolume()

): SpeakJob {

  const clean = stripTtsMarkupForDisplay(displayText)

  const params = resolveCharacterTtsParams(character)

  return {

    synthText: buildTtsAssistantTextWithTags(clean, params.openingStyleTags),

    voiceId: params.voiceId,

    styleInstruction: params.styleInstruction,

    volume,

    playbackRate: resolveCharacterPlaybackRate(character),

    scope: 'character',

    speakerId: character.id,

  }

}



function chunkJobs(displayText: string, character: Character): SpeakJob[] {

  const params = resolveCharacterTtsParams(character)

  const baseVolume = currentVolume()

  const playbackRate = resolveCharacterPlaybackRate(character)

  return splitLongSentence(stripTtsMarkupForDisplay(displayText)).map((chunk) => ({

    synthText: buildTtsAssistantTextWithTags(chunk, params.openingStyleTags),

    voiceId: params.voiceId,

    styleInstruction: params.styleInstruction,

    volume: baseVolume,

    playbackRate,

    scope: 'character',

    speakerId: character.id,

  }))

}



function onSettingsChange(event: Event): void {

  const settings = (event as CustomEvent<ArenaSettings>).detail

  if (!isCharacterTtsAllowed(settings)) queue.interrupt()

}



if (typeof window !== 'undefined') {

  window.addEventListener('arena:settings-change', onSettingsChange)

}



export const ttsService = {

  stripDisplayText: stripTtsMarkupForDisplay,



  interrupt(): void {

    queue.interrupt()

    speechTtsCursor.clear()

  },



  waitUntilIdle(): Promise<void> {

    return queue.waitUntilIdle()

  },



  isIdle(): boolean {

    return queue.isIdle()

  },



  resetMessage(messageId: string): void {

    speechTtsCursor.delete(messageId)

  },



  /** 进入已有对局时标记历史消息已播报，避免重播 TTS */

  seedSpeechMessages(messages: Array<{ id: string; content: string }>): void {

    for (const msg of messages) {

      const text = stripTtsMarkupForDisplay(msg.content)

      if (!text) continue

      speechTtsCursor.set(msg.id, text.length)

    }

  },



  async previewCharacter(character: Character, sampleText?: string): Promise<void> {

    const text =

      sampleText?.trim() ||

      character.commonPhrases[0] ||

      `你好，我是${character.name || '角色'}，这是我的播报音色。`

    const job = buildSpeakJob(text, character, previewVolume())

    await queue.playPreview(job)

  },



  onSpeechDelta(messageId: string, content: string, character: Character, final = false): void {

    const settings = getAppliedArenaSettings()

    if (!isCharacterTtsAllowed(settings)) return



    const displayContent = stripTtsMarkupForDisplay(content)

    if (!displayContent.trim()) return



    const cursor = speechTtsCursor.get(messageId) || 0

    const slice = displayContent.slice(cursor)

    if (!slice.trim() && !final) return



    const { completed, remainder } = extractCompletedSentences(slice, final)

    const jobs = completed.flatMap((sentence) => chunkJobs(sentence, character))

    if (jobs.length) queue.enqueueChunks(jobs)



    const consumed = slice.length - remainder.length

    speechTtsCursor.set(messageId, cursor + consumed)

  },



  speakJudge(text: string, voiceId: string, priority = false): void {

    const settings = getAppliedArenaSettings()

    if (!isJudgeTtsAllowed(settings)) return

    const trimmed = stripTtsMarkupForDisplay(text.replace(/\n+/g, '，'))

    if (!trimmed) return

    const instruction = '用沉稳清晰的裁判口吻朗读以下内容，语气公正克制，语速适中。'

    const base = {

      voiceId,

      styleInstruction: instruction,

      volume: currentVolume(),

      playbackRate: JUDGE_TTS_PLAYBACK_RATE,

      scope: 'judge' as const,

    }

    const jobs = splitLongSentence(trimmed).map((chunk) => ({

      ...base,

      synthText: chunk,

    }))

    if (priority) queue.enqueueChunksPriority(jobs)

    else queue.enqueueChunks(jobs)

  },



  speakCharacter(character: Character, text: string): void {

    const settings = getAppliedArenaSettings()

    if (!isCharacterTtsAllowed(settings)) return

    const jobs = splitLongSentence(stripTtsMarkupForDisplay(text)).map((chunk) =>

      buildSpeakJob(chunk, character)

    )

    queue.enqueueChunks(jobs)

  },

}


