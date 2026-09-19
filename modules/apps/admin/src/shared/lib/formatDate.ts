import { locale } from '../i18n'

/**
 * Every date the admin shows goes through here.
 *
 * The API answers in ISO with a zone, and the operator works in theirs, so the
 * conversion has to happen somewhere. Scattering `toLocaleString()` through the
 * templates is how two screens end up disagreeing about the same timestamp.
 */
const DATE: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }

const DATE_TIME: Intl.DateTimeFormatOptions = { ...DATE, hour: '2-digit', minute: '2-digit' }

const parse = (value: string | Date | undefined | null): Date | undefined => {
  if (value === undefined || value === null) return undefined
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

const format = (
  value: string | Date | undefined | null,
  options: Intl.DateTimeFormatOptions,
  at?: string,
): string => {
  const date = parse(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat(at ?? locale.value, options).format(date)
}

/** A day, without a time: list columns and anything that is not an event. */
export const formatDate = (value: string | Date | undefined | null, at?: string): string =>
  format(value, DATE, at)

/** A day and a minute: when a request was decided, when work was reviewed. */
export const formatDateTime = (value: string | Date | undefined | null, at?: string): string =>
  format(value, DATE_TIME, at)
