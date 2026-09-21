import { fluent } from '@/shared/i18n'

import { installSectionMessages } from './sections'

/** Both bundles, each holding its own language, assembled once at startup. */
export const createI18n = () => {
  installSectionMessages()
  return fluent
}
