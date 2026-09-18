import { faker } from '@faker-js/faker'
import * as domain from '@vidya/domain'

/**
 * A fresh identifier of the given kind, for fixtures.
 *
 * `asId` on a raw uuid would say the same thing, but this keeps the assertion
 * in one place: production code should almost never reach for `asId`, so a
 * search for it stays a short list of real boundaries.
 */
export const newId = <TId extends domain.Id<string>>(): TId => domain.asId<TId>(faker.string.uuid())
