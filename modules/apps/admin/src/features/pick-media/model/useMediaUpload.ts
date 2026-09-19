import { ref } from 'vue'

import type { MediaRecord } from '@/entities/media'
import { MediaError, useMediaGateway } from '@/entities/media'

export type UploadStatus = 'idle' | 'uploading' | 'failed'

/**
 * One file on its way to storage, with the two ways out an author needs.
 *
 * A cancelled upload is not a failure and says nothing: the author asked for it
 * to stop. Only a refusal leaves a reason behind, and the file is kept so that
 * retrying sends the same bytes rather than asking for them again.
 */
export const useMediaUpload = () => {
  const gateway = useMediaGateway()

  const status = ref<UploadStatus>('idle')
  const percent = ref(0)
  const error = ref<string | undefined>(undefined)

  let controller: AbortController | undefined
  let pending: File | undefined

  const start = async (file: File): Promise<MediaRecord | undefined> => {
    pending = file
    controller = new AbortController()
    status.value = 'uploading'
    percent.value = 0
    error.value = undefined

    try {
      const record = await gateway.upload({
        file,
        signal: controller.signal,
        onProgress: (value) => (percent.value = value),
      })
      status.value = 'idle'
      return record
    } catch (failure) {
      return refuse(failure)
    }
  }

  const retry = async (): Promise<MediaRecord | undefined> => (pending ? start(pending) : undefined)

  const cancel = (): void => {
    controller?.abort()
  }

  const refuse = (failure: unknown): undefined => {
    if (controller?.signal.aborted) {
      status.value = 'idle'
      return undefined
    }

    status.value = 'failed'
    error.value = failure instanceof MediaError ? failure.reason : 'media-upload-failed'
    return undefined
  }

  return { status, percent, error, start, retry, cancel }
}
