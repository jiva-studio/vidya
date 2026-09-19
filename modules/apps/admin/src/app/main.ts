import './styles/index.css'

import { createApp } from 'vue'

import { FakeMediaGateway, mediaGatewayKey } from '@/entities/media'
import { systemClock } from '@/shared/lib'

import App from './App.vue'
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

  // Nothing stores a file yet, so the editor is wired to the fake from here and
  // from nowhere else: swapping in the real gateway is this one line.
  app.provide(mediaGatewayKey, new FakeMediaGateway({ clock: systemClock }))

  await router.isReady()
  app.mount('#app')
}

void start()
