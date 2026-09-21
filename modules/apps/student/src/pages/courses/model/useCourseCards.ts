import type { LocalSchool } from '@vidya/client'
import { computed } from 'vue'

import { useLocalEducation, useLocalRead, useLocalSchools } from '@/shared/data'

import type { CourseCard } from '../types'
import { keepOffered } from './keepOffered'
import { toCourseCards } from './toCourseCards'

interface Offer {
  readonly schools: readonly LocalSchool[]
  readonly cards: readonly CourseCard[]
}

const NOTHING: Offer = { schools: [], cards: [] }

/**
 * Every course a student can join, from every school they belong to at once.
 *
 * The schools are counted as well as joined to the courses: a student who
 * belongs to no school and a school that offers nothing are the same empty
 * list and two different sentences, and only the count tells them apart.
 */
export const useCourseCards = () => {
  const schools = useLocalSchools()
  const { courses, enrollments } = useLocalEducation()

  const { data, reading } = useLocalRead(async (): Promise<Offer> => {
    const [held, taught, places] = await Promise.all([
      schools.list(),
      courses.list(),
      enrollments.list(),
    ])

    return { schools: held, cards: toCourseCards(keepOffered(taught), held, places) }
  }, NOTHING)

  return {
    schools: computed(() => data.value.schools),
    cards: computed(() => data.value.cards),
    reading,
  }
}
