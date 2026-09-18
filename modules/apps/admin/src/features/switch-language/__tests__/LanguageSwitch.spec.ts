import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { locale } from '@/shared/i18n'
import { mountWithApp } from '@/shared/testing'

import { LanguageSwitch } from '..'

const open = () => mountWithApp(LanguageSwitch)

describe('LanguageSwitch', () => {
  beforeEach(() => {
    localStorage.clear()
    locale.value = 'ru'
  })

  afterEach(() => {
    locale.value = 'ru'
  })

  it('names both languages in their own words', () => {
    expect(open().text()).toContain('Русский')
    expect(open().text()).toContain('English')
  })

  it('changes the language of the screen without a reload', async () => {
    const control = open()

    const english = control.findAll('button').find((node) => node.text() === 'English')
    await english?.trigger('click')

    expect(locale.value).toBe('en')
  })

  it('marks which language is in force, for a reader who cannot see the styling', async () => {
    const control = open()
    const buttonFor = (label: string) =>
      control.findAll('button').find((node) => node.text() === label)

    expect(buttonFor('Русский')?.attributes('aria-pressed')).toBe('true')

    await buttonFor('English')?.trigger('click')

    expect(buttonFor('English')?.attributes('aria-pressed')).toBe('true')
    expect(buttonFor('Русский')?.attributes('aria-pressed')).toBe('false')
  })

  it('remembers the choice for the next visit', async () => {
    const control = open()

    const english = control.findAll('button').find((node) => node.text() === 'English')
    await english?.trigger('click')

    expect(localStorage.getItem('vidya.locale')).toBe('en')
  })
})
