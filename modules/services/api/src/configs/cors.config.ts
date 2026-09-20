import { registerAs } from '@nestjs/config'

/**
 * How the app presents itself when it is not served by a dev server.
 *
 * A native build has no origin of ours to speak from: Capacitor serves the
 * bundle under its own scheme on iOS and under `http://localhost`, portless, on
 * Android. Both are constant across every deployment — they describe the client
 * runtime, not where anything is hosted — so they are listed here rather than
 * configured, and a deployment that forgets its own domain still cannot lock
 * the phone out.
 */
const NATIVE_ORIGINS = ['capacitor://localhost', 'http://localhost']

/**
 * A browser sends the origin exactly as it appears in the address bar, and
 * `localhost` and `127.0.0.1` are two different ones.
 */
const bothSpellings = (port: string | number): string[] => [
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`,
]

const listed = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)

/**
 * Which origins may read an answer from this API.
 *
 * Never `true` and never `*`: the answers carry a student's own rows, and with
 * credentials allowed a wildcard would let any page on the internet read them
 * from the reader's own session. A deployment names its clients in
 * `VIDYA_CORS_ORIGINS`, comma separated; the fallback is the local stand, which
 * is what makes a fresh checkout work without ceremony.
 */
export default registerAs('cors', () => {
  const configured = listed(process.env.VIDYA_CORS_ORIGINS)

  const stand = [
    ...bothSpellings(process.env.VIDYA_ADMIN_PORT || 7811),
    ...bothSpellings(process.env.VIDYA_MOBILE_PORT || 5173),
  ]

  return {
    origins: [...NATIVE_ORIGINS, ...(configured.length > 0 ? configured : stand)],

    /** Whether the browser list came from deployment rather than the fallback. */
    configured: configured.length > 0,
  }
})
