import { describe, expect, it } from 'vitest'

/**
 * The places allowed to reach the network, named as paths under `src`.
 *
 * Sign-in has to happen before there is anything on the device, and the sync
 * engine is what puts it there. `infra/http/` is the transport itself — a thing
 * the places above construct, not a caller that goes anywhere on its own.
 *
 * There is no entry for a shared client, and that absence is the rule: a client
 * is built per connection and closes over that connection's address, so a token
 * held for one school has nowhere to travel but that school's server.
 */
const ALLOWED = ['app/sync.ts', 'infra/http/', 'infra/sync/', 'ui/auth/', 'usecases/auth/']

/**
 * One way out of the app and onto the network.
 *
 * A name rather than a regular expression is the thing being banned, because
 * the point is not to spell three strings correctly: anything that opens a
 * socket from a screen makes that screen blank in the metro, and which API it
 * used does not change that. Every entry carries specimens so the expression is
 * checked against the escape it is supposed to recognise — for the several of
 * them that appear nowhere in this tree, that is the only check there can be,
 * and a pattern nobody has ever seen match is a pattern that protects nothing.
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
   * app does not use at all — they are doors being locked before anyone tries
   * them, and their expressions are held up by their specimens instead.
   */
  readonly builtHere: boolean

  /** Source that must be recognised as this escape. */
  readonly specimens: readonly string[]

  /** Source that merely looks like it and must not be. */
  readonly innocents?: readonly string[]
}

const ESCAPES: readonly Escape[] = [
  {
    name: 'useApi',
    // The shared client this rule abolished. Kept as a door that stays shut.
    pattern: /\buseApi\b/,
    builtHere: false,
    specimens: ['const api = useApi()'],
  },
  {
    name: 'httpClientFor',
    pattern: /\bhttpClientFor\b/,
    builtHere: true,
    specimens: ['const client = httpClientFor({ baseUrl, session: () => undefined })'],
  },
  {
    name: 'FetchHttpClient',
    pattern: /\bFetchHttpClient\b/,
    builtHere: true,
    specimens: ['new FetchHttpClient({ baseUrl })'],
  },
  {
    name: 'fetch',
    // No dot in the lookbehind: `globalThis.fetch(...)` is the same call, and
    // an object of this app's own with a `fetch` method would be a transport
    // wearing a hat.
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
    name: 'CapacitorHttp',
    // Unused today and reachable from any file with one import, which is
    // exactly the kind of door a screen written next year walks through.
    pattern: /\bCapacitorHttp\b/,
    builtHere: false,
    specimens: ['await CapacitorHttp.get({ url })'],
  },
]

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

const named = (escapes: readonly Escape[]) =>
  escapes.map((escape) => [escape.name, escape] as const)

const withSamples = (pick: (escape: Escape) => readonly string[]) =>
  ESCAPES.flatMap((escape) => pick(escape).map((sample) => [escape.name, sample, escape] as const))

/**
 * A screen that reaches for the network is a screen that is empty in the metro.
 *
 * The rule is a property of the tree rather than of any one file, so it is
 * checked by walking the tree: a page added next year gets the same answer as
 * the pages that exist today, and nobody has to remember the rule to keep it.
 */
describe('only sign-in and the sync engine touch the network', () => {
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
    expect(files()).toContain('ui/education/pages/CoursesListPage.vue')
    expect(files().length).toBeGreaterThan(50)
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
