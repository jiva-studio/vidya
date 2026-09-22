import { createApp, h } from 'vue'

/**
 * The screen for the one failure the site cannot carry: no local database.
 *
 * Mounted as an application of its own, without the router or the translation
 * catalogue, because what failed is the start-up that brings those up.
 * Everything it needs is in this file, its two sentences included.
 *
 * Showing the site instead would be worse than showing nothing: every screen
 * reads from the database, so the student would see empty lists and no reason
 * for them.
 */

const TITLE = 'Не удалось открыть данные'
const TEXT = 'Хранилище браузера недоступно. Обновите страницу или откройте сайт в другом окне.'

export function showStartupFailure(selector: string): void {
  createApp({
    render: () => h('main', { class: 'startup-failure' }, [h('h1', TITLE), h('p', TEXT)]),
  }).mount(selector)
}
