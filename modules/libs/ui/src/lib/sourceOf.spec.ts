import { describe, expect, it } from 'vitest'

import { checkBlockUrl, detectSource } from './blockUrls'

describe('working out where a pasted link comes from', () => {
  it('recognises a YouTube watch link', () => {
    expect(detectSource('https://www.youtube.com/watch?v=abc123')).toBe('youtube')
  })

  it('recognises a shortened YouTube link', () => {
    expect(detectSource('https://youtu.be/abc123')).toBe('youtube')
  })

  it('recognises a Vimeo link, including its player host', () => {
    expect(detectSource('https://vimeo.com/76979871')).toBe('vimeo')
    expect(detectSource('https://player.vimeo.com/video/76979871')).toBe('vimeo')
  })

  it('treats any other well-formed https address as a direct link', () => {
    expect(detectSource('https://example.org/lecture.mp4')).toBe('url')
  })

  it('never promotes a host that only looks like one of the embed sites', () => {
    expect(detectSource('https://youtube.com.evil.example/watch?v=abc')).toBe('url')
    expect(detectSource('https://notvimeo.com/76979871')).toBe('url')
  })

  it('refuses a link that is not an address at all', () => {
    expect(detectSource('not a link')).toBeUndefined()
    expect(detectSource('')).toBeUndefined()
  })

  it('refuses a scheme a lesson may not carry', () => {
    expect(detectSource('javascript:alert(1)')).toBeUndefined()
    expect(detectSource('data:text/html,<script>alert(1)</script>')).toBeUndefined()
    expect(detectSource('ftp://example.org/lecture.mp4')).toBeUndefined()
  })

  it('ignores the whitespace around a pasted link', () => {
    expect(detectSource('  https://vimeo.com/76979871  ')).toBe('vimeo')
  })
})

describe('the address an uploaded file is stored under', () => {
  it('accepts the relative path the gateway hands back', () => {
    expect(checkBlockUrl('upload', '/media/00000000-0000-4000-8000-000000000001')).toBeUndefined()
  })

  it('accepts a relative path for nothing but an upload', () => {
    expect(checkBlockUrl('url', '/media/00000000-0000-4000-8000-000000000001')).toBe(
      'url-malformed',
    )
    expect(checkBlockUrl('youtube', '/media/abc')).toBe('url-malformed')
  })

  it('refuses a path that would reach another origin', () => {
    expect(checkBlockUrl('upload', '//evil.example/media/abc')).toBe('url-malformed')
    expect(checkBlockUrl('upload', 'media/abc')).toBe('url-malformed')
  })

  it('still refuses a scheme no block may carry, whatever the source says', () => {
    expect(checkBlockUrl('upload', 'javascript:alert(1)')).toBe('url-scheme')
  })

  it('still asks for something to be entered', () => {
    expect(checkBlockUrl('upload', '  ')).toBe('url-required')
  })

  it('does not call an uploaded path an embed', () => {
    expect(detectSource('/media/00000000-0000-4000-8000-000000000001')).toBeUndefined()
  })
})
