/**
 * HLC tests — T-D-1 … T-D-7.
 *
 * Copied from Lectorium (`libs/domain/sync/__tests__/hlc.test.ts`) and extended
 * with the cases the stage plan numbers: the property check that the padded
 * string order is the structured order (T-D-4), and the seeding rule that a
 * stamp observed from a faster device carries this device forward (T-D-7).
 */

import {
  compareHlc,
  compareHlcString,
  Hlc,
  hlcNow,
  hlcToString,
  maxHlcString,
  parseHlc,
} from '../hlc'

const DEV = 'device-a'

describe('hlcNow', () => {
  it('uses the wall clock and a zero counter on the first event', () => {
    expect(hlcNow(DEV, null, 1000)).toEqual({ physical: 1000, counter: 0, deviceId: DEV })
  })

  // T-D-1
  it('bumps the counter when the clock does not advance', () => {
    const first = hlcNow(DEV, null, 1000)
    const second = hlcNow(DEV, first, 1000)
    expect(second).toEqual({ physical: 1000, counter: 1, deviceId: DEV })
  })

  // T-D-1
  it('produces a strictly increasing sequence under a frozen clock', () => {
    let prev = hlcNow(DEV, null, 42)
    for (let i = 0; i < 100; i++) {
      const next = hlcNow(DEV, prev, 42)
      expect(compareHlc(next, prev)).toBeGreaterThan(0)
      prev = next
    }
  })

  // T-D-2
  it('bumps the counter when the clock runs backwards', () => {
    const first = hlcNow(DEV, null, 5000)
    const second = hlcNow(DEV, first, 4000)
    expect(second).toEqual({ physical: 5000, counter: 1, deviceId: DEV })
  })

  it('resets the counter when the clock advances', () => {
    const first = hlcNow(DEV, { physical: 1000, counter: 7, deviceId: DEV }, 1000)
    expect(first.counter).toBe(8)
    const advanced = hlcNow(DEV, first, 2000)
    expect(advanced).toEqual({ physical: 2000, counter: 0, deviceId: DEV })
  })

  // T-D-3
  it('rolls a counter overflow into the next millisecond', () => {
    const saturated: Hlc = { physical: 1000, counter: 99999, deviceId: DEV }
    const next = hlcNow(DEV, saturated, 1000)
    expect(next).toEqual({ physical: 1001, counter: 0, deviceId: DEV })
  })

  // T-D-7: the observed half of the seed. A stamp from a device with a faster
  // clock has to move this one forward, or the next local edit is stamped below
  // the change it descends from and loses on every device that pulls both.
  it('carries a stamp observed from a faster device forward', () => {
    const fromServer = parseHlc('000001800000000000:00003:device-fast')
    const local = hlcNow(DEV, fromServer, 1_000_000)

    expect(local.physical).toBe(1_800_000_000_000)
    expect(local.counter).toBe(4)
    expect(local.deviceId).toBe(DEV)
    expect(compareHlc(local, fromServer)).toBeGreaterThan(0)
  })
})

describe('hlcToString / parseHlc', () => {
  it('round-trips a value', () => {
    const hlc: Hlc = { physical: 1718000000000, counter: 3, deviceId: 'device-xyz' }
    expect(parseHlc(hlcToString(hlc))).toEqual(hlc)
  })

  it('zero-pads physical and counter to fixed widths', () => {
    expect(hlcToString({ physical: 1000, counter: 2, deviceId: 'd' })).toBe(
      '000000000001000:00002:d',
    )
  })

  it('keeps a device id that itself contains colons intact', () => {
    const hlc: Hlc = { physical: 10, counter: 0, deviceId: 'a:b:c' }
    expect(parseHlc(hlcToString(hlc))).toEqual(hlc)
  })

  // T-D-5
  it('throws on a structurally invalid string instead of returning rubbish', () => {
    expect(() => parseHlc('not-an-hlc')).toThrow()
    expect(() => parseHlc('1000:2:')).toThrow()
    expect(() => parseHlc('')).toThrow()
    expect(() => parseHlc('abc:def:device')).toThrow()
  })
})

describe('compareHlc', () => {
  it('orders by physical, then counter, then deviceId', () => {
    const base: Hlc = { physical: 1000, counter: 5, deviceId: 'b' }
    expect(compareHlc(base, { physical: 1001, counter: 0, deviceId: 'a' })).toBeLessThan(0)
    expect(compareHlc(base, { physical: 1000, counter: 6, deviceId: 'a' })).toBeLessThan(0)
    expect(compareHlc(base, { physical: 1000, counter: 5, deviceId: 'a' })).toBeGreaterThan(0)
    expect(compareHlc(base, { physical: 1000, counter: 5, deviceId: 'b' })).toBe(0)
  })

  // T-D-4: the padded serialization is what the server compares as a text
  // column, so it has to reproduce the structured ordering exactly. A thousand
  // pairs, drawn from a seeded generator rather than `Math.random`, so a
  // failure is reproducible.
  it('agrees with lexicographic string compare over a thousand random pairs', () => {
    const next = seededRandom(20260918)
    const devices = ['a', 'b', 'device-01', 'device-02', 'zz']
    const draw = (): Hlc => ({
      physical: 1_700_000_000_000 + Math.floor(next() * 5),
      counter: Math.floor(next() * 4),
      deviceId: devices[Math.floor(next() * devices.length)],
    })

    for (let i = 0; i < 1000; i++) {
      const a = draw()
      const b = draw()
      expect(Math.sign(compareHlcString(hlcToString(a), hlcToString(b)))).toBe(
        Math.sign(compareHlc(a, b)),
      )
    }
  })
})

describe('maxHlcString', () => {
  const lower = hlcToString({ physical: 1000, counter: 0, deviceId: 'a' })
  const higher = hlcToString({ physical: 1000, counter: 1, deviceId: 'a' })

  // T-D-6
  it('treats null as nothing on record, on either side', () => {
    expect(maxHlcString(null, higher)).toBe(higher)
    expect(maxHlcString(higher, null)).toBe(higher)
    expect(maxHlcString(null, null)).toBeNull()
  })

  it('returns the greater of two stamps', () => {
    expect(maxHlcString(lower, higher)).toBe(higher)
    expect(maxHlcString(higher, lower)).toBe(higher)
    expect(maxHlcString(higher, higher)).toBe(higher)
  })
})

/** A small linear congruential generator: deterministic, so a failure repeats. */
function seededRandom(seed: number): () => number {
  let state = seed % 2147483647
  if (state <= 0) state += 2147483646

  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}
