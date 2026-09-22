import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common'
import { Response } from 'express'

import { MediaRefusalKind, MediaRefusedError } from '../mediaRefusal'

/**
 * The status each refusal arrives as.
 *
 * Both ways of being too big answer 413 and are still two keys: "no room left
 * in the bucket" and "this file is larger than a file may be" are acted on
 * differently, and one message for both leaves the uploader guessing. Content
 * naming a file the school does not have is 422 rather than 404: what is
 * missing is inside the document, not at the address that was asked for.
 */
const STATUSES: Readonly<Record<MediaRefusalKind, number>> = Object.freeze({
  'quota-exceeded': HttpStatus.PAYLOAD_TOO_LARGE,
  'too-large': HttpStatus.PAYLOAD_TOO_LARGE,
  'type-not-allowed': HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  'not-ready': HttpStatus.CONFLICT,
  'in-use': HttpStatus.CONFLICT,
  'unknown-media': HttpStatus.UNPROCESSABLE_ENTITY,
})

const REASONS: Readonly<Record<number, string>> = Object.freeze({
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'Payload Too Large',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'Unsupported Media Type',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
})

@Catch(MediaRefusedError)
export class MediaRefusalFilter implements ExceptionFilter {
  catch(exception: MediaRefusedError, host: ArgumentsHost): void {
    const status = STATUSES[exception.kind]
    const response = host.switchToHttp().getResponse<Response>()

    response.status(status).json({
      message: [exception.refusal],
      error: REASONS[status],
      statusCode: status,
      ...exception.details,
    })
  }
}
