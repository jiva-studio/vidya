import type { MediaUrls } from '@vidya/client'
import { HttpError } from '@vidya/client'
import type { LessonBlock } from '@vidya/protocol'
import { computed, onScopeDispose, ref, watch } from 'vue'

import { useNetworkStatus } from '@/shared'

import type { MediaAddresses, MediaUnavailableReason } from '../model/sectionMedia'
import { listMediaSources, listSchoolFilePaths, resolveAddresses } from '../model/sectionMedia'

export interface SectionMediaOptions {
  readonly urls: MediaUrls

  /** The blocks on screen right now; another section is another batch. */
  readonly blocks: () => readonly LessonBlock[]
}

/**
 * How often the addresses on screen are checked against their windows.
 *
 * The resolver answers addresses and not expiries, so the only way to learn
 * that a window has closed is to read again. A second is short against a
 * six-hour signature and costs a map lookup per file of the section.
 */
const WINDOW_CHECK_MS = 1000

/**
 * The addresses the blocks of the section on screen play at.
 *
 * The section is primed once and then read from memory, and it is primed again
 * when the radio comes back: a lesson opened underground has everything it
 * needs except permission to read its files, and nobody reopens a lesson to
 * find out whether the video works now. It is primed again when a window
 * closes, too — a signature dies mid-lecture, and a player handed the dead
 * address has no way to ask for another. Re-priming changes what the resolver
 * answers without touching the blocks, so a video that was already playing
 * keeps its position.
 */
export function useSectionMedia(options: SectionMediaOptions) {
  const revision = ref(0)
  const reason = ref<MediaUnavailableReason>('needs-connection')
  const sources = computed(() => listMediaSources(options.blocks()))
  const wanted = computed(() => listSchoolFilePaths(options.blocks()))

  /** The paths the last batch came back with, which are the ones with a window. */
  let issued: string[] = []

  const addresses = computed<MediaAddresses>(() => {
    // The resolver holds its cache and its windows where Vue cannot see them, so
    // a priming and a window found closed are what a render depends on instead.
    void revision.value

    return resolveAddresses(sources.value, (source) => options.urls.resolve(source))
  })

  const prime = async () => {
    if (wanted.value.length === 0) return

    try {
      await options.urls.prime(wanted.value)
      reason.value = 'needs-connection'
    } catch (error) {
      // Answered by the screen rather than reported: the student is owed the
      // difference between a file that waits for a connection and one the school
      // has stopped opening for them.
      reason.value = isRefused(error) ? 'not-permitted' : 'needs-connection'
    }

    issued = wanted.value.filter((path) => options.urls.resolve(path) !== undefined)
    revision.value += 1
  }

  const askAgainForClosedWindows = () => {
    if (issued.every((path) => options.urls.resolve(path) !== undefined)) return

    issued = []
    revision.value += 1
    void prime()
  }

  const windowWatch = setInterval(askAgainForClosedWindows, WINDOW_CHECK_MS)
  onScopeDispose(() => clearInterval(windowWatch))

  // Watched as one string: the same paths read a second time are the same
  // batch, and a page that reloads the lesson it is already showing must not
  // ask the school again.
  watch(
    () => wanted.value.join('\n'),
    () => void prime(),
    { immediate: true },
  )

  watch(useNetworkStatus().connected, (connected) => {
    if (connected) void prime()
  })

  return { addresses, reason }
}

/** A read the school will not open, as opposed to one that never left the device. */
const isRefused = (error: unknown): boolean => error instanceof HttpError && error.status === 403
