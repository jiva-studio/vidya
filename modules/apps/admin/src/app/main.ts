import './styles/index.css'

import { createApp } from 'vue'

import { HttpMediaGateway, mediaGatewayKey } from '@/entities/media'
import { onFailure, useApi } from '@/shared/api'
import { createToasts, toastsKey } from '@/shared/lib'
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

  // One gateway for the whole application, so the addresses one screen primed
  // are the ones the next screen draws with.
  app.provide(mediaGatewayKey, new HttpMediaGateway(useApi()))

  // One stack for the whole application, and one route to it: every request
  // that fails is announced here, whichever screen made it.
  const toasts = createToasts()
  app.provide(toastsKey, toasts)
  onFailure((failure) => announceFailure(toasts, failure))

  await router.isReady()
  app.mount('#app')
}

void start()
