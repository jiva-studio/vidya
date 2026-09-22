import { describe, expect, it } from 'vitest'

import { renderInlineMarkdown, renderMarkdown } from './markdown'

const parse = (html: string): HTMLElement => {
  const host = document.createElement('div')
  host.innerHTML = html
  return host
}

describe('rendering lesson text', () => {
  it('renders the markdown the student app renders', () => {
    const html = renderMarkdown('# Title\n\nSome **bold** text.')

    expect(parse(html).querySelector('h1')?.textContent).toBe('Title')
    expect(parse(html).querySelector('strong')?.textContent).toBe('bold')
  })

  it('breaks a line where the author pressed return, not where prose typesetting would', () => {
    expect(parse(renderMarkdown('one\ntwo')).querySelectorAll('br')).toHaveLength(1)
  })

  it('lets no script written into a lesson survive into the page', () => {
    const html = renderMarkdown('Hello\n\n<script>alert(1)</script>')

    expect(parse(html).querySelector('script')).toBeNull()
    expect(html).not.toContain('alert(1)')
  })

  it('strips an event handler smuggled in through raw html', () => {
    const html = renderMarkdown('<img src="x" onerror="alert(1)">')

    expect(parse(html).querySelector('img')?.getAttribute('onerror')).toBeNull()
  })

  it('refuses a javascript: link', () => {
    expect(renderMarkdown('[click](javascript:alert(1))')).not.toContain('javascript:')
  })

  it('renders nothing for nothing', () => {
    expect(renderMarkdown('').trim()).toBe('')
  })
})

describe('rendering a single line of markdown', () => {
  it('leaves a heading mark as the text it was typed as', () => {
    const html = renderInlineMarkdown('# heading')

    expect(parse(html).querySelector('h1')).toBeNull()
    expect(parse(html).textContent).toContain('# heading')
  })

  it('produces no block-level element of any kind', () => {
    const html = renderInlineMarkdown('- one\n- two\n\n> quoted')

    expect(parse(html).querySelector('p, ul, ol, li, blockquote, h1, h2, h3')).toBeNull()
  })

  it('still marks up the emphasis a question needs', () => {
    const html = renderInlineMarkdown('the **speaker** of the *gita*')

    expect(parse(html).querySelector('strong')?.textContent).toBe('speaker')
    expect(parse(html).querySelector('em')?.textContent).toBe('gita')
  })

  it('sanitises what it renders as thoroughly as the block mode does', () => {
    const html = renderInlineMarkdown('<img src="x" onerror="alert(1)"><script>alert(2)</script>')

    expect(parse(html).querySelector('script')).toBeNull()
    expect(parse(html).querySelector('img')?.getAttribute('onerror')).toBeNull()
  })
})
