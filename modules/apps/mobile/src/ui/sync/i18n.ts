import { FluentResource } from '@fluent/bundle'

import enMessages from './i18n/en.ftl?raw'
import ruMessages from './i18n/ru.ftl?raw'

export default {
  en: [new FluentResource(enMessages)],
  ru: [new FluentResource(ruMessages)],
}
