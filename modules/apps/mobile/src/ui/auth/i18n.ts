import { FluentResource } from '@fluent/bundle'

import enMessages from './i18n/en.ftl?raw'
import ruMessages from './i18n/ru.ftl?raw'

export default {
  ru: [new FluentResource(ruMessages)],
  en: [new FluentResource(enMessages)],
}
