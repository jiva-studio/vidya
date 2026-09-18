import { describe, expect, it } from 'vitest'

import enMessages from '../en.ftl?raw'
import { addMessages, enBundle, fluent, locale, ruBundle } from '../fluent'
import ruMessages from '../ru.ftl?raw'

const keysOf = (resource: string) =>
  resource
    .split('\n')
    .map((line) => /^([a-z][\w-]*) *=/.exec(line)?.[1])
    .filter((key): key is string => key !== undefined)
    .sort()

const message = (bundle: typeof enBundle, key: string) => {
  const found = bundle.getMessage(key)
  return found?.value ? bundle.formatPattern(found.value) : undefined
}

describe('fluent bundles', () => {
  it('holds English in the English bundle', () => {
    expect(message(enBundle, 'action-save')).toBe('Save')
  })

  it('holds Russian in the Russian bundle', () => {
    expect(message(ruBundle, 'action-save')).toBe('Сохранить')
  })

  it('never leaks an English string into the Russian bundle', () => {
    for (const key of ['action-save', 'action-cancel', 'state-loading', 'page-not-found-title']) {
      expect(message(ruBundle, key)).not.toBe(message(enBundle, key))
    }
  })

  it('gives both bundles the same set of keys', () => {
    expect(keysOf(ruMessages)).toEqual(keysOf(enMessages))
  })

  it('adds a section to both bundles at once', () => {
    addMessages({ en: 'test-key = In English', ru: 'test-key = По-русски' })

    expect(message(enBundle, 'test-key')).toBe('In English')
    expect(message(ruBundle, 'test-key')).toBe('По-русски')
  })

  it('swaps the active bundle when the language changes', async () => {
    locale.value = 'en'
    await Promise.resolve()
    expect([...fluent.bundles]).toEqual([enBundle])

    locale.value = 'ru'
    await Promise.resolve()
    expect([...fluent.bundles]).toEqual([ruBundle])
  })
})
