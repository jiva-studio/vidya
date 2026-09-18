/**
 * Copies the named fields from an entity onto a plain response object.
 *
 * This replaces automapper. Every mapping in this codebase was a same-name
 * field copy, so the library bought nothing but ceremony — six lines of
 * `forMember(..., mapFrom(...))` per field, a profile class per domain, and a
 * generic seam that could only be typed with `any`. It also pinned NestJS to
 * version 10.
 *
 * Fields absent on the source come out `undefined`, which is what an optional
 * response field should be. Naming the fields explicitly is deliberate: a
 * wholesale spread would leak whatever the entity gains next — a password
 * hash, an internal flag — straight onto the wire.
 */
export const project = <TDto>(source: object, fields: readonly string[]): TDto => {
  const out: Record<string, unknown> = {}

  for (const field of fields) {
    out[field] = (source as Record<string, unknown>)[field]
  }

  return out as TDto
}

/** Same, for a list. */
export const projectAll = <TDto>(sources: object[], fields: readonly string[]): TDto[] =>
  sources.map((s) => project<TDto>(s, fields))
