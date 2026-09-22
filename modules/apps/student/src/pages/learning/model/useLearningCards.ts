import type { LocalSchool } from '@vidya/client'
import { computed } from 'vue'

import { useLocalEducation, useLocalRead, useLocalSchools } from '@/shared/data'

import type { LearningCard } from '../types'
import { toLearningCards } from './toLearningCards'

interface Learning {
  readonly schools: readonly LocalSchool[]
  readonly cards: readonly LearningCard[]
}

const NOTHING: Learning = { schools: [], cards: [] }

/**
 * Every place this student holds, from every school at once.
 *
 * The three reads are one answer: a card names its school, so a list of places
 * read without the schools beside it would draw badges that fill in one run
 * later. Read from the local database rather than asked of the server —
 * membership is what the student sees in their lists, and a second source for
 * it would let the screen say one thing while the lists say another.
 */
export const useLearningCards = () => {
  const schools = useLocalSchools()
  const { courses, enrollments } = useLocalEducation()

  const { data, reading } = useLocalRead(async (): Promise<Learning> => {
    const [held, taught, places] = await Promise.all([
      schools.list(),
      courses.list(),
      enrollments.list(),
    ])

    return { schools: held, cards: toLearningCards(places, taught, held) }
  }, NOTHING)

  return {
    schools: computed(() => data.value.schools),
    cards: computed(() => data.value.cards),
    reading,
  }
}
