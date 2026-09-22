/** One slice's translations: the same keys, in both languages. */
export interface LocaleMessages {
  readonly en?: string
  readonly ru?: string
}

export const Locales = ['en', 'ru'] as const
export type Locale = (typeof Locales)[number]
