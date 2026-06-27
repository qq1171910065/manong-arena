import { ref } from 'vue'

export function useDebouncedSave(delayMs = 600) {
  const saving = ref(false)
  const saveError = ref('')
  let timer: number | undefined
  let runId = 0

  function schedule(fn: () => Promise<void>) {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      const id = ++runId
      saving.value = true
      void fn()
        .then(() => {
          if (id === runId) saveError.value = ''
        })
        .catch((err: unknown) => {
          if (id === runId) {
            saveError.value = err instanceof Error ? err.message : String(err)
          }
        })
        .finally(() => {
          if (id === runId) saving.value = false
        })
    }, delayMs)
  }

  function flush(fn: () => Promise<void>) {
    window.clearTimeout(timer)
    const id = ++runId
    saving.value = true
    return fn()
      .then(() => {
        if (id === runId) saveError.value = ''
      })
      .catch((err: unknown) => {
        if (id === runId) {
          saveError.value = err instanceof Error ? err.message : String(err)
        }
        throw err
      })
      .finally(() => {
        if (id === runId) saving.value = false
      })
  }

  return { saving, saveError, schedule, flush }
}
