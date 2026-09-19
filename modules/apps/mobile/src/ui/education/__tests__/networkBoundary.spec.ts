import { describe, expect, it } from 'vitest'

/**
 * The places allowed to reach the network, named as paths under `src`.
 *
 * Sign-in has to happen before there is anything on the device, and the sync
 * engine is what puts it there. `infra/http/` is the transport itself — a
 * class the places above construct, not a caller that goes anywhere on its own.
 *
 * There is no entry for a shared client, and that absence is the rule: a client
 * is built per connection and closes over that connection's address, so the
 * token of one server has nowhere to travel to but that server.
 */
const ALLOWED = ['app/sync.ts', 'infra/http/', 'infra/sync/', 'ui/auth/', 'usecases/auth/']

/** What building or reaching for a transport looks like in source. */
const TRANSPORT_PATTERNS: readonly [string, RegExp][] = [
  ['useApi', /\buseApi\b/],
  ['FetchHttpClient', /\bFetchHttpClient\b/],
  ['fetch(', /(?<![.\w$])fetch\s*\(/],
]

/**
 * The two that must still turn up somewhere, so an empty offender list is a
 * finding and not a broken scanner. `useApi` is not among them: a shared client
 * is what this rule abolishes, and the word is free to disappear entirely.
 */
const BUILT_SOMEWHERE = TRANSPORT_PATTERNS.filter(([name]) => name !== 'useApi')

/** Every shipped file under `src`, keyed by its path relative to `src`. */
const SOURCES: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob('/src/**/*.{ts,vue}', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>,
  )
    .map(([key, content]) => [key.replace('/src/', '').replace('?raw', ''), content] as const)
    .filter(([file]) => !file.includes('__tests__/') && !file.endsWith('.spec.ts')),
)

const files = (): string[] => Object.keys(SOURCES)

const isAllowed = (file: string): boolean =>
  ALLOWED.some((entry) => (entry.endsWith('/') ? file.startsWith(entry) : file === entry))

/**
 * A screen that reaches for the network is a screen that is empty in the metro.
 *
 * The rule is a property of the tree rather than of any one file, so it is
 * checked by walking the tree: a page added next year gets the same answer as
 * the pages that exist today, and nobody has to remember the rule to keep it.
 */
describe('only sign-in and the sync engine touch the network', () => {
  it.each(TRANSPORT_PATTERNS)('nothing outside them mentions %s', (_name, pattern) => {
    const offenders = files()
      .filter((file) => !isAllowed(file))
      .filter((file) => pattern.test(SOURCES[file]!))
      .sort()

    expect(offenders).toEqual([])
  })

  it('reads the files it claims to read, so an empty answer means something', () => {
    expect(files()).toContain('ui/education/pages/CoursesListPage.vue')
    expect(files().length).toBeGreaterThan(50)
  })

  it.each(BUILT_SOMEWHERE)('still finds %s inside the places that may', (_name, pattern) => {
    const carriers = files()
      .filter(isAllowed)
      .filter((file) => pattern.test(SOURCES[file]!))

    expect(carriers.length).toBeGreaterThan(0)
  })
})
