/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css'
/* Basic CSS for apps built with Ionic */
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'
/* Optional CSS utils that can be commented out */
import '@ionic/vue/css/padding.css'
import '@ionic/vue/css/float-elements.css'
import '@ionic/vue/css/text-alignment.css'
import '@ionic/vue/css/text-transformation.css'
import '@ionic/vue/css/flex-utils.css'
import '@ionic/vue/css/display.css'
/* Theme variables */
import './theme.css'
import './lottie.css'

import { IonicVue } from '@ionic/vue'
import { createApp } from 'vue'

import { openDevice, showStartupFailure, startDeviceSync, useConnections, useSession } from '@/app'
import type { IDatabase } from '@/ports'

import App from './App.vue'
import { fluent } from './i18n'
import router from './router'

const ROOT = '#app'

async function createAndRunApp(db: IDatabase) {
  // The router sends an unauthenticated visitor to sign-in, and the engines
  // are started per connection, so both have to be in hand before routing.
  await useSession().restore()
  await useConnections().restore()

  // Before the mount: the first screen reads through the running engine, and
  // one mounted ahead of it would find no connection at all. Starting costs
  // nothing on the network — an engine subscribes to its triggers and the
  // first run is not awaited.
  await startDeviceSync(db)

  const app = createApp(App).use(IonicVue).use(router).use(fluent)

  await router.isReady()
  app.mount(ROOT)
}

/**
 * The schema comes before the first screen: every screen reads from the device,
 * and one rendered against a half-created database shows an empty list that a
 * student cannot tell from having no courses. A database that cannot be opened
 * at all is the one case with nothing to show, and it gets a screen saying so.
 */
async function start() {
  let db: IDatabase

  try {
    db = await openDevice()
  } catch (error) {
    console.error('the device database could not be opened', error)
    showStartupFailure(ROOT)
    return
  }

  await createAndRunApp(db)
}

void start()
