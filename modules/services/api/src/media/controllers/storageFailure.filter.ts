import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common'
import { Response } from 'express'

import { StorageFailedError, StorageFailure } from '../storageFailure'

/**
 * The status each storage refusal arrives as.
 *
 * They are four statuses rather than one because they are four different
 * things to do: 422 twice — once for an address we would not dial and once for
 * keys the address turned away — 502 when nothing answered, and 409 when the
 * ciphertext we hold no longer opens, which is ours to explain and theirs to
 * re-enter.
 */
const STATUSES: Readonly<Record<StorageFailure, number>> = Object.freeze({
  'endpoint-rejected': HttpStatus.UNPROCESSABLE_ENTITY,
  'credentials-rejected': HttpStatus.UNPROCESSABLE_ENTITY,
  unreachable: HttpStatus.BAD_GATEWAY,
  'secret-unreadable': HttpStatus.CONFLICT,
  'not-configured': HttpStatus.CONFLICT,
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
