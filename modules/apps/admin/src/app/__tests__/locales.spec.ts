import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Both languages, whole: a key in one bundle and not the other is a screen that
 * reads half in Russian, and a key used in a template and defined nowhere is a
 * screen that shows the key to the operator.
 *
 * The resources are read as files rather than through the bundles, because a
 * `FluentBundle` will say whether it holds a key but not which keys it holds.
 */
const src = join(import.meta.dirname, '../..')

const filesUnder = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) filesUnder(path, out)
    else out.push(path)
  }
  return out
}

const all = filesUnder(src)

const keysIn = (language: 'en' | 'ru') =>
  new Set(
    all
      .filter((path) => path.endsWith(`${language}.ftl`))
      .flatMap((path) => [...readFileSync(path, 'utf8').matchAll(/^([a-z][\w-]*) *=/gm)])
      .map((match) => match[1]),
  )

describe('the two bundles', () => {
  it('hold the same keys, so no screen reads half in one language', () => {
    const en = keysIn('en')
    const ru = keysIn('ru')

    expect(en.size).toBeGreaterThan(50)

    expect([...en].filter((key) => !ru.has(key))).toEqual([])
    expect([...ru].filter((key) => !en.has(key))).toEqual([])
  })

  it('define every key the templates ask for', () => {
    const keys = keysIn('en')

    // `$t('some-key')` written out in full. A key assembled at runtime is a
    // computed name the search cannot follow, and those are checked by the
    // tests of the screen that builds them.
    const asked = all
      .filter(
        (path) => (path.endsWith('.vue') || path.endsWith('.ts')) && !path.includes('__tests__'),
      )
      .flatMap((path) => {
        const text = readFileSync(path, 'utf8')
        return [...text.matchAll(/\$t\('([a-z][\w-]*)'/g)].map((match) => ({
          key: match[1],
          path: path.slice(src.length + 1),
        }))
      })

    expect(asked.length).toBeGreaterThan(50)
    expect(asked.filter((use) => !keys.has(use.key))).toEqual([])
  })
})
