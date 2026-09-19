import { BadRequestException } from '@nestjs/common'
import { SyncErrorResponse, SyncRequestErrorCode } from '@vidya/protocol'

/**
 * A failure of the whole request rather than of one row.
 *
 * Per-row refusals travel inside `results` with a `SyncRejectionReason`, because
 * a rejected answer must never hold up the rows beside it. These three are
 * different in kind: the request could not be read at all, so there is no row to
 * answer. The machine-readable `code` is what the device branches on — an
 * `invalidCursor` is a bug to report, a `tooManyScopes` is a prompt to split the
 * request — and a human message is not something a client can branch on.
 */
export class SyncRequestException extends BadRequestException {
  constructor(code: SyncRequestErrorCode, message: string) {
    const body: SyncErrorResponse = {
      code,
      message: [message],
      error: 'Bad Request',
      statusCode: 400,
    }

    super(body)
  }
}
