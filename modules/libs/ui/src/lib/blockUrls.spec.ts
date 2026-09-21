import { describe, expect, it } from 'vitest'

import { checkBlockUrl, embedSrc, isEmbedSource, mediaSrc } from './blockUrls'

describe('checkBlockUrl', () => {
  it('accepts http and https', () => {
    expect(checkBlockUrl('url', 'http://example.org/a.mp4')).toBeUndefined()
    expect(checkBlockUrl('url', 'https://example.org/a.mp4')).toBeUndefined()
  })

  it('refuses javascript: and data: rather than storing them', () => {
    expect(checkBlockUrl('url', 'javascript:alert(1)')).toBe('url-scheme')
    expect(checkBlockUrl('url', 'data:text/html;base64,PHNjcmlwdD4=')).toBe('url-scheme')
    expect(checkBlockUrl('url', 'JaVaScRiPt:alert(1)')).toBe('url-scheme')
  })

  it('refuses an empty or unparseable address', () => {
    expect(checkBlockUrl('url', '   ')).toBe('url-required')
    expect(checkBlockUrl('url', 'not a url')).toBe('url-malformed')
  })

  it('holds embeds to their own hosts', () => {
    expect(checkBlockUrl('youtube', 'https://www.youtube.com/watch?v=abc')).toBeUndefined()
    expect(checkBlockUrl('youtube', 'https://youtu.be/abc')).toBeUndefined()
    expect(checkBlockUrl('vimeo', 'https://vimeo.com/123')).toBeUndefined()
    expect(checkBlockUrl('youtube', 'https://evil.example/watch?v=abc')).toBe('url-host')
    expect(checkBlockUrl('vimeo', 'https://youtube.com/watch?v=abc')).toBe('url-host')
  })

  it('knows which sources are embedded at all', () => {
    expect(isEmbedSource('youtube')).toBe(true)
    expect(isEmbedSource('vimeo')).toBe(true)
    expect(isEmbedSource('url')).toBe(false)
    expect(isEmbedSource('upload')).toBe(false)
  })
})

describe('embed and player addresses', () => {
  it('turns a watch link into the host embed address', () => {
    expect(embedSrc('youtube', 'https://www.youtube.com/watch?v=abc')).toBe(
      'https://www.youtube.com/embed/abc',
    )
    expect(embedSrc('youtube', 'https://youtu.be/abc')).toBe('https://www.youtube.com/embed/abc')
    expect(embedSrc('vimeo', 'https://vimeo.com/123')).toBe('https://player.vimeo.com/video/123')
  })

  it('gives nothing for a refused link, so no frame is ever pointed at it', () => {
    expect(embedSrc('youtube', 'javascript:alert(1)')).toBeUndefined()
    expect(embedSrc('youtube', 'https://evil.example/watch?v=abc')).toBeUndefined()
    expect(embedSrc('url', 'https://example.org/a.mp4')).toBeUndefined()
  })

  it('gives a direct address only for a checked, non-embed link', () => {
    expect(mediaSrc('url', ' https://example.org/a.mp3 ')).toBe('https://example.org/a.mp3')
    expect(mediaSrc('url', 'javascript:alert(1)')).toBeUndefined()
    expect(mediaSrc('youtube', 'https://youtu.be/abc')).toBeUndefined()
  })
})
