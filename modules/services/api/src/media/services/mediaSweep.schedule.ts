import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'

import { MediaSweepService } from './mediaSweep.service'

/** The sweep is hourly: the rows it collects are a day old, so the hour is slack. */
const SWEEP_EVERY_MS = 60 * 60 * 1000

/** One scheduled job, and the means to run it now instead of at the next tick. */
export type ScheduledJob = { fireOnTick(): Promise<void> }

/**
 * When the sweep runs.
 *
 * A timer of its own rather than `@nestjs/schedule`: the package ships as ESM
 * from version 12 and cannot be loaded by this service's suites at all, and the
 * `fireOnTick` of the cron library behind it does not wait for an asynchronous
 * job — which makes "run it now" impossible to observe.
 *
 * It holds no behaviour: the sweep is called directly by whoever needs it, and a
 * schedule that owned any of the work would make the tick the only way to reach
 * it.
 */
@Injectable()
export class MediaSweepSchedule implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(MediaSweepSchedule.name)

  private timer: NodeJS.Timeout | null = null

  constructor(private readonly sweep: MediaSweepService) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.runQuietly(), SWEEP_EVERY_MS)

    // The tick must never be the reason the process stays alive.
    this.timer.unref()
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  /** The jobs on the tick, keyed so an operator can name the one to run. */
  getCronJobs(): Map<string, ScheduledJob> {
    return new Map([['media-sweep', { fireOnTick: () => this.sweep.sweepAbandonedUploads() }]])
  }

  /**
   * A tick that failed must not take the process down: an unhandled rejection
   * from a timer does exactly that, and the next hour's sweep would have
   * collected the same rows anyway.
   */
  private async runQuietly(): Promise<void> {
    try {
      await this.sweep.sweepAbandonedUploads()
    } catch (failure) {
      this.logger.error(`the hourly sweep did not finish: ${(failure as Error).message}`)
    }
  }
}
