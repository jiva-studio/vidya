import { AccessToken } from '@vidya/protocol'
import { Request } from 'express'

export type VidyaRequest = Request & {
  accessToken: AccessToken
}
