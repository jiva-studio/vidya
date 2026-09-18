import { FluentBundle, FluentResource } from '@fluent/bundle'
import { createFluentVue } from 'fluent-vue'
import { ref, watch } from 'vue'

import enMessages from './en.ftl?raw'
import ruMessages from './ru.ftl?raw'
import type { Locale, LocaleMessages } from './types'

/**
 * One bundle per language, each holding that language's resources only.
 *
 * The admin this replaces loaded its English resources into the Russian bundle,
 * which is invisible until someone switches language and finds half the screen
 * still in English. Each bundle is fed from one side of the pair, and the test
 * beside this file is what keeps it that way.
 */
export const enBundle = new FluentBundle('en')
export const ruBundle = new FluentBundle('ru')

const bundles: Record<Locale, FluentBundle> = { en: enBundle, ru: ruBundle }

export const locale = ref<Locale>('ru')

export const fluent = createFluentVue({ bundles: [ruBundle] })

/** Switching is a bundle swap, so the screen re-renders without a reload. */
watch(locale, (value) => {
  fluent.bundles = [bundles[value]]
})

/** Adds a slice's translations to both bundles at once. */
export const addMessages = (messages: LocaleMessages): void => {
  enBundle.addResource(new FluentResource(messages.en), { allowOverrides: true })
  ruBundle.addResource(new FluentResource(messages.ru), { allowOverrides: true })
}

addMessages({ en: enMessages, ru: ruMessages })
