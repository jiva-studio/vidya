import type { HttpQuery } from '../api'

export interface RecordedCall {
  readonly method: string
  readonly path: string
  readonly query?: HttpQuery
  readonly body?: unknown
}

/**
 * What the fake transport answers with.
 *
 * A plain value is returned; an `Error` is thrown, which is how a story or a
 * test shows the error state without a server. A function is called with the
 * request, for the cases where the answer depends on what was asked.
 */
export type FakeAnswer = unknown | Error | ((call: RecordedCall) => unknown)

export type FakeAnswers = Record<string, FakeAnswer>

/** The mounting options the tracks actually use; anything else belongs in a test. */
export interface MountOptions {
  readonly props?: Record<string, unknown>
  readonly slots?: Record<string, unknown>
  readonly attachTo?: Element | string
  readonly global?: {
    readonly plugins?: unknown[]
    readonly stubs?: Record<string, unknown>
    readonly provide?: Record<string | symbol, unknown>
  }
}
