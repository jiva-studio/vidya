import { inject, type InjectionKey } from 'vue'

import type { LocalEducation } from './types'

/**
 * How a screen reads the courses, lessons and progress this machine holds.
 *
 * Built in the composition root over the one database the tab opened, and
 * handed down as one set: a screen showing a course reads four of these to
 * draw one page, and four separate lookups would be four chances to read one
 * of them from somewhere else.
 */
export const educationKey: InjectionKey<LocalEducation> = Symbol('vidya.education')

export const useLocalEducation = (): LocalEducation => {
  const education = inject(educationKey, null)
  if (education === null) throw new Error('no local education was provided to this application')

  return education
}
