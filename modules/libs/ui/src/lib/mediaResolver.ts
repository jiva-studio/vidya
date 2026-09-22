import type { InjectionKey } from 'vue'

/** Answers with an address a player may load, or nothing when there is none. */
export type MediaResolver = (url: string) => string | undefined

/**
 * How an uploaded file in a lesson reaches an address.
 *
 * What a block stores is a path the application serves, so the renderer asks
 * for an address instead of pointing a player at the stored path: handing that
 * path to a player has the server answer with its own HTML, which reads as a
 * broken file rather than a missing one. An application that serves no uploads
 * provides nothing, and an uploaded block draws as unplayable.
 */
export const mediaResolverKey: InjectionKey<MediaResolver> = Symbol('vidya.ui.mediaResolver')
