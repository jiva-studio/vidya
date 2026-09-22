import './styles/index.css'

import type { HttpClient, IDatabase } from '@vidya/client'
import { education } from '@vidya/client'
import { createApp } from 'vue'

import { httpClientKey } from '@/shared/api'
import { useConnection } from '@/shared/connection'
import { educationKey, schoolRepositoryKey } from '@/shared/data'
import { browserNetwork } from '@/shared/platform'
import { useSiteStatus } from '@/shared/status'

import App from './App.vue'
import { createSiteClient } from './connection'
import { createI18n } from './i18n'
import { educationOf, schoolsOf } from './localData'
import { requestPersistentStorage } from './persistentStorage'
import { createAppRouter } from './router'
import { saveOnExit } from './saveOnExit'
import { migrateSite, openSite } from './site'
import { showStartupFailure } from './startupFailure'
import { syncWithConnection } from './sync'
import { electWriter, WRITER_LOCK } from './writerElection'

const ROOT = '#app'

/**
 * What only the writing tab does: bring the schema up to date, keep the image
 * written out, and run the engine. A reader tab does none of it, because all
 * three write, and the image is written whole.
 */
async function startWriting(db: IDatabase, http: HttpClient): Promise<void> {
  await migrateSite(db)
  saveOnExit(db)
  syncWithConnection({ db, http, network: browserNetwork() })
  useSiteStatus().markWriting(true)
}

async function mountSite(db: IDatabase, http: HttpClient): Promise<void> {
  const router = createAppRouter()
  const app = createApp(App).use(router).use(createI18n())

  app.provide(httpClientKey, http)
  app.provide(schoolRepositoryKey, schoolsOf(db))
  app.provide(educationKey, educationOf(db))

  await router.isReady()
  app.mount(ROOT)
}

/**
 * The order of the first seconds, and why it is this one.
 *
 * The connection is restored before the router resolves anything, because the
 * guard decides where the first address lands. The database is opened before
 * the first screen, because every screen reads from it. The schema and the
 * engine wait behind the election, because both of them write and only one tab
 * may — and the first screen waits for that, so it is never drawn against a
 * half-created database.
 *
 * A database that cannot be opened at all is the one failure with nothing to
 * show, and it gets a screen saying so rather than empty lists.
 */
async function start(): Promise<void> {
  // The rows this machine creates are named here, by the browser's CSPRNG: the
  // id is part of the key the server deduplicates on.
  education.useUuidSource(() => crypto.randomUUID())

  useConnection().restore()
  useSiteStatus().markStorage(await requestPersistentStorage())

  let db: IDatabase
  try {
    db = await openSite()
  } catch (error) {
    console.error('the local database could not be opened', error)
    showStartupFailure(ROOT)
    return
  }

  const http = createSiteClient()
  let failure: unknown = null

  const election = electWriter({
    locks: navigator.locks,
    name: WRITER_LOCK,
    onElected: async () => {
      try {
        db = await openSite()
        await startWriting(db, http)
        // Reported here and carried out, because this also runs when a tab
        // takes the role over long after start-up, where there is no longer a
        // first screen to replace.
      } catch (error) {
        console.error('the local database could not be prepared', error)
        failure = error
      }
    },
  })

  await election.writes

  if (failure !== null) {
    showStartupFailure(ROOT)
    return
  }

  await mountSite(db, http)
}

void start()
