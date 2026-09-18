import { IsoDateTime, toIsoDateTime } from '@vidya/domain'

/**
 * The entity shape that can produce a given response shape.
 *
 * Identical to the DTO except where the DTO declares an instant: the database
 * hands us a `Date` there, and `Date` cannot survive JSON. Writing that
 * difference into the type is what makes the conversion below mandatory rather
 * than hopeful — a field the entity stores as something else entirely no longer
 * compiles, where the previous `as TDto` cast accepted it silently.
 */
export type Projectable<TDto> = {
  [K in keyof TDto]: IsoDateTime extends Extract<TDto[K], IsoDateTime>
    ? Date | null | undefined
    : TDto[K]
}

/**
 * Copies the named fields from an entity onto a plain response object.
 *
 * This replaces automapper. Every mapping in this codebase was a same-name
 * field copy, so the library bought nothing but ceremony — six lines of
 * `forMember(..., mapFrom(...))` per field, a profile class per domain, and a
 * generic seam that could only be typed with `any`. It also pinned NestJS to
 * version 10.
 *
 * Naming the fields explicitly is deliberate: a wholesale spread would leak
 * whatever the entity gains next — a password hash, an internal flag — straight
 * onto the wire.
 */
export const project = <TDto>(source: Projectable<TDto>, fields: readonly (keyof TDto)[]): TDto => {
  const out: Record<string, unknown> = {}

  for (const field of fields) {
    const value = (source as Record<string, unknown>)[field as string]

    // A nullable column is absent, not null, once it reaches an optional field.
    out[field as string] = value instanceof Date ? toIsoDateTime(value) : (value ?? undefined)
  }

  return out as TDto
}

/** Same, for a list. */
export const projectAll = <TDto>(
  sources: readonly Projectable<TDto>[],
  fields: readonly (keyof TDto)[],
): TDto[] => sources.map((source) => project<TDto>(source, fields))
