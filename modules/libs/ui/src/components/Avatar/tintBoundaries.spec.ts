import { describe, expect, it } from 'vitest'

import { AVATAR_TINTS, avatarTint } from './tint'

const MAX_CODE_POINT = 0x10ffff
const MODULUS = 0x100000000

const expectTint = (name: string, hint: string): void => {
  const tint = avatarTint(name)

  expect(Number.isInteger(tint), hint).toBe(true)
  expect(tint, hint).toBeGreaterThanOrEqual(1)
  expect(tint, hint).toBeLessThanOrEqual(AVATAR_TINTS)
}

describe('avatarTint boundaries', () => {
  it('tints a name that is empty or holds nothing but spacing', () => {
    for (const name of ['', ' ', '\t\n\r ', ' ']) {
      expectTint(name, JSON.stringify(name))
    }
  })

  it('tints a name of one character and one of ten thousand', () => {
    expectTint('x', 'one character')
    expectTint('abcde'.repeat(2000), 'ten thousand characters')
    expectTint('x'.repeat(5000), 'five thousand of one character')
  })

  it('keeps the accumulator far below the exact-integer ceiling', () => {
    expect((MODULUS - 1) * 31 + MAX_CODE_POINT).toBeLessThan(Number.MAX_SAFE_INTEGER)
  })

  it('answers with a whole tint for the longest input the field could hold', () => {
    expectTint(String.fromCodePoint(MAX_CODE_POINT).repeat(10000), 'highest code point')
  })

  it('tints a name whatever its composition, script or direction', () => {
    const names = ['é', 'é', '\u{1d49c}nanda', '\u{1f469}‍\u{1f469}‍\u{1f467}']

    for (const name of [...names, 'مرحبا', '!!!...']) {
      expectTint(name, JSON.stringify(name))
    }
  })

  // A decorative tint is not a claim about identity, so the two compositions
  // are allowed to differ; only the range is a promise.
  it('treats a precomposed character and its decomposition as separate names', () => {
    expect(avatarTint('é')).not.toBe(avatarTint('é'))
  })

  it('gives the same answer to the same long name twice', () => {
    const name = 'Person '.repeat(1500)

    expect(avatarTint(name)).toBe(avatarTint(name))
  })

  // A palette that clumps is worse than no palette: half a roster in one
  // colour reads as a grouping nobody meant.
  it('spreads ten thousand names without letting one tint take a quarter', () => {
    const counts = new Map<number, number>()

    for (let index = 0; index < 10_000; index += 1) {
      const tint = avatarTint(`Person Number ${index} Name`)
      counts.set(tint, (counts.get(tint) ?? 0) + 1)
    }

    expect(counts.size).toBe(AVATAR_TINTS)
    expect(Math.max(...counts.values())).toBeLessThan(2500)
  })
})
