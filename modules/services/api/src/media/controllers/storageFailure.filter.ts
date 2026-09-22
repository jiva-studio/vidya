import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common'
import { Response } from 'express'

import { StorageFailedError, StorageFailure } from '../storageFailure'

/**
 * The status each storage refusal arrives as.
 *
 * They are three statuses rather than one because they are different things to
 * do: 422 for what the school typed — an address we would not dial, keys the
 * address turned away — 502 when nothing answered, and 409 for the states that
 * are ours to explain and the school's to ask again after: a ciphertext that no
 * longer opens, a rotation somebody else won, a stored ceiling we cannot answer
 * with, storage nobody has configured yet.
 */
const STATUSES: Readonly<Record<StorageFailure, number>> = Object.freeze({
  'endpoint-rejected': HttpStatus.UNPROCESSABLE_ENTITY,
  'credentials-rejected': HttpStatus.UNPROCESSABLE_ENTITY,
  unreachable: HttpStatus.BAD_GATEWAY,
  'secret-unreadable': HttpStatus.CONFLICT,
  'rotation-conflicted': HttpStatus.CONFLICT,
  'quota-unreadable': HttpStatus.CONFLICT,
  'not-configured': HttpStatus.CONFLICT,
  'stream-unsupported': HttpStatus.CONFLICT,
})

const REASONS: Readonly<Record<number, string>> = Object.freeze({
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
  [HttpStatus.BAD_GATEWAY]: 'Bad Gateway',
  [HttpStatus.CONFLICT]: 'Conflict',
})

/**
 * Answers a storage refusal with its key and nothing more.
 *
 * The body is built here rather than by letting the error through a generic
 * filter because the only extra detail a storage refusal has is the credential
 * that was refused; a message assembled from the cause is how a secret reaches
 * a response body and a log.
 */
@Catch(StorageFailedError)
export class StorageFailureFilter implements ExceptionFilter {
  catch(exception: StorageFailedError, host: ArgumentsHost): void {
    const status = STATUSES[exception.failure]
    const response = host.switchToHttp().getResponse<Response>()

    response.status(status).json({
      message: [exception.refusal],
      error: REASONS[status],
      statusCode: status,
    })
  }
}
