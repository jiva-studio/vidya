import { describe, expect, it } from 'vitest'

import { renderMarkdown } from '../model'

describe('renderMarkdown', () => {
  it('renders the markdown the student app renders', () => {
    const html = renderMarkdown('# Title\n\nSome **bold** text.')

    expect(html).toContain('<h1')
    expect(html).toContain('<strong>bold</strong>')
  })

  it('does not let a script in the lesson text survive', () => {
    const html = renderMarkdown('Hello\n\n<script>window.stolen = 1</script>')

    expect(html).not.toContain('<script')
    expect(html).not.toContain('window.stolen')
  })

  it('strips an event handler smuggled in through raw html', () => {
    const html = renderMarkdown('<img src="x" onerror="window.stolen = 1">')

    expect(html).not.toContain('onerror')
  })

  it('refuses a javascript: link', () => {
    expect(renderMarkdown('[click](javascript:alert(1))')).not.toContain('javascript:')
  })
})
