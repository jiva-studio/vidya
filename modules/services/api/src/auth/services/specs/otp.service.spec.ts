import { Test } from '@nestjs/testing'
import { OtpConfig } from '@vidya/api/configs'
import { RedisService } from '@vidya/api/shared/services'
import { Otp, OtpStorageKey, OtpType } from '@vidya/protocol'

import { OtpService } from '../otp.service'

/**
 * A stand-in for Redis that remembers what it was told.
 *
 * The real client is not interesting here — what matters is which key was
 * written, what went into it, and whether it was deleted — and booting one
 * would make a suite about code generation depend on a running server.
 */
class FakeRedis {
  readonly store = new Map<string, string>()
  readonly ttls = new Map<string, number>()

  async get(key: string): Promise<string | null> {
    return this.store.has(key) ? this.store.get(key) : null
  }

  async set(key: string, value: string, seconds: number): Promise<void> {
    this.store.set(key, value)
    this.ttls.set(key, seconds)
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key)
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }
}

const LOGIN = 'student@example.com'

const build = async (config: { alphabet: string; length: number }) => {
  const redis = new FakeRedis()
  const module = await Test.createTestingModule({
    providers: [
      OtpService,
      { provide: RedisService, useValue: redis },
      { provide: OtpConfig.KEY, useValue: config },
    ],
  }).compile()

  return { redis, otp: module.get(OtpService) }
}

describe('OtpService', () => {
  describe('generate', () => {
    it('stores the code against the login, and lets it expire on its own', async () => {
      const { redis, otp } = await build({ alphabet: '0123456789', length: 6 })

      const issued = await otp.generate(LOGIN, OtpType.Email)
      const key = OtpStorageKey(LOGIN)

      expect(JSON.parse(redis.store.get(key)) as Otp).toEqual(issued)
      expect(redis.ttls.get(key)).toBe(300)
    })

    it('draws only from the configured alphabet, at the configured length', async () => {
      const { otp } = await build({ alphabet: 'ABC', length: 4 })

      for (let i = 0; i < 200; i++) {
        const { code } = await otp.generate(LOGIN, OtpType.Email)

        expect(code).toHaveLength(4)
        expect(code).toMatch(/^[ABC]{4}$/)
      }
    })

    it('reaches every character of the alphabet, and never past its end', async () => {
      // `charAt` beyond the last index returns '', so an off-by-one in the
      // bound would silently shorten the code rather than throw.
      const { otp } = await build({ alphabet: 'AB', length: 1 })
      const seen = new Set<string>()

      for (let i = 0; i < 200; i++) seen.add((await otp.generate(LOGIN, OtpType.Email)).code)

      expect([...seen].sort()).toEqual(['A', 'B'])
    })

    it('does not issue the same code twice in a row', async () => {
      // A constant generator passes every test above. This is the one that
      // would have failed when the codes came from a seeded or stubbed source.
      const { otp } = await build({ alphabet: '0123456789', length: 6 })
      const codes = new Set<string>()

      for (let i = 0; i < 50; i++) codes.add((await otp.generate(LOGIN, OtpType.Email)).code)

      expect(codes.size).toBeGreaterThan(40)
    })
  })

  describe('validate', () => {
    it('returns the stored otp for the right code', async () => {
      const { otp } = await build({ alphabet: '0123456789', length: 6 })
      const issued = await otp.generate(LOGIN, OtpType.Email)

      await expect(otp.validate(LOGIN, issued.code)).resolves.toEqual(issued)
    })

    it('refuses the same code a second time', async () => {
      const { otp } = await build({ alphabet: '0123456789', length: 6 })
      const issued = await otp.generate(LOGIN, OtpType.Email)

      await otp.validate(LOGIN, issued.code)

      await expect(otp.validate(LOGIN, issued.code)).resolves.toBeUndefined()
    })

    it('keeps the code alive after a wrong guess', async () => {
      // Deleting on failure would let anyone lock a user out by guessing once.
      const { otp } = await build({ alphabet: '0123456789', length: 6 })
      const issued = await otp.generate(LOGIN, OtpType.Email)

      await expect(otp.validate(LOGIN, 'wrong!')).resolves.toBeUndefined()
      await expect(otp.validate(LOGIN, issued.code)).resolves.toEqual(issued)
    })

    it('refuses when nothing was ever issued', async () => {
      const { otp } = await build({ alphabet: '0123456789', length: 6 })

      await expect(otp.validate(LOGIN, '123456')).resolves.toBeUndefined()
    })

    it('does not accept one login’s code for another', async () => {
      const { otp } = await build({ alphabet: '0123456789', length: 6 })
      const issued = await otp.generate(LOGIN, OtpType.Email)

      await expect(otp.validate('someone.else@example.com', issued.code)).resolves.toBeUndefined()
    })
  })

  describe('isExpired', () => {
    it('is false while the code is stored and true once it is used', async () => {
      const { otp } = await build({ alphabet: '0123456789', length: 6 })
      const issued = await otp.generate(LOGIN, OtpType.Email)

      await expect(otp.isExpired(LOGIN)).resolves.toBe(false)

      await otp.validate(LOGIN, issued.code)

      await expect(otp.isExpired(LOGIN)).resolves.toBe(true)
    })

    it('is true for a login that never asked for one', async () => {
      const { otp } = await build({ alphabet: '0123456789', length: 6 })

      await expect(otp.isExpired('nobody@example.com')).resolves.toBe(true)
    })
  })
})
