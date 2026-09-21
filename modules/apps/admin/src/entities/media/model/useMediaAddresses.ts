import { ref } from 'vue'

import type { MediaRecord } from '../types'
import { useMediaGateway } from './useMediaGateway'

/**
 * The addresses a screen draws from, asked for in one call and held reactively.
 *
 * A stored `/media/<id>` means nothing to an `img` until the server signs it,
 * and `resolve` is synchronous by contract — so what it answers is copied into
 * state here, and a screen renders again when the batch comes back instead of
 * asking once during a render that was too early.
 */
export const useMediaAddresses = () => {
  const gateway = useMediaGateway()
  const addresses = ref<Record<string, string | undefined>>({})

  const rememberHeld = (urls: string[]): void => {
    for (const url of urls) addresses.value[url] = gateway.resolve(url)
  }

  /**
   * Whatever the gateway holds already, then whatever the batch adds.
   *
   * Read before the batch as well so a file this session has in hand is drawn
   * at once rather than after a round trip nobody is waiting for.
   */
  const readAddresses = async (urls: string[]): Promise<void> => {
    rememberHeld(urls)

    try {
      await gateway.prime?.(urls)
    } catch {
      // A screen that could not ask holds no address and draws the absence; the
      // reason belongs to whoever asked, and it has already been announced.
      return
    }

    rememberHeld(urls)
  }

  /** The addresses of everything one page lists, asked for together. */
  const readListed = async (records: MediaRecord[]): Promise<void> =>
    readAddresses(records.map((record) => record.url))

  const addressOf = (url: string): string | undefined => addresses.value[url]

  return { addressOf, readAddresses, readListed }
}
