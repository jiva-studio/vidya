import { describe, expect, it } from 'vitest'

/**
 * One way out of the site and onto the network.
 *
 * A name rather than a general rule about "requests", because the point is not
 * to spell three strings correctly: a screen that opens a socket of its own is
 * a screen that cannot be read offline, that bypasses the outbox, and that
 * sends the student's work where synchronisation cannot retry it. Which API it
 * used does not change that.
 *
 * Every entry carries specimens, so the expression is checked against the
 * escape it is supposed to recognise — for the several that appear nowhere in
 * this tree, that is the only check there can be, and a pattern nobody has
 * ever seen match is a pattern that protects nothing.
 */
interface Escape {
  readonly name: string
  readonly pattern: RegExp

  /**
   * Where it may appear, as paths under `src/`. A path ending in `/` is a
   * directory; anything else is one file.
   */
  readonly allowedIn: readonly string[]

  /**
   * Whether the allowed places are expected to contain it.
   *
   * `true` for what this site's transport is actually made of, and those get a
   * second check: the scanner has to find them where they do live, or an empty
   * offender list means only that the walk is broken.
   */
  readonly builtHere: boolean

  /** Source that must be recognised as this escape. */
  readonly specimens: readonly string[]

  /** Source that merely looks like it and must not be. */
  readonly innocents?: readonly string[]
}

/**
 * The composition root builds the one transport this site has; the sign-in
 * slice is handed it and makes the three requests that exist before there is
 * anything to synchronise — asking for a code, exchanging it, and asking the
 * server whose tokens these are.
 */
const TRANSPORT_ROOT = 'app/connection.ts'

const SIGN_IN = 'features/auth-otp/'

const ESCAPES: readonly Escape[] = [
  {
    name: 'httpClientFor',
    pattern: /\bhttpClientFor\b/,
    allowedIn: [TRANSPORT_ROOT],
    builtHere: true,
    specimens: ['const client = httpClientFor({ baseUrl, session: () => undefined })'],
  },
  {
    name: 'useHttp',
    // Not a transport but the way to one: everything that is not signing in
    // reads and writes the local database, and synchronisation carries it.
    pattern: /\buseHttp\b/,
    allowedIn: [SIGN_IN, 'shared/api/'],
    builtHere: true,
    specimens: ['const http = useHttp()'],
  },
  {
    name: 'fetch',
    // No dot in the lookbehind: `globalThis.fetch(...)` is the same call, and
    // an object of this site's own with a `fetch` method would be a transport
    // wearing a hat.
    pattern: /(?<![\w$])fetch\s*\(/,
    allowedIn: [],
    builtHere: false,
    specimens: [
      "await fetch('/api/edu/courses')",
      "await globalThis.fetch('https://elsewhere.test')",
      "await window.fetch('/x')",
      "await self.fetch('/x')",
    ],
    innocents: ['const refetch = () => reload()', 'void prefetch(route)', 'fetchHttpClient.ts'],
  },
  {
    name: 'FetchHttpClient',
    pattern: /\bFetchHttpClient\b/,
    allowedIn: [],
    builtHere: false,
    specimens: ['new FetchHttpClient({ baseUrl })'],
  },
  {
    name: 'XMLHttpRequest',
    pattern: /\bXMLHttpRequest\b/,
    allowedIn: [],
    builtHere: false,
    specimens: ['const request = new XMLHttpRequest()'],
  },
  {
    name: 'sendBeacon',
    // The one that looks harmless on `pagehide`, which is exactly where this
    // site has a handler already.
    pattern: /\bsendBeacon\s*\(/,
    allowedIn: [],
    builtHere: false,
    specimens: ["navigator.sendBeacon('/collect', body)"],
  },
  {
    name: 'WebSocket',
    pattern: /\bWebSocket\b/,
    allowedIn: [],
    builtHere: false,
    specimens: ["const socket = new WebSocket('wss://elsewhere.test')"],
  },
  {
    name: 'EventSource',
    pattern: /\bEventSource\b/,
    allowedIn: [],
    builtHere: false,
    specimens: ["const stream = new EventSource('/events')"],
  },
  {
    name: 'axios',
    pattern: /\baxios\b/,
    allowedIn: [],
    builtHere: false,
    specimens: ["import axios from 'axios'", 'await axios.get(url)'],
  },
  {
    name: 'Capacitor',
    // Not a transport of its own but a door to one, and to a platform this
    // application does not run on: a tab is not a handset.
    pattern: /@capacitor|\bCapacitorHttp\b/,
    allowedIn: [],
    builtHere: false,
    specimens: ["import { Network } from '@capacitor/network'", 'await CapacitorHttp.get({ url })'],
  },
]

/** Every shipped file of this application, keyed by its path under `src/`. */
const SOURCES: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob(['/src/**/*.ts', '/src/**/*.vue'], {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>,
  )
    .map(([key, content]) => [key.replace(/^\/src\//, ''), content] as const)
    .filter(([file]) => !file.includes('__tests__/') && !file.endsWith('.spec.ts')),
)

const files = (): string[] => Object.keys(SOURCES)

const isAllowed = (escape: Escape, file: string): boolean =>
  escape.allowedIn.some((entry) => (entry.endsWith('/') ? file.startsWith(entry) : file === entry))

const named = (escapes: readonly Escape[]) =>
  escapes.map((escape) => [escape.name, escape] as const)

const withSamples = (pick: (escape: Escape) => readonly string[]) =>
  ESCAPES.flatMap((escape) => pick(escape).map((sample) => [escape.name, sample, escape] as const))

/**
 * Everything but signing in reaches the server through synchronisation.
 *
 * The student's side of this product has no REST doors left to knock on: a
 * course is read from the local database, and an answer is written there and
 * carried by the outbox. The rule is a property of the tree rather than of any
 * one file, so it is checked by walking the tree — a screen added next year
 * gets the same answer as the ones that exist today, and nobody has to
 * remember the rule to keep it.
 */
describe('nothing but signing in talks to the network', () => {
  it.each(named(ESCAPES))('keeps %s out of everything else', (_name, escape) => {
    const offenders = files()
      .filter((file) => !isAllowed(escape, file))
      .filter((file) => escape.pattern.test(SOURCES[file]!))
      .sort()

    expect(offenders).toEqual([])
  })

  it('reads the files it claims to read, so an empty answer means something', () => {
    expect(files()).toContain('app/main.ts')
    expect(files()).toContain('app/sync.ts')
    expect(files()).toContain('pages/settings/ui/SettingsPage.vue')
    expect(files()).toContain('features/auth-otp/api/otp.ts')
    expect(files()).toContain('shared/connection/useConnection.ts')
    expect(files().length).toBeGreaterThan(30)
  })

  it('reads the screens too, not only the modules beneath them', () => {
    expect(files().filter((file) => file.endsWith('.vue')).length).toBeGreaterThan(5)
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
        .filter((file) => isAllowed(escape, file))
        .filter((file) => escape.pattern.test(SOURCES[file]!))

      expect(carriers.length).toBeGreaterThan(0)
    },
  )
})
