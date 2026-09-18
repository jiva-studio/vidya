import { forMember, mapFrom } from '@automapper/core'

/**
 * Builds the `forMember` calls for fields that keep their name across the
 * boundary, which is nearly all of them.
 *
 * The entities carry no `@AutoMap` decorators, so automapper cannot pair
 * same-named properties by itself and every field has to be declared. Written
 * out by hand that is six lines per field; here it is one name. Fields that
 * genuinely change shape still get their own explicit `forMember`.
 */
// The mapper's member selectors are not expressible over a generic key here,
// which is the one seam where `any` earns its place.

export const sameFields = (...keys: string[]) =>
  keys.map((key) =>
    forMember(
      (d: any) => d[key],
      mapFrom((s: any) => s[key]),
    ),
  )
