/** The bounds the server validates a mark against (`ReviewHomeworkRequest.grade`). */
export const GRADE_MIN = 0
export const GRADE_MAX = 100

/** The marks a reviewer reaches for; everything else is typed into the field. */
export const QUICK_GRADES = [60, 70, 80, 90, 100]

/**
 * A mark read from what was typed.
 *
 * The field is plain text rather than a number input — the browser's spinner is
 * not how a person enters a mark — so everything that is not a digit is dropped
 * here, and a figure above the maximum is brought back to it.
 */
export const parseGrade = (value: string): number | undefined => {
  const digits = value.replace(/\D/g, '')
  if (digits === '') return undefined

  return Math.min(Number.parseInt(digits, 10), GRADE_MAX)
}

/** Whether a mark can be sent: accepting without one is refused by the server. */
export const isGradeGiven = (value?: number): value is number =>
  value !== undefined && Number.isInteger(value) && value >= GRADE_MIN && value <= GRADE_MAX
