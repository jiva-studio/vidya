import { FluentBundle } from '@fluent/bundle'
import { createFluentVue } from 'fluent-vue'

import resources from '../i18n'

export type Locale = keyof typeof resources

/**
 * A fluent plugin carrying this slice's own messages, one locale at a time.
 *
 * Isolation marks are switched off so a test can compare what it reads with the
 * string a person would see.
 */
export function fluentFor(locale: Locale = 'en') {
  const bundle = new FluentBundle(locale, { useIsolating: false })
  resources[locale].forEach((resource) => bundle.addResource(resource))

  return createFluentVue({ bundles: [bundle] })
}
