// jsdom has no crypto.randomUUID before Node's webcrypto is bound to it, and the
// editor track leans on it for stable section ids.
import { webcrypto } from 'node:crypto'

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto })
}

// jsdom has no layout, so it implements none of these, and reka's listboxes and
// dialogs call them while moving the highlight or the focus. Without them a
// keyboard test ends in an unhandled rejection that has nothing to do with the
// component under test. @vidya/ui's own setup carries the same four lines for
// its own suite.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
}

// jsdom implements neither of these, and a media preview asks the gateway for an
// address the moment it has a file. Without them a preview test fails inside a
// browser API instead of on what it came to assert.
if (!globalThis.URL.createObjectURL) {
  let minted = 0
  globalThis.URL.createObjectURL = () => `blob:vidya/${(minted += 1)}`
  globalThis.URL.revokeObjectURL = () => {}
}

// The editor's text surface and its overlays observe their own box.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}
