import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import Avatar from './Avatar.vue'
import { tintClasses, unnamedClasses } from './styles'
import { AVATAR_TINTS, avatarTint } from './tint'

const classesOf = (name: string): string => mount(Avatar, { props: { name } }).attributes('class')!

describe('avatarTint', () => {
  it('stays inside the range the tokens define', () => {
    const names = ['Radha Devi', 'Gauranga', 'Ms. Kristen Gerhold', 'x']

    for (const name of names) {
      expect(avatarTint(name)).toBeGreaterThanOrEqual(1)
      expect(avatarTint(name)).toBeLessThanOrEqual(AVATAR_TINTS)
    }
  })

  it('gives one name one colour, however often it is asked', () => {
    expect(avatarTint('Radha Devi')).toBe(avatarTint('Radha Devi'))
  })

  it('reaches every tint the tokens define', () => {
    const names = Array.from({ length: 200 }, (_, index) => `Person ${index}`)

    expect(new Set(names.map(avatarTint)).size).toBe(AVATAR_TINTS)
  })

  // The invariant the constants are chosen for. Real lists are full of names
  // that end alike — a family, a patronymic, an inflected language — and each
  // of those groups has to use the whole palette, not a corner of it.
  it('spreads names that share a final letter', () => {
    for (const ending of ['a', 'e', 'i', 'n', 's', 'y']) {
      const names = Array.from({ length: 200 }, (_, index) => `Name ${index}${ending}`)

      expect(new Set(names.map(avatarTint)).size, `names ending in ${ending}`).toBe(AVATAR_TINTS)
    }
  })

  it('tints a name written in any script, and one outside the basic plane', () => {
    for (const name of ['Σοφία Παπαδάκη', 'श्रीधर', '達磨', '𝒜nanda']) {
      expect(avatarTint(name)).toBeGreaterThanOrEqual(1)
      expect(avatarTint(name)).toBeLessThanOrEqual(AVATAR_TINTS)
    }
  })
})

describe('Avatar', () => {
  it('wears the tint its name hashes to', () => {
    const [first] = tintClasses[avatarTint('Radha Devi') - 1].split(' ')

    expect(classesOf('Radha Devi')).toContain(first)
  })

  it('keeps two different people apart where the hash differs', () => {
    const names = Array.from({ length: 20 }, (_, index) => `Person ${index}`)
    const backgrounds = new Set(names.map((name) => classesOf(name)))

    expect(backgrounds.size).toBeGreaterThan(1)
  })

  it('leaves a nameless avatar neutral rather than colouring a question mark', () => {
    const [first] = unnamedClasses.split(' ')

    expect(classesOf('   ')).toContain(first)
    expect(classesOf('')).toContain(first)
  })

  it('renders image with the given src when provided', () => {
    const wrapper = mount(Avatar, {
      props: { name: 'School', src: 'https://example.com/logo.png' },
    })
    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/logo.png')
  })
})
