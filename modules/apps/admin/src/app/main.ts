import './styles/index.css'

import { mediaResolverKey } from '@vidya/ui'
import { createApp } from 'vue'

import { FakeMediaGateway, mediaGatewayKey } from '@/entities/media'
import { onFailure } from '@/shared/api'
import { createToasts, systemClock, toastsKey } from '@/shared/lib'
import { initSentry } from '@/shared/sentry'

import App from './App.vue'
import { announceFailure } from './failures'
import { createI18n } from './i18n'
import { createAppRouter } from './router'
import { restoreSession, watchOtherTabs } from './session'

const start = async () => {
  // The guard decides where the first navigation lands, so the session has to
  // be in hand before the router resolves anything.
  await restoreSession()
  watchOtherTabs()

  const router = createAppRouter()
  const app = createApp(App).use(router).use(createI18n())

  initSentry(app, router)

  // Nothing stores a file yet, so the editor is wired to the fake from here and
  // from nowhere else: swapping in the real gateway is this one line.
  const media = new FakeMediaGateway({ clock: systemClock })
  app.provide(mediaGatewayKey, media)

  // The lesson renderer is shared with the student's site and knows no gateway,
  // so it is handed the one question it has about an uploaded file.
  app.provide(mediaResolverKey, (url: string) => media.resolve(url))

  // One stack for the whole application, and one route to it: every request
  // that fails is announced here, whichever screen made it.
  const toasts = createToasts()
  app.provide(toastsKey, toasts)
  onFailure((failure) => announceFailure(toasts, failure))

  await router.isReady()
  app.mount('#app')
}

void start()
