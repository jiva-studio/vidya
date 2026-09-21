import * as domain from '@vidya/domain'

import * as crud from './crud'

/* -------------------------------------------------------------------------- */
/*                                   Models                                   */
/* -------------------------------------------------------------------------- */

export type SchoolDetails = {
  id: domain.SchoolId
  name: string

  /** External link; the bytes are never stored, so offline a device shows the initial. */
  logoUrl: string | null

  description: string | null
}

export type SchoolSummary = Pick<SchoolDetails, 'id' | 'name' | 'logoUrl'>

/**
 * What a joining link resolves to, before anyone has signed in.
 *
 * Deliberately three fields: enough to draw the card a person decides on, and
 * nothing that says anything about who else is in the school.
 */
export type SchoolCard = Pick<SchoolDetails, 'id' | 'name' | 'logoUrl'>

export type ResolveSchoolResponse = crud.GetItemResponse<SchoolCard>

/** The code a school hands out; created on request, never derived from the name. */
export type SchoolJoinCode = { code: string }
export type CreateSchoolCodeResponse = crud.GetItemResponse<SchoolJoinCode>

/* -------------------------------------------------------------------------- */
/*                                   Create                                   */
/* -------------------------------------------------------------------------- */

export type CreateSchoolRequest = crud.CreateItemRequest<Omit<SchoolDetails, 'id'>>
export type CreateSchoolResponse = crud.CreateItemResponse<SchoolDetails['id']>

/* -------------------------------------------------------------------------- */
/*                                    Read                                    */
/* -------------------------------------------------------------------------- */

export type GetSchoolsResponse = crud.GetItemsListResponse<SchoolSummary>

export type GetSchoolResponse = crud.GetItemResponse<SchoolDetails>

/* -------------------------------------------------------------------------- */
/*                                   Update                                   */
/* -------------------------------------------------------------------------- */

export type UpdateSchoolRequest = crud.UpdateItemRequest<Omit<SchoolDetails, 'id'>>

export type UpdateSchoolResponse = crud.UpdateItemResponse<SchoolDetails>

/* -------------------------------------------------------------------------- */
/*                                   Delete                                   */
/* -------------------------------------------------------------------------- */

export type DeleteSchoolResponse = crud.DeleteItemResponse
