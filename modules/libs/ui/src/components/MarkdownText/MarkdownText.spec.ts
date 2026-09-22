import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import MarkdownText from './MarkdownText.vue'

const draw = (markdown: string, inline = false) =>
  mount(MarkdownText, { props: { markdown, inline } })

/** `src/` of the library: the claim below is made about all of its source. */
const root = join(import.meta.dirname, '../..')

const sourceFiles = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) sourceFiles(path, out)
    else if (/\.(ts|vue)$/.test(entry)) out.push(path)
  }
  return out
}

describe('MarkdownText', () => {
  it('gives the text the shape the author typed', () => {
    const page = draw('# Letters\n\nRead **left to right**')

    expect(page.get('h1').text()).toBe('Letters')
    expect(page.html()).toContain('<strong>left to right</strong>')
  })

  it('keeps block grammar out of a line laid out by something else', () => {
    const page = draw('# heading', true)

    expect(page.findAll('h1')).toEqual([])
    expect(page.text()).toContain('# heading')
  })

  it('drops a script the author typed, because the text is not trusted', () => {
    expect(draw('Hello\n\n<script>alert(1)</script>').html()).not.toContain('<script>')
  })

  it('is the only place in the library that writes raw html, beside the sanitiser', () => {
    const withHtml = sourceFiles(root)
      .filter((path) => path.endsWith('.vue'))
      .map((path) => ({ path, text: readFileSync(path, 'utf8') }))
      .filter((file) => file.text.includes('v-html'))

    expect(withHtml).toHaveLength(1)
    expect(withHtml[0].text).toContain('renderMarkdown')
  })
})
