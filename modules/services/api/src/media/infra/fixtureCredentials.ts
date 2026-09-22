import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

type FixtureCredentials = { accessKeyId: string; secret: string }

let cached: FixtureCredentials | undefined

/**
 * The one pair of credentials the in-memory storage accepts, read from the
 * wire fixtures the clients test against.
 *
 * Read from the package rather than copied here so the fake and the suites
 * cannot drift into agreeing with each other and disagreeing with the
 * contract. The path is resolved through the package entry point because a
 * mutation run copies this service several directories deeper.
 */
export const acceptedCredentials = (): FixtureCredentials => {
  if (cached) return cached

  const root = dirname(require.resolve('@vidya/protocol/package.json'))
  const file = join(root, '__fixtures__', 'media', 'storage-profile.json')
  const { request } = JSON.parse(readFileSync(file, 'utf8')) as { request: FixtureCredentials }

  cached = { accessKeyId: request.accessKeyId, secret: request.secret }
  return cached
}
