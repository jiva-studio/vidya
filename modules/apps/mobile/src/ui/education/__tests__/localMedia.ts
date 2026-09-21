import type { HttpClient, HttpQuery, MediaUrls } from '@vidya/client'
import { createMediaUrls, OfflineError } from '@vidya/client'
import type { MediaId, SignedUrl } from '@vidya/domain'
import { mediaPath, ReadWindowSeconds, toIsoDateTime } from '@vidya/domain'
import type { ResolveMediaRequest, ResolveMediaResponse } from '@vidya/protocol'
import { Routes } from '@vidya/protocol'
import type { VueWrapper } from '@vue/test-utils'

/**
 * The school files a screen can play, and the radio it needs to ask about them.
 *
 * The resolver here is the real one: only the transport and the radio are
 * doubles, so a screen meets the same closed windows, the same refusals and the
 * same paths that are not addresses as it does on a handset. A double that
 * answered addresses of its own would let a screen pass while handing a player
 * the stored path.
 */

/** The addresses the school has issued, keyed by the path a block stores. */
export const mediaAddresses = new Map<string, string>()

/** Every batch a screen asked to have primed, newest last. */
export const primedBatches: string[][] = []

/** How long the school signs for; a test that waits out a window shortens it. */
let windowSeconds = ReadWindowSeconds.video

export function signFor(seconds: number): void {
  windowSeconds = seconds
}

/** What the school answers the next batch with, when it answers with a refusal. */
let refusal: Error | undefined

export function refuseBatchWith(error: Error): void {
  refusal = error
}

const unused = (): never => {
  throw new Error('a screen may only ask the school for a batch of addresses')
}

/** How many signatures the school has issued, which is what makes each one new. */
let signatures = 0

/** The last address the school signed for a path, keyed by that path. */
const signed = new Map<string, string>()

const signedFor = (id: MediaId): [string, SignedUrl][] => {
  const path = mediaPath(id)
  const address = mediaAddresses.get(path)
  if (address === undefined) return []

  // A signature is part of the address, so signing the same file twice gives two
  // different addresses. A double that answered one string forever would let a
  // test hold a dead address and a fresh one to be the same thing.
  signatures += 1
  const url = `${address}${address.includes('?') ? '&' : '?'}sig=${signatures}`
  signed.set(path, url)

  const expiresAt = toIsoDateTime(new Date(Date.now() + windowSeconds * 1000))

  return [[id, { url, expiresAt }]]
}

/** The address the school signed for a path last; it refuses to invent one. */
export const signedAddress = (path: string): string => {
  const address = signed.get(path)
  if (address === undefined) throw new Error(`the school has signed nothing for ${path}`)

  return address
}

const schoolHttp: HttpClient = {
  get: <TResponse>(_path: string, _query?: HttpQuery): Promise<TResponse> => unused(),
  patch: <TResponse>(_path: string, _body?: unknown): Promise<TResponse> => unused(),
  delete: (_path: string): Promise<void> => unused(),
  post: async <TResponse>(path: string, body?: unknown): Promise<TResponse> => {
    if (path !== Routes().media.urls()) unused()
    if (refusal !== undefined) throw refusal
    if (!online) throw new OfflineError(path)

    const request = body as ResolveMediaRequest

    return {
      urls: Object.fromEntries(request.ids.flatMap(signedFor)),
    } as ResolveMediaResponse as TResponse
  },
}

let resolver = createMediaUrls({ http: schoolHttp, nowMs: () => Date.now() })

export const mediaUrls: MediaUrls = {
  prime: async (paths: readonly string[]): Promise<void> => {
    primedBatches.push([...paths])
    await resolver.prime(paths)
  },
  resolve: (path: string): string | undefined => resolver.resolve(path),
}

/** The address a player on the screen was handed, if there is a player at all. */
export const playerSource = (wrapper: VueWrapper): string | undefined => {
  const player = wrapper.find('video, audio')

  return player.exists() ? player.attributes('src') : undefined
}

/* -------------------------------------------------------------------------- */
/*                                  The radio                                 */
/* -------------------------------------------------------------------------- */

const networkListeners: ((status: { connected: boolean }) => void)[] = []

let online = true

/**
 * A controllable `@capacitor/network`.
 *
 * `getStatus` answers for the radio as it is, and it is the only way to learn
 * about a radio that was already off: Capacitor emits `networkStatusChange` on
 * a change, so a launch with no connection announces nothing at all.
 */
export const capacitorNetworkDouble = {
  Network: {
    addListener: (_event: string, listener: (status: { connected: boolean }) => void) => {
      networkListeners.push(listener)
      return { remove: () => undefined }
    },
    getStatus: () => Promise.resolve({ connected: online }),
  },
}

/** The radio as the app finds it, switched before anyone is told anything. */
export function startRadio(connected: boolean): void {
  online = connected
}

/** The radio changing under a running app, which Capacitor does announce. */
export function setOnline(connected: boolean): void {
  startRadio(connected)
  networkListeners.forEach((listener) => listener({ connected }))
}

/** Forgets every address and puts the school and the radio back to answering. */
export function resetMediaDoubles(): void {
  mediaAddresses.clear()
  signed.clear()
  signatures = 0
  primedBatches.length = 0
  refusal = undefined
  windowSeconds = ReadWindowSeconds.video
  resolver = createMediaUrls({ http: schoolHttp, nowMs: () => Date.now() })
  setOnline(true)
}
