import { Logger } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { MediaConfig } from '@vidya/api/configs'

import { MediaSweepSchedule } from '../mediaSweep.schedule'
import { MediaSweepService } from '../mediaSweep.service'

const TICK_MS = 50

describe('the timer production runs the sweep on', () => {
  const env = process.env

  let schedule: MediaSweepSchedule
  let sweeps: number
  let failing: boolean
  let logged: string[]

  beforeEach(async () => {
    process.env = { ...env }
    process.env.VIDYA_MEDIA_SWEEP_EVERY_MS = String(TICK_MS)

    sweeps = 0
    failing = false
    logged = []

    const sweep = {
      sweepAbandonedUploads: async () => {
        sweeps += 1
        if (failing) throw new Error('storage refused to delete the object')
      },
    }

    const module = await Test.createTestingModule({
      providers: [
        MediaSweepSchedule,
        { provide: MediaSweepService, useValue: sweep },
        { provide: MediaConfig.KEY, useValue: MediaConfig() },
      ],
    }).compile()

    schedule = module.get(MediaSweepSchedule)

    jest.spyOn(Logger.prototype, 'error').mockImplementation((...args: unknown[]) => {
      logged.push(args.map((arg) => String(arg)).join(' '))
    })

    jest.useFakeTimers()
  })

  afterEach(() => {
    schedule.onApplicationShutdown()
    jest.useRealTimers()
    jest.restoreAllMocks()
    process.env = env
  })

  /** Lets the timer fire and the asynchronous job behind it settle. */
  const tick = async (times: number): Promise<void> => {
    for (let fired = 0; fired < times; fired += 1) {
      jest.advanceTimersByTime(TICK_MS)
      await Promise.resolve()
      await Promise.resolve()
    }
  }

  it('sweeps on the period the installation configured, not one fixed in the code', async () => {
    schedule.onApplicationBootstrap()

    await tick(1)

    expect(sweeps).toBe(1)
  })

  it('sweeps again on the following period', async () => {
    schedule.onApplicationBootstrap()

    await tick(2)

    expect(sweeps).toBe(2)
  })

  it('reports a tick that failed rather than taking the process down with it', async () => {
    failing = true
    schedule.onApplicationBootstrap()

    await tick(1)

    expect(logged.join('\n')).toContain('storage refused to delete the object')
  })

  it('comes back on the next period after a tick that failed', async () => {
    failing = true
    schedule.onApplicationBootstrap()
    await tick(1)

    failing = false
    await tick(1)

    expect(sweeps).toBe(2)
  })

  it('stops ticking once the application is shutting down', async () => {
    schedule.onApplicationBootstrap()
    await tick(1)

    schedule.onApplicationShutdown()
    await tick(3)

    expect(sweeps).toBe(1)
  })
})
