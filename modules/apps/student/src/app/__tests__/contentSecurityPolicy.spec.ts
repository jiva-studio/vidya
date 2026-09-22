import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { beforeAll, describe, expect, it } from 'vitest'

// Prettier is free to wrap the tag's attributes onto their own lines, so the
// match tolerates whitespace rather than pinning an exact rendering of it.
const CSP_META_TAG = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"\s*\/?>/

// `student/`, three levels up from this file's own directory.
const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

/**
 * `index.html` carries the policy as a `<meta>` tag, the only enforcement this
 * document has until a gateway can add the response header `frame-ancestors`
 * needs. Reading the source file would only prove the tag was typed correctly,
 * not that it survives Vite; this builds the real bundle and reads the
 * `index.html` that would actually ship.
 *
 * It is the one suite the mutation runs leave out (`stryker.config.json`): a
 * real build resolves the design tokens through this package's own alias, and
 * a copy of the tree under another root cannot find them.
 */
describe('the document policy that ships', () => {
  let builtHtml: string

  beforeAll(async () => {
    // Imported lazily: pulling Vite's build API into every suite's module
    // graph would be its own kind of noise, and only this file needs it.
    const { build } = await import('vite')

    const result = await build({ root: siteRoot, logLevel: 'silent', build: { write: false } })

    // `build()` also answers watch mode and a multi-config array; neither
    // applies to the single, one-shot config passed above.
    if (Array.isArray(result) || !('output' in result)) {
      throw new Error('vite build did not return a single in-memory bundle to inspect')
    }

    const html = result.output.find((item) => item.fileName === 'index.html')
    if (!html || html.type !== 'asset' || typeof html.source !== 'string') {
      throw new Error('vite build produced no index.html asset to inspect')
    }
    builtHtml = html.source
  }, 120_000)

  it('carries the Content-Security-Policy meta tag into the built HTML', () => {
    const match = builtHtml.match(CSP_META_TAG)

    expect(match?.[1]).toBe(
      "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'",
    )
  })

  it('lets the page compile the wasm the local database is, and nothing more', () => {
    const directives = builtHtml.match(CSP_META_TAG)?.[1] ?? ''

    // Without this the browser refuses `WebAssembly.instantiate` outright and
    // the site opens with no database at all.
    expect(directives).toContain("'wasm-unsafe-eval'")

    // The weaker relative that also opens `eval()`, and the wildcards that
    // would make the rest of the policy decorative.
    expect(directives).not.toContain("'unsafe-eval'")
    expect(directives).not.toContain('*')
    expect(directives).not.toContain("script-src 'unsafe-inline'")
  })

  it('ships no inline <style> or <script> tag for the policy to have to excuse', () => {
    // The policy comment itself talks about `<style>` blocks in prose; strip
    // comments first so the assertion is about markup, not about the words
    // used to explain it.
    const markup = builtHtml.replace(/<!--[\s\S]*?-->/g, '')

    expect(markup).not.toMatch(/<style[\s>]/)
    expect(markup).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/)
  })
})
