import { describe, expect, it } from 'vitest'

import { initialsOf } from './initials'

describe('initialsOf', () => {
  it('takes the first and the last word of a full name', () => {
    expect(initialsOf('Radha Devi')).toBe('RD')
    expect(initialsOf('Ms. Kristen Gerhold')).toBe('MG')
  })

  it('takes two letters from a single word, so two short names differ', () => {
    expect(initialsOf('Gauranga')).toBe('Ga')
    expect(initialsOf('Ann')).not.toBe(initialsOf('Amy'))
  })

  it('marks a name that is not there rather than rendering an empty circle', () => {
    expect(initialsOf('')).toBe('?')
    expect(initialsOf('   ')).toBe('?')
  })

  it('ignores the spacing a name was typed with', () => {
    expect(initialsOf('  Radha   Devi  ')).toBe('RD')
    expect(initialsOf('Radha\tDevi')).toBe('RD')
  })

  it('never returns more than two characters', () => {
    const names = ['Jean Luc Marie Picard', 'A B C D E', 'Gauranga', 'x']

    for (const name of names) expect([...initialsOf(name)].length).toBeLessThanOrEqual(2)
  })

  // Indexing a string cuts a surrogate pair in half, and half a pair renders
  // as a replacement glyph.
  it('keeps a character outside the basic plane whole', () => {
    expect(initialsOf('𝒜nanda')).toBe('𝒜n')
    expect(initialsOf('𝒜nanda 𝒟asa')).toBe('𝒜𝒟')
  })

  it('reads a name in any script', () => {
    expect(initialsOf('Радха Деви')).toBe('РД')
    expect(initialsOf('達磨')).toBe('達磨')
  })
})
