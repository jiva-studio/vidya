import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import Avatar from './Avatar.vue'
import { tintClasses, unnamedClasses } from './styles'
import { AVATAR_TINTS, avatarTint } from './tint'

const classesOf = (name: string): string => mount(Avatar, { props: { name } }).attributes('class')!

describe('avatarTint', () => {
  it('stays inside the range the tokens define', () => {
    const names = ['Radha Devi', 'Gauranga', 'Ms. Kristen Gerhold', 'Дмитрий', 'x']

    for (const name of names) {
      expect(avatarTint(name)).toBeGreaterThanOrEqual(1)
      expect(avatarTint(name)).toBeLessThanOrEqual(AVATAR_TINTS)
    }
  })

  it('gives one name one colour, however often it is asked', () => {
    expect(avatarTint('Radha Devi')).toBe(avatarTint('Radha Devi'))
  })

  it('does not put every name on the same colour', () => {
    const names = Array.from({ length: 40 }, (_, index) => `Person ${index}`)
    const used = new Set(names.map(avatarTint))

    expect(used.size).toBeGreaterThan(1)
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
})
