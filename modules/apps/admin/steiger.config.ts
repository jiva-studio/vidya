import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

/**
 * Feature-Sliced Design, checked by machine rather than by eye.
 *
 * Five sections are written at once against this layout, and a boundary nobody
 * can see is a boundary nobody keeps. Import direction is enforced here and
 * again by ESLint, because the two catch different halves of the same mistake.
 */
export default defineConfig([
  ...fsd.configs.recommended,
  {
    files: ['./src/**'],
    rules: {
      // Placeholder slices are deliberately empty and deliberately unreferenced:
      // the sections that fill them are being written on other branches right
      // now, and a slice they each have to create is a slice two of them create.
      'fsd/insignificant-slice': 'off',

      // `pluralize` reads `homework` as a plural, because the word has no
      // separate plural form, and then reports the other seven entities as
      // inconsistent with it. The names are fixed by the specification, so the
      // rule is off rather than the entity renamed.
      'fsd/inconsistent-naming': 'off',
    },
  },
  {
    // `types.ts` beside a component is required by the project's own frontend
    // rules, so the segment-naming rule is switched off for that one name and
    // nowhere else.
    files: ['./src/**/types.ts'],
    rules: { 'fsd/segments-by-purpose': 'off' },
  },
])
