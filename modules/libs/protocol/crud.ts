/* -------------------------------------------------------------------------- */
/*                                   Creaate                                  */
/* -------------------------------------------------------------------------- */

/**
 * Request to create an item.
 */
export type CreateItemRequest<TItemType> = TItemType

/**
 * Response to creating an item.
 */
export type CreateItemResponse<TIdentityType> = {
  id: TIdentityType
}

/* -------------------------------------------------------------------------- */
/*                                    Read                                    */
/* -------------------------------------------------------------------------- */

/**
 * Generic response for retrieving a list of
 * items of a certain type.
 */
export type GetItemsListResponse<TItemType> = {
  items: TItemType[]
}

/**
 * A page of a list, with how many there are in all.
 *
 * `total` counts what the filter matched, not what this page holds: without it
 * a client cannot draw the last page, and cannot tell a short page from the end
 * of the list.
 */
export type GetPagedItemsListResponse<TItemType> = GetItemsListResponse<TItemType> & {
  total: number
}

/** What a list takes to return one page of itself. */
export type PageQuery = {
  /** How many rows at most. The server caps it; see the DTO. */
  limit?: number
  offset?: number
}

/**
 * Generic response for retrieving a single item of
 * a certain type.
 */
export type GetItemResponse<TItemType> = TItemType

/* -------------------------------------------------------------------------- */
/*                                   Update                                   */
/* -------------------------------------------------------------------------- */

/**
 * Request to update an item.
 */
export type UpdateItemRequest<TItemType> = Partial<TItemType>

/**
 * Response to updating an item.
 */
export type UpdateItemResponse<TItemType> = TItemType

/* -------------------------------------------------------------------------- */
/*                                   Delete                                   */
/* -------------------------------------------------------------------------- */

/**
 * Request to delete an item.
 */
export type DeleteItemResponse = {
  success: boolean
}
