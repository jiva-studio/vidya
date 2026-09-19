import { ref } from 'vue'

import type { MediaRecord } from '@/entities/media'
import { MediaError, useMediaGateway } from '@/entities/media'

export type UploadStatus = 'idle' | 'uploading' | 'failed'

/** One attempt, so a late answer can be matched against the one still on screen. */
interface Attempt {
  file: File
  controller: AbortController
}

/**
 * One file on its way to storage, with the two ways out an author needs.
 *
 * A cancelled upload is not a failure and says nothing: the author asked for it
 * to stop. Only a refusal leaves a reason behind, and the file is kept so that
 * retrying sends the same bytes rather than asking for them again.
 *
 * An attempt reports only while it is the current one. A cancelled upload's
 * rejection arrives after its successor has started, and judging it against
 * whatever is current would fault an upload that is still going fine.
 */
export const useMediaUpload = () => {
  const gateway = useMediaGateway()

  const status = ref<UploadStatus>('idle')
  const percent = ref(0)
  const error = ref<string | undefined>(undefined)

  let current: Attempt | undefined

  const start = async (file: File): Promise<MediaRecord | undefined> => {
    const attempt: Attempt = { file, controller: new AbortController() }
    current = attempt
    status.value = 'uploading'
    percent.value = 0
    error.value = undefined

    try {
      const record = await gateway.upload({
        file,
        signal: attempt.controller.signal,
        onProgress: (value) => report(attempt, value),
      })
      if (current === attempt) status.value = 'idle'
      return record
    } catch (failure) {
      return refuse(attempt, failure)
    }
  }

  const retry = async (): Promise<MediaRecord | undefined> =>
    current ? start(current.file) : undefined

  const cancel = (): void => {
    current?.controller.abort()
  }

  const report = (attempt: Attempt, value: number): void => {
    if (current === attempt) percent.value = value
  }

  const refuse = (attempt: Attempt, failure: unknown): undefined => {
    if (current !== attempt) return undefined

    if (attempt.controller.signal.aborted) {
      status.value = 'idle'
      return undefined
    }

    status.value = 'failed'
    error.value = failure instanceof MediaError ? failure.reason : 'media-upload-failed'
    return undefined
  }

  return { status, percent, error, start, retry, cancel }
}
