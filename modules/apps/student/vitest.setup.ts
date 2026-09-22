import { webcrypto } from 'node:crypto'

import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach } from 'vitest'

import { installSectionMessages } from './src/app/sections'

// jsdom binds no webcrypto of its own, and the device id is minted with
// `crypto.randomUUID()`.
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto })
}

// A screen keeps its overlays in `document.body` behind a teleport; every
// mounted screen goes away with the test that mounted it.
enableAutoUnmount(afterEach)

// Every slice's translations, as the running site assembles them: a screen
// asserted against half a bundle would be asserted against its own key names.
installSectionMessages()
