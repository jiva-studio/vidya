import { describe, expect, it } from 'vitest'

/**
 * The places allowed to reach the network, named as paths under the package.
 *
 * The http adapter is what a transport is made of, and the sync engine's
 * client is the one caller that speaks the sync protocol directly. Everything
 * else — the ports, the scenarios, the repositories, the store and its
 * migrations — receives an `HttpClient` and calls it.
 */
const ALLOWED = ['infra/http/', 'infra/sync/']

/**
 * Files that ship no behaviour and are excluded from the walk.
 *
 * Named one by one rather than matched: a rule that skips whatever looks like
 * a helper skips the production file somebody names `testing.ts` next year.
 */
const HELPERS = ['testing.ts', 'infra/persistence/testing.ts']

/**
 * One way out of the package and onto the network.
 *
 * A name rather than a regular expression is the thing being banned, because
 * the point is not to spell three strings correctly: a repository that opens a
 * socket of its own is a repository that cannot be run offline or in a test,
 * and which API it used does not change that. Every entry carries specimens so
 * the expression is checked against the escape it is supposed to recognise —
 * for the several of them that appear nowhere in this tree, that is the only
 * check there can be, and a pattern nobody has ever seen match is a pattern
 * that protects nothing.
 */
interface Escape {
  readonly name: string
  readonly pattern: RegExp

  /**
   * Whether the allowed places are expected to contain it.
   *
   * `true` for what the transport is actually made of, and those get a second
   * check: the scanner has to find them where they do live, or an empty
   * offender list means only that the walk is broken. `false` for the ones this
   * package does not use at all — they are doors being locked before anyone
   * tries them, and their expressions are held up by their specimens instead.
   */
  readonly builtHere: boolean

  /** Source that must be recognised as this escape. */
  readonly specimens: readonly string[]

  /** Source that merely looks like it and must not be. */
  readonly innocents?: readonly string[]
}

const ESCAPES: readonly Escape[] = [
  {
    name: 'FetchHttpClient',
    pattern: /\bFetchHttpClient\b/,
    builtHere: true,
    specimens: ['new FetchHttpClient({ baseUrl })'],
  },
  {
    name: 'fetch',
    // No dot in the lookbehind: `globalThis.fetch(...)` is the same call, and
    // an object of this package's own with a `fetch` method would be a
    // transport wearing a hat.
    pattern: /(?<![\w$])fetch\s*\(/,
    builtHere: true,
    specimens: [
      "await fetch('/auth/profile')",
      "await globalThis.fetch('https://elsewhere.test')",
      "await window.fetch('/x')",
      "await self.fetch('/x')",
    ],
    innocents: ['const refetch = () => reload()', 'void prefetch(route)', 'fetchHttpClient.ts'],
  },
  {
    name: 'httpClientFor',
    pattern: /\bhttpClientFor\b/,
    builtHere: true,
    specimens: ['const client = httpClientFor({ baseUrl, session: () => undefined })'],
  },
  {
    name: 'useApi',
    // The shared client this rule abolished. Kept as a door that stays shut.
    pattern: /\buseApi\b/,
    builtHere: false,
    specimens: ['const api = useApi()'],
  },
  {
    name: 'XMLHttpRequest',
    pattern: /\bXMLHttpRequest\b/,
    builtHere: false,
    specimens: ['const request = new XMLHttpRequest()'],
  },
  {
    name: 'sendBeacon',
    pattern: /\bsendBeacon\s*\(/,
    builtHere: false,
    specimens: ["navigator.sendBeacon('/collect', body)"],
  },
  {
    name: 'WebSocket',
    pattern: /\bWebSocket\b/,
    builtHere: false,
    specimens: ["const socket = new WebSocket('wss://elsewhere.test')"],
  },
  {
    name: 'EventSource',
    pattern: /\bEventSource\b/,
    builtHere: false,
    specimens: ["const stream = new EventSource('/events')"],
  },
  {
    name: 'axios',
    pattern: /\baxios\b/,
    builtHere: false,
    specimens: ["import axios from 'axios'", 'await axios.get(url)'],
  },
  {
    name: 'CapacitorHttp',
    // Unused today and reachable from any file with one import, which is
    // exactly the kind of door a repository written next year walks through.
    pattern: /\bCapacitorHttp\b/,
    builtHere: false,
    specimens: ['await CapacitorHttp.get({ url })'],
  },
]

/** Every shipped file of this package, keyed by its path relative to the package root. */
const SOURCES: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob(['/**/*.ts', '!/node_modules/**', '!/**/*.config.ts'], {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>,
  )
    .map(([key, content]) => [key.replace(/^\//, '').replace('?raw', ''), content] as const)
    .filter(([file]) => !file.includes('__tests__/') && !file.endsWith('.spec.ts'))
    .filter(([file]) => !HELPERS.includes(file)),
)

const files = (): string[] => Object.keys(SOURCES)

const isAllowed = (file: string): boolean =>
  ALLOWED.some((entry) => (entry.endsWith('/') ? file.startsWith(entry) : file === entry))

const named = (escapes: readonly Escape[]) =>
  escapes.map((escape) => [escape.name, escape] as const)

const withSamples = (pick: (escape: Escape) => readonly string[]) =>
  ESCAPES.flatMap((escape) => pick(escape).map((sample) => [escape.name, sample, escape] as const))

/**
 * A hexagon whose inside names a transport is a hexagon that cannot be tested.
 *
 * The rule is a property of the tree rather than of any one file, so it is
 * checked by walking the tree: a repository added next year gets the same
 * answer as the ones that exist today, and nobody has to remember the rule to
 * keep it.
 */
describe('only the http adapter and the sync client touch the network', () => {
  it.each(named(ESCAPES))(
    'nothing outside them reaches the network through %s',
    (_name, escape) => {
      const offenders = files()
        .filter((file) => !isAllowed(file))
        .filter((file) => escape.pattern.test(SOURCES[file]!))
        .sort()

      expect(offenders).toEqual([])
    },
  )

  it('reads the files it claims to read, so an empty answer means something', () => {
    expect(files()).toContain('infra/repositories/sql/coursesRepository.sql.ts')
    expect(files()).toContain('usecases/sync/engine.ts')
    expect(files()).toContain('ports/http.ts')
    expect(files()).toContain('infra/persistence/migrations/001_local_schema.ts')
    expect(files().length).toBeGreaterThan(40)
  })

  it('leaves out the test helpers by name and nothing else', () => {
    expect(files()).not.toContain('testing.ts')
    expect(files()).not.toContain('infra/persistence/testing.ts')
    expect(files().filter((file) => file.endsWith('testing.ts'))).toEqual([])
  })

  it.each(withSamples((escape) => escape.specimens))(
    'recognises %s written as `%s`',
    (_name, sample, escape) => {
      expect(escape.pattern.test(sample)).toBe(true)
    },
  )

  it.each(withSamples((escape) => escape.innocents ?? []))(
    'does not mistake `%s` for %s',
    (_name, sample, escape) => {
      expect(escape.pattern.test(sample)).toBe(false)
    },
  )

  it.each(named(ESCAPES.filter((escape) => escape.builtHere)))(
    'still finds %s inside the places that may',
    (_name, escape) => {
      const carriers = files()
        .filter(isAllowed)
        .filter((file) => escape.pattern.test(SOURCES[file]!))

      expect(carriers.length).toBeGreaterThan(0)
    },
  )
})
