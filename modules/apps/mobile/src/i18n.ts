import { FluentBundle } from '@fluent/bundle'
import { createFluentVue } from 'fluent-vue'

import sharedResources from '@/shared/i18n'
import authResources from '@/ui/auth/i18n'
import educationResources from '@/ui/education/i18n'
import settingsResources from '@/ui/settings/i18n'
import syncResources from '@/ui/sync/i18n'

export const enBundle = new FluentBundle('en')
export const ruBundle = new FluentBundle('ru')

// ru:
authResources.ru.forEach((x) => ruBundle.addResource(x))
educationResources.ru.forEach((x) => ruBundle.addResource(x))
settingsResources.ru.forEach((x) => ruBundle.addResource(x))
sharedResources.ru.forEach((x) => ruBundle.addResource(x))
syncResources.ru.forEach((x) => ruBundle.addResource(x))

// en:
authResources.en.forEach((x) => enBundle.addResource(x))
educationResources.en.forEach((x) => enBundle.addResource(x))
settingsResources.en.forEach((x) => enBundle.addResource(x))
sharedResources.en.forEach((x) => enBundle.addResource(x))
syncResources.en.forEach((x) => enBundle.addResource(x))

export const fluent = createFluentVue({
  bundles: [ruBundle],
})
