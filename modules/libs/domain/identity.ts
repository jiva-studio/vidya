/**
 * Branded primitives for the values that cross every layer: entity identifiers
 * and instants.
 *
 * Both are strings at runtime and carry no cost. The brand exists so the
 * compiler can tell two of them apart, which plain `string` cannot: every id in
 * this system is a UUID, so passing a course id where a school id belongs is
 * invisible to the type checker, to the database and to the tests, and shows up
 * only as a tenant reading another tenant's rows.
 */

declare const brand: unique symbol
declare const instantBrand: unique symbol

type Brand<TValue, TBrand extends string> = TValue & { readonly [brand]?: TBrand }

/* -------------------------------------------------------------------------- */
/*                                Identifiers                                 */
/* -------------------------------------------------------------------------- */

export type Id<TEntity extends string> = Brand<string, `${TEntity}Id`>

export type SchoolId = Id<'School'>
export type CourseId = Id<'Course'>
export type GroupId = Id<'Group'>
export type LessonId = Id<'Lesson'>
export type LessonVersionId = Id<'LessonVersion'>
export type EnrollmentId = Id<'Enrollment'>
export type HomeworkId = Id<'Homework'>
export type BlockStateId = Id<'BlockState'>
export type UserId = Id<'User'>
export type RoleId = Id<'Role'>
export type UserRoleId = Id<'UserRole'>
export type AuditLogId = Id<'AuditLog'>
export type MediaId = Id<'Media'>
export type StorageProfileId = Id<'StorageProfile'>

/** Identifies a block or section inside lesson content, not a table row. */
export type BlockId = Id<'Block'>
export type SectionId = Id<'Section'>

/**
 * Asserts that a string is an identifier of the given kind.
 *
 * Reach for this only where a value genuinely arrives untyped — a route
 * parameter, a decoded token, a test fixture. Everywhere else the brand should
 * be carried through rather than re-applied, because each call is a place the
 * compiler stopped checking.
 */
export const asId = <TId extends Id<string>>(value: string): TId => value as TId

/* -------------------------------------------------------------------------- */
/*                                  Instants                                  */
/* -------------------------------------------------------------------------- */

/**
 * An instant on the wire: ISO 8601, UTC, milliseconds, always `Z`.
 *
 * One shape, so a client never has to guess whether an offset is present or
 * what precision to expect. `Date` stays on the inside — it is a runtime object
 * and cannot survive JSON — and the conversion happens in exactly one place.
 */
export type IsoDateTime = string & { readonly [instantBrand]: 'IsoDateTime' }

const ISO_UTC_MILLIS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

export const toIsoDateTime = (value: Date): IsoDateTime => value.toISOString() as IsoDateTime

/** Parses an instant received from a client, refusing anything off-shape. */
export const parseIsoDateTime = (value: string): IsoDateTime => {
  if (!ISO_UTC_MILLIS.test(value) || Number.isNaN(Date.parse(value))) {
    throw new TypeError(`not an ISO 8601 UTC instant: ${value}`)
  }

  return value as IsoDateTime
}

export const isIsoDateTime = (value: string): value is IsoDateTime =>
  ISO_UTC_MILLIS.test(value) && !Number.isNaN(Date.parse(value))
