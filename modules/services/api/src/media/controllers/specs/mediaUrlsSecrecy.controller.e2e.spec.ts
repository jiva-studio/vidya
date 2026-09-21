import { INestApplication, LoggerService } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import { AuditLog } from '@vidya/entities'
import { DataSource } from 'typeorm'

import { TEST_MASTER_KEY } from './context'
import { createReadFlow, ReadFlow } from './readFlow'

/** Everything the application said, as one string to search. */
class CapturedLog implements LoggerService {
  readonly lines: string[] = []

  log = (...args: unknown[]) => this.write(args)
  error = (...args: unknown[]) => this.write(args)
  warn = (...args: unknown[]) => this.write(args)
  debug = (...args: unknown[]) => this.write(args)
  verbose = (...args: unknown[]) => this.write(args)
  fatal = (...args: unknown[]) => this.write(args)

  get text(): string {
    return this.lines.join('\n')
  }

  private write(args: unknown[]): void {
    this.lines.push(args.map((arg) => this.render(arg)).join(' '))
  }

  private render(arg: unknown): string {
    if (typeof arg === 'string') return arg
    if (arg instanceof Error) return `${arg.message} ${arg.stack ?? ''}`

    try {
      return JSON.stringify(arg) ?? String(arg)
    } catch {
      return String(arg)
    }
  }
}

/** The query parameters that are themselves the access, whoever signed. */
const SIGNATURE_SHAPED = /X-Amz-Signature|bcdn_token|X-Amz-Credential|[?&]sig=/i

describe('what a signature is allowed to leave behind', () => {
  let app: INestApplication
  let read: ReadFlow
  let captured: CapturedLog

  beforeEach(async () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY
    captured = new CapturedLog()
    app = await createTestingApp([], (nest) => nest.useLogger(captured))
    read = await createReadFlow(app)
  })

  afterEach(async () => {
    await app.close()
  })

  const storeOne = (): Promise<string> =>
    read.storeReady(read.flow.ctx.one.school.id, read.flow.ctx.one.users.owner)

  const sign = async (mediaId: string): Promise<string> => {
    const response = await read.askUrls(
      [mediaId],
      await read.tokenOf(read.flow.ctx.one.users.owner),
    )

    expect(response.status).toBe(200)
    return response.body.urls[mediaId].url as string
  }

  const auditRows = () => app.get(DataSource).getRepository(AuditLog)

  it('writes no signed address into the application log', async () => {
    const url = await sign(await storeOne())

    expect(captured.text).not.toContain(url)
    expect(captured.text).not.toMatch(SIGNATURE_SHAPED)
  })

  it('writes no signed address into the audit trail either', async () => {
    const url = await sign(await storeOne())

    const trail = JSON.stringify(await auditRows().find())

    expect(trail).not.toContain(url)
    expect(trail).not.toMatch(SIGNATURE_SHAPED)
  })

  it('records no audit entry for a read at all, having nothing safe to record', async () => {
    const mediaId = await storeOne()

    const before = await auditRows().count()
    await sign(mediaId)
    const after = await auditRows().count()

    expect(after).toBe(before)
  })
})
