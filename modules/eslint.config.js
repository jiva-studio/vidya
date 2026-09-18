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

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
      'apps/*/android/**',
      'apps/*/ios/**',
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
    },
  },

  prettier,
)
