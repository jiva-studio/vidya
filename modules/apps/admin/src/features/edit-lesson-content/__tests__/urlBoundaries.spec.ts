import { describe, expect, it } from 'vitest'

import { checkBlockUrl, detectSource } from '../model/urls'

/** Where a stored relative path would actually point once a browser resolves it. */
const resolved = (path: string): string => new URL(path, 'https://school.example').origin

describe('every scheme a block may not carry', () => {
  it('refuses the scheme whatever case it is written in', () => {
    expect(checkBlockUrl('url', 'JavaScript:alert(1)')).toBe('url-scheme')
    expect(checkBlockUrl('url', 'DATA:text/html;base64,PHNjcmlwdD4=')).toBe('url-scheme')
  })

  it('refuses a scheme hidden behind whitespace or a control character', () => {
    expect(checkBlockUrl('url', '  javascript:alert(1)  ')).toBe('url-scheme')
    expect(checkBlockUrl('url', 'java\nscript:alert(1)')).toBe('url-scheme')
    expect(checkBlockUrl('url', 'java\tscript:alert(1)')).toBe('url-scheme')
  })

  it('refuses the schemes that carry their payload with them', () => {
    expect(checkBlockUrl('url', 'blob:https://school.example/9f2a')).toBe('url-scheme')
    expect(checkBlockUrl('url', 'file:///etc/passwd')).toBe('url-scheme')
    expect(checkBlockUrl('url', 'vbscript:msgbox(1)')).toBe('url-scheme')
  })

  it('never derives a source for a scheme no block may carry', () => {
    expect(detectSource('javascript:alert(1)')).toBeUndefined()
    expect(detectSource('blob:https://school.example/9f2a')).toBeUndefined()
    expect(detectSource('data:text/html,<script>')).toBeUndefined()
  })
})

describe('an authority smuggled into a relative path', () => {
  it('refuses the protocol-relative form', () => {
    expect(checkBlockUrl('upload', '//evil.example/x')).toBe('url-malformed')
  })

  it('refuses a backslash where the second slash of an authority would be', () => {
    expect(resolved('/\\evil.example/x')).toBe('https://evil.example')
    expect(checkBlockUrl('upload', '/\\evil.example/x')).toBe('url-malformed')
  })

  it('refuses an authority split apart by a stripped control character', () => {
    expect(resolved('/\t/evil.example/x')).toBe('https://evil.example')
    expect(checkBlockUrl('upload', '/\t/evil.example/x')).toBe('url-malformed')
  })

  it('refuses a path that is not rooted at all', () => {
    expect(checkBlockUrl('upload', 'media/abc')).toBe('url-malformed')
    expect(checkBlockUrl('upload', '\\\\evil.example\\x')).toBe('url-malformed')
  })

  it('lets no source but an upload through with a relative path', () => {
    expect(checkBlockUrl('url', '/media/abc')).toBe('url-malformed')
    expect(checkBlockUrl('youtube', '/media/abc')).toBe('url-malformed')
    expect(checkBlockUrl('vimeo', '/media/abc')).toBe('url-malformed')
  })
})

describe('addresses that parse but are not what they look like', () => {
  it('reads a single-slash http address as the host it really names', () => {
    expect(checkBlockUrl('url', 'https:/evil.example/x')).toBeUndefined()
    expect(detectSource('https:/evil.example/x')).toBe('url')
  })

  it('holds an embed to its own host however the link is dressed up', () => {
    expect(checkBlockUrl('youtube', 'https://youtube.com.evil.example/watch?v=1')).toBe('url-host')
    expect(checkBlockUrl('youtube', 'https://evil.example/?youtube.com')).toBe('url-host')
    expect(checkBlockUrl('vimeo', 'https://evil.example/#vimeo.com')).toBe('url-host')
  })

  it('accepts an embed host written in any case, since a host is case-insensitive', () => {
    expect(checkBlockUrl('youtube', 'https://WWW.YouTube.com/watch?v=1')).toBeUndefined()
  })

  it('refuses userinfo pointing at an allowed host from somewhere else', () => {
    expect(checkBlockUrl('youtube', 'https://www.youtube.com@evil.example/x')).toBe('url-host')
  })
})
