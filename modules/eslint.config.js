import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import vueParser from 'vue-eslint-parser'

// Pure layers must stay deterministic: ambient clocks and RNG have a lifetime
// that unit tests cannot control, so they are injected as ports instead.
const nonDeterministicEnvironment = [
  {
    selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
    message: 'Math.random() is forbidden in pure layers. Inject a randomness port.',
  },
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: 'Date.now() is forbidden in pure layers. Inject a clock port.',
  },
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: 'new Date() is forbidden in pure layers. Inject a clock port.',
  },
]

// Feature-Sliced Design, as import rules. `app` is above every layer, so no
// layer may reach for it; each layer below then names the ones above itself.
const upward = (layers) => [
  {
    group: ['@/app', '@/app/*'],
    message:
      'The composition root sits above every layer. Move what you need down into shared/, or take it as a prop.',
  },
  ...layers.map((layer) => ({
    group: [`@/${layer}`, `@/${layer}/*`],
    message: `A lower layer cannot import ${layer}/. Imports go down, never up.`,
  })),
]

// Within a layer, a slice is reached through its public index.ts and no deeper.
const sidestep = [
  {
    group: ['@/pages/*/*', '@/widgets/*/*', '@/features/*/*', '@/entities/*/*'],
    message: 'Import a slice through its index.ts, not past it.',
  },
]

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/storybook-static/**',
      '**/coverage/**',
      '**/.stryker-tmp/**',
      '**/reports/**',
      '**/*.tsbuildinfo',
      'apps/*/android/**',
      'apps/*/ios/**',

      // Stand-ins for packages an `overrides` entry keeps out of installs.
      // Not project source, and CommonJS where this config assumes ESM.
      'vendor/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  /* ------------------------------ TypeScript ------------------------------- */

  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      parserOptions: { sourceType: 'module' },
    },
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',

      // Decorator metadata drives NestJS DI, so explicit return types and the
      // occasional `any` in framework seams are not worth fighting.
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Structural limits (compadre parity).
      'max-lines': ['error', { max: 350, skipBlankLines: true, skipComments: true }],
      complexity: ['error', 10],
      'max-depth': ['error', 3],

      // A chain of ternaries is a table written as an expression: the reader
      // has to run it to learn which case is which. Write the table.
      'no-nested-ternary': 'error',

      // An empty catch silently swallows a failure; say why or handle it.
      'no-empty': ['error', { allowEmptyCatch: false }],


      // Cross-package imports go through the package's public entry point.
      // A relative path that climbs out of a package bypasses it, and with it
      // the dependency rules in .agents/rules/architecture.md.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/../libs/*', '**/../../libs/*', '**/../../../libs/*'],
              message:
                'Reach other packages through their @vidya/* entry point, not a relative path out of this one.',
            },
          ],
        },
      ],
    },
  },

  /* --------------------------- CommonJS tool configs ------------------------ */

  {
    files: ['**/*.config.js', '**/.*rc.js'],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: 'commonjs',
    },
  },

  /* ------------------------------ Pure layers ------------------------------ */

  {
    files: ['libs/**/*.ts'],
    rules: { 'no-restricted-syntax': ['error', ...nonDeterministicEnvironment] },
  },

  /* ------------------------------ Controllers ------------------------------ */

  {
    // Transport stays thin. A controller reads the request, proves the caller
    // may act, delegates, and shapes the reply — so it has little to branch on.
    //
    // This is enforced rather than merely documented because the rules drift
    // back the moment one "small" condition looks easier to write here than in
    // the service, and the next caller in — the offline sync endpoints — does
    // not come through a controller at all.
    files: ['**/*.controller.ts'],
    rules: {
      complexity: ['error', 4],
      'max-depth': ['error', 1],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='ConflictException']",
          message:
            'A conflict is a domain rule. Throw it from the service that owns the rule, so every caller gets it — not only this endpoint.',
        },
        {
          selector: 'ForStatement, ForOfStatement, ForInStatement, WhileStatement',
          message: 'Loops belong in a service, not in transport.',
        },
      ],
    },
  },

  /* ------------------------------ Shared types ----------------------------- */

  {
    // `object` and `{}` say "some fields, unspecified", which is what a JSON
    // column degenerates to when nobody names its shape. That is how
    // `LessonVersion.content` and `BlockState.state` sat as `object` while the
    // DTOs promised `LessonContent` and `LessonBlockState`: the mapper cast
    // between them, so neither the compiler nor a test ever disagreed.
    //
    // Name the domain type. If it does not exist yet, that is the finding.
    files: ['libs/**/*.ts', 'services/**/*.ts', 'apps/**/*.ts'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'error',
      '@typescript-eslint/no-restricted-types': [
        'error',
        {
          types: {
            object: {
              message:
                'Name the shape. A domain type belongs in @vidya/domain, not an anonymous object.',
            },
            Object: { message: 'Use a named type, or Record<string, unknown> for a bag.' },
          },
        },
      ],
    },
  },

  /* ------------------------------- Wire types ------------------------------ */

  {
    // An empty response interface is a real contract here — it says the endpoint
    // returns no payload — and DTO classes `implement` it, which rules out the
    // index-signature alternatives the rule would otherwise suggest.
    files: ['libs/protocol/**/*.ts'],
    rules: { '@typescript-eslint/no-empty-object-type': ['error', { allowInterfaces: 'always' }] },
  },

  /* --------------------------------- Specs --------------------------------- */

  {
    files: ['**/*.spec.ts', '**/specs/**/*.ts', '**/seed.ts'],
    rules: {
      'max-lines': 'off',
      'no-restricted-syntax': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },

  /* ---------------------------------- Vue ---------------------------------- */

  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tseslint.parser, sourceType: 'module' },
    },
    rules: {
      'vue/max-template-depth': ['error', { maxDepth: 4 }],
      'vue/max-lines-per-block': ['error', { template: 100, script: 300, style: 80 }],
      'vue/define-props-declaration': ['error', 'type-based'],
      'vue/require-explicit-emits': 'error',
      'vue/no-undef-components': 'error',
      'vue/custom-event-name-casing': ['error', 'kebab-case'],
      'vue/attribute-hyphenation': ['error', 'always'],
      'max-lines': ['error', { max: 350, skipBlankLines: true, skipComments: true }],

      // A chain of ternaries is a table written as an expression: the reader
      // has to run it to learn which case is which. Write the table.
      'no-nested-ternary': 'error',
      'vue/no-restricted-syntax': [
        'error',
        {
          selector: 'ConditionalExpression ConditionalExpression',
          message: 'Nested ternary: use a lookup table or an early return.',
        },
      ],
    },
  },

  /* ------------------------- Feature-Sliced Design ------------------------- */

  {
    // Each layer, and what it is forbidden to reach for. Listed one layer at a
    // time because a single pattern list cannot say "pages may see widgets but
    // widgets may not see pages".
    files: ['apps/{admin,student}/src/pages/**/*.{ts,vue}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [...upward([]), ...sidestep] }] },
  },

  {
    files: ['apps/{admin,student}/src/widgets/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [...upward(['pages']), ...sidestep] }],
    },
  },

  {
    files: ['apps/{admin,student}/src/features/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...upward(['pages', 'widgets']), ...sidestep] },
      ],
    },
  },

  {
    files: ['apps/{admin,student}/src/entities/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...upward(['pages', 'widgets', 'features']), ...sidestep] },
      ],
    },
  },

  {
    files: ['apps/{admin,student}/src/shared/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: upward(['pages', 'widgets', 'features', 'entities']) },
      ],
    },
  },

  /* ------------------------------ Design system ----------------------------- */

  {
    // The component set of @vidya/ui is named in the specification, and those
    // names are one word each: Button, Input, Table, Dialog. A design system is
    // the one place where that reads as a vocabulary rather than as a clash
    // with an HTML element, because every component is imported explicitly.
    files: ['libs/ui/**/*.vue'],
    rules: { 'vue/multi-word-component-names': 'off' },
  },

  prettier,

  /* --------------------------------- Ionic ---------------------------------- */

  {
    // Ionic's components are custom elements and take their children through
    // the real `slot` attribute. The rule is about Vue 2's `slot`, which is a
    // different thing that these files never use.
    files: ['apps/mobile/**/*.vue'],
    rules: { 'vue/no-deprecated-slot-attribute': 'off' },
  },
)
