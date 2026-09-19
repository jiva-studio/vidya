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
  {
    // Eight slices have exactly one consumer today, and `insignificant-slice`
    // suggests merging each into it. They stay separate, named one by one so
    // that a slice nobody uses is still reported everywhere else:
    //
    //   an action of the operator is a feature whether one screen offers it or
    //   three — moderating a request, grading a piece of work, placing a
    //   student, giving somebody a role, editing lesson content, publishing a
    //   version — and merging any of them into the screen that calls it puts
    //   the request, the rules and the markup in one slice, over the file and
    //   size limits this project enforces (AGENTS.md, §1);
    //
    //   `widgets/lesson-editor` is used by one page because the editor is one
    //   screen, and the page is the route that leads to it, and
    //   `entities/homework` is read by that one workplace because a piece of
    //   work is shown in exactly one place — a domain noun does not become part
    //   of a widget by being read from a single one.
    //
    // `entities/media` and `features/pick-media` are the same case: media is a
    // domain noun with one reader today, and picking a file is an action of the
    // operator offered by the one screen that authors lessons.
    files: [
      './src/entities/homework/**',
      './src/entities/media/**',
      './src/features/assign-group/**',
      './src/features/edit-lesson-content/**',
      './src/features/switch-language/**',
      './src/features/grade-homework/**',
      './src/features/manage-user-roles/**',
      './src/features/moderate-enrollment/**',
      './src/features/pick-media/**',
      './src/features/publish-lesson/**',
      './src/widgets/lesson-editor/**',
    ],
    rules: { 'fsd/insignificant-slice': 'off' },
  },
  {
    // One cross-slice import, named rather than allowed in general:
    //
    //   the media block's empty state offers "choose from the library", and
    //   that dialog is `features/pick-media` — the block cannot open it without
    //   reaching the slice that is the dialog. The two ways out both cost more
    //   than they buy: a second injection port beside `mediaGatewayKey`, whose
    //   only job is to hand one component to another, or a dialog threaded as a
    //   slot from the widget through the section, the block list and the block
    //   frame, which is four levels of prop-passing for one button.
    //
    // The rule stays on everywhere else, so the next cross-import is still
    // reported.
    files: ['./src/features/edit-lesson-content/ui/MediaBlockEditor.vue'],
    rules: { 'fsd/forbidden-imports': 'off' },
  },
])
