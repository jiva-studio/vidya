import './styles/index.css'

import { createApp } from 'vue'

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

  await router.isReady()
  app.mount('#app')
}

void start()
