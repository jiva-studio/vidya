import { FluentBundle, FluentResource } from '@fluent/bundle'
import { createFluentVue } from 'fluent-vue'
import { ref, watch } from 'vue'

import enMessages from './en.ftl?raw'
import ruMessages from './ru.ftl?raw'
import type { Locale, LocaleMessages } from './types'
import { Locales } from './types'

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

/** Where the chosen language is remembered between visits. */
const localeKey = 'vidya.locale'

const remembered = (): Locale | undefined => {
  try {
    const stored = localStorage.getItem(localeKey)
    return Locales.find((candidate) => candidate === stored)
  } catch {
    // Storage can be refused outright — a private window, a locked-down
    // browser. A language nobody could remember is not a reason to fail.
    return undefined
  }
}

export const locale = ref<Locale>(remembered() ?? 'ru')

export const fluent = createFluentVue({ bundles: [bundles[locale.value]] })

/** Switching is a bundle swap, so the screen re-renders without a reload. */
watch(locale, (value) => {
  fluent.bundles = [bundles[value]]

  try {
    localStorage.setItem(localeKey, value)
  } catch {
    // The language still changed; it just will not survive the next visit.
  }
})

/** Adds a slice's translations to both bundles at once. */
export const addMessages = (messages: LocaleMessages): void => {
  if (messages.en) enBundle.addResource(new FluentResource(messages.en), { allowOverrides: true })
  if (messages.ru) ruBundle.addResource(new FluentResource(messages.ru), { allowOverrides: true })
}

addMessages({ en: enMessages, ru: ruMessages })

/**
 * One message, formatted outside a component.
 *
 * Almost everything is translated in a template through `$t`. What is not is
 * the text of something announced by a layer with no template of its own — a
 * failed request, reported from the transport.
 */
export const translate = (key: string): string => {
  const bundle = bundles[locale.value]
  const message = bundle.getMessage(key)
  return message?.value ? bundle.formatPattern(message.value) : key
}
