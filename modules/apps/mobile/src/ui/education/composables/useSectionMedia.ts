import type { MediaUrls } from '@vidya/client'
import type { LessonBlock } from '@vidya/protocol'
import { computed, ref, watch } from 'vue'

import { useNetworkStatus } from '@/shared'

import type { MediaAddresses } from '../model/sectionMedia'
import { listMediaSources, listSchoolFilePaths, resolveAddresses } from '../model/sectionMedia'

export interface SectionMediaOptions {
  readonly urls: MediaUrls

  /** The blocks on screen right now; another section is another batch. */
  readonly blocks: () => readonly LessonBlock[]
}

/**
 * The addresses the blocks of the section on screen play at.
 *
 * The section is primed once and then read from memory, and it is primed again
 * when the radio comes back: a lesson opened underground has everything it
 * needs except permission to read its files, and nobody reopens a lesson to
 * find out whether the video works now. Re-priming changes what the resolver
 * answers without touching the blocks, so a video that was already playing
 * keeps its position.
 */
export function useSectionMedia(options: SectionMediaOptions) {
  const primings = ref(0)
  const sources = computed(() => listMediaSources(options.blocks()))
  const wanted = computed(() => listSchoolFilePaths(options.blocks()))

  const addresses = computed<MediaAddresses>(() => {
    // The resolver holds its cache where Vue cannot see it, so a priming is
    // what a render has to depend on.
    void primings.value

    return resolveAddresses(sources.value, (source) => options.urls.resolve(source))
  })

  const prime = async () => {
    if (wanted.value.length === 0) return

    try {
      await options.urls.prime(wanted.value)
    } catch {
      // Answered by the screen rather than reported: a batch that could not be
      // asked for leaves its blocks unresolved, and an unresolved block says
      // it waits for a connection instead of pointing a player at nothing.
    }

    primings.value += 1
  }

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

  return { addresses }
}
