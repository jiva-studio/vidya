import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

/**
 * Feature-Sliced Design, checked by machine rather than by eye.
 *
 * The site is written against this layout from its first screen, and a
 * boundary nobody can see is a boundary nobody keeps. Import direction is
 * enforced here and again by ESLint, because the two catch different halves of
 * the same mistake.
 */
export default defineConfig([
  ...fsd.configs.recommended,
  {
    // `types.ts` beside a slice is required by the project's own frontend
    // rules, so the segment-naming rule is switched off for that one name and
    // nowhere else.
    files: ['./src/**/types.ts'],
    rules: { 'fsd/segments-by-purpose': 'off' },
  },
  {
    // Signing in is offered by one screen and is still an action of the
    // student rather than part of that screen: merging it into the page would
    // put the request, the rules and the markup in one slice.
    files: ['./src/features/auth-otp/**'],
    rules: { 'fsd/insignificant-slice': 'off' },
  },
])
