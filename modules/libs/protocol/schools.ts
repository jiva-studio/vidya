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

/* -------------------------------------------------------------------------- */
/*                                   Create                                   */
/* -------------------------------------------------------------------------- */

export type CreateSchoolRequest = crud.CreateItemRequest<Omit<SchoolDetails, 'id'>>
export type CreateSchoolResponse = crud.CreateItemResponse<SchoolDetails['id']>

/* -------------------------------------------------------------------------- */
/*                                    Read                                    */
/* -------------------------------------------------------------------------- */

export type GetSchoolsQuery = crud.PageQuery

export type GetSchoolsResponse = crud.GetPagedItemsListResponse<SchoolSummary>

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
