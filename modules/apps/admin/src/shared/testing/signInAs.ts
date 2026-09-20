import type { PermissionKey } from '@vidya/domain'

import { useSession } from '../session'

/** The school a story or a test works in, unless it says otherwise. */
export const STORY_SCHOOL = 'school-1'

/**
 * A session holding exactly the rights the caller wants to show a screen under.
 *
 * The token is assembled rather than signed: nothing in the browser verifies
 * it, and a story that needed a real one would need the API. The same helper
 * serves the mounted tests, so "no rights" in Storybook and the test that
 * asserts the button is gone are driven by one thing.
 */
export const signInAs = (permissions: PermissionKey[], schoolId = STORY_SCHOOL): void => {
  const claims = {
    sub: 'u1',
    exp: 2_000_000_000,
    permissions: [{ sid: schoolId, p: permissions }],
  }

  useSession().start({
    accessToken: `header.${encode(JSON.stringify(claims))}.signature`,
    refreshToken: 'refresh',
  })
}

// base64url, because the reader of the token splits on dots and decodes the
// middle part the way a browser decodes a JWT.
const encode = (json: string): string =>
  btoa(json).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
