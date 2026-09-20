import { ApiProperty } from '@nestjs/swagger'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'

export class GetProfileResponse implements protocol.GetProfileResponse {
  // A name is absent until the person fills it in, and an address is absent for
  // someone who signed in by phone. The protocol declares both as present; the
  // constructor says what the database can actually hand over, and an absent
  // one leaves the key off the wire entirely.
  constructor(options: { userId: domain.UserId; email?: string; name?: string }) {
    this.userId = options.userId
    this.email = options.email
    this.name = options.name
  }

  @ApiProperty({ example: 'ed369256-2db0-46b8-ad49-b2b7a1bed036' })
  userId: domain.UserId

  @ApiProperty({ example: 'example@example.com' })
  email: string

  @ApiProperty({ example: 'name' })
  name: string
}
