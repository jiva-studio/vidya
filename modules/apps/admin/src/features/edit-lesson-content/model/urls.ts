import type { BlockSource } from '@vidya/domain'

import type { UrlProblem } from '../types'

/**
 * Hosts an embed may come from.
 *
 * An embed runs in a frame on the operator's own origin's neighbourhood, so the
 * host is part of the contract rather than a detail of the link: anything else
 * is either a mistake or someone using a lesson to frame a page of their own.
 */
export const EmbedHosts: Readonly<Record<'youtube' | 'vimeo', readonly string[]>> = Object.freeze({
  youtube: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'],
  vimeo: ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'],
})

export const isEmbedSource = (source: BlockSource): source is 'youtube' | 'vimeo' =>
  source === 'youtube' || source === 'vimeo'

const parsed = (url: string): URL | undefined => {
  try {
    return new URL(url.trim())
  } catch {
    return undefined
  }
}

/**
 * The path an uploaded file is stored under: relative, and on this origin.
 *
 * A leading `//` is not a path but another origin's authority, so it is refused
 * here rather than after `new URL()` has quietly accepted it.
 */
const isSameOriginPath = (url: string): boolean => url.startsWith('/') && !url.startsWith('//')

/**
 * Whether a media link may be stored, and why not when it may not.
 *
 * `javascript:` and `data:` parse as perfectly good URLs, which is exactly why
 * the scheme is checked rather than assumed: they are refused here, in the
 * model, so no screen can be the one that forgot.
 */
export const checkBlockUrl = (source: BlockSource, url: string): UrlProblem | undefined => {
  const trimmed = url.trim()
  if (!trimmed) return 'url-required'

  const target = parsed(trimmed)

  // An uploaded file is addressed by `/media/<id>`, which `new URL()` refuses
  // without a base. The path stays relative because that is what the server
  // will serve; an absolute dev address would be saved into the lesson.
  if (!target) return source === 'upload' && isSameOriginPath(trimmed) ? undefined : 'url-malformed'
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return 'url-scheme'

  const host = target.hostname.toLowerCase()
  if (isEmbedSource(source) && !EmbedHosts[source].includes(host)) return 'url-host'

  return undefined
}

const youtubeEmbed = (target: URL): string => {
  const id =
    target.hostname === 'youtu.be' ? target.pathname.slice(1) : target.searchParams.get('v')
  return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : target.toString()
}

const vimeoEmbed = (target: URL): string => {
  const id = target.pathname.split('/').filter(Boolean).pop()
  return id ? `https://player.vimeo.com/video/${encodeURIComponent(id)}` : target.toString()
}

/** The address a frame may load, or nothing when the link is not an accepted embed. */
export const embedSrc = (source: BlockSource, url: string): string | undefined => {
  if (!isEmbedSource(source) || checkBlockUrl(source, url)) return undefined

  const target = parsed(url)
  if (!target) return undefined

  return source === 'youtube' ? youtubeEmbed(target) : vimeoEmbed(target)
}

/** The address a native player may load: validated, and never an embed page. */
export const mediaSrc = (source: BlockSource, url: string): string | undefined =>
  isEmbedSource(source) || checkBlockUrl(source, url) ? undefined : url.trim()

/**
 * The source a pasted link implies, so the author is not asked to classify it.
 *
 * A host nobody recognises is a direct link and never an embed: promoting one
 * would put a page of somebody else's choosing in a frame beside the lesson.
 */
export const sourceOf = (url: string): BlockSource | undefined => {
  const target = parsed(url)
  if (!target) return undefined
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return undefined

  const host = target.hostname.toLowerCase()
  const embed = (['youtube', 'vimeo'] as const).find((source) => EmbedHosts[source].includes(host))

  return embed ?? 'url'
}
