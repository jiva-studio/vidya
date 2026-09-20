import { INestApplication } from '@nestjs/common'
import { MailerService } from '@nestjs-modules/mailer'
import { createTestingApp, TestingBootstrap, TestingOverride } from '@vidya/api/edu/shared'
import { RedisService } from '@vidya/api/shared/services'

/** Remembers what it was asked to send, and never opens a socket. */
export class SentMail {
  readonly messages: { to: string; context: { code: string } }[] = []

  async sendMail(message: { to: string; context: { code: string } }): Promise<void> {
    this.messages.push(message)
  }

  get last() {
    return this.messages[this.messages.length - 1]
  }
}

/** Redis with real semantics, so the OTP lifetime is exercised rather than mocked away. */
export class FakeRedis {
  readonly store = new Map<string, string>()

  async get(key: string): Promise<string | null> {
    return this.store.has(key) ? this.store.get(key) : null
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value)
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key)
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }

  async incr(key: string): Promise<number> {
    const value = (Number(this.store.get(key)) || 0) + 1
    this.store.set(key, String(value))
    return value
  }
}

export type AuthContext = {
  app: INestApplication
  mail: SentMail
  redis: FakeRedis
}

export const createAuthContext = async (bootstrap?: TestingBootstrap): Promise<AuthContext> => {
  const mail = new SentMail()
  const redis = new FakeRedis()

  const overrides: TestingOverride[] = [
    { provide: MailerService, useValue: mail },
    { provide: RedisService, useValue: redis },
  ]

  return { app: await createTestingApp(overrides, bootstrap), mail, redis }
}
