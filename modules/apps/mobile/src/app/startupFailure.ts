import { createApp, h } from 'vue'

/**
 * The screen for the one failure the app cannot carry: no local schema.
 *
 * Mounted as an application of its own, without the router, the translation
 * catalogue or the design system, because what failed is the start-up that
 * brings those up. Everything it needs is in this file.
 *
 * Showing the app instead would be worse than showing nothing: every screen
 * reads from the database, so the student would see empty lists and no reason
 * for them.
 */

const TITLE = 'Приложение не удалось запустить'
const TEXT = 'Хранилище на устройстве не готово. Перезапустите приложение.'

export function showStartupFailure(selector: string): void {
  createApp({
    render: () => h('main', { class: 'startup-failure' }, [h('h1', TITLE), h('p', TEXT)]),
  }).mount(selector)
}
