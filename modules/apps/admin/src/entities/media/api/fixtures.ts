/**
 * The library a school appears to already have.
 *
 * Ids and instants are fixed so a story and an order assertion do not change
 * with the day they run on.
 */

import { asId, toIsoDateTime } from '@vidya/domain'

import type { MediaId, MediaKind, MediaRecord } from '../types'

const day = (index: number) => toIsoDateTime(new Date(Date.UTC(2026, 0, index + 1, 9, 0, 0)))

const record = (index: number, kind: MediaKind, name: string, sizeBytes: number): MediaRecord => ({
  id: asId<MediaId>(`00000000-0000-4000-8000-${String(index).padStart(12, '0')}`),
  kind,
  url: `/media/00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  name,
  sizeBytes,
  createdAt: day(index),
})

export const mediaFixtures: readonly MediaRecord[] = Object.freeze([
  record(1, 'image', 'Sanskrit alphabet chart.png', 412_000),
  record(2, 'image', 'Temple courtyard.jpg', 1_240_000),
  record(3, 'image', 'Mantra notation.png', 96_000),
  record(4, 'image', 'Teacher and students.jpg', 2_100_000),
  record(5, 'image', 'Lesson one cover.jpg', 780_000),
  record(6, 'image', 'Pronunciation diagram.png', 150_000),
  record(7, 'audio', 'Verse 2.13 recitation.mp3', 3_400_000),
  record(8, 'audio', 'Chapter one reading.mp3', 8_900_000),
  record(9, 'audio', 'Pronunciation drill.mp3', 1_050_000),
  record(10, 'video', 'Opening lecture.mp4', 84_000_000),
  record(11, 'video', 'Ceremony walkthrough.mp4', 51_000_000),
  record(12, 'image', 'Calendar of observances.png', 220_000),
])

/** Small enough that twelve fixtures make paging visible. */
export const MediaPageSize = 8

/** The upload the fake refuses, so the retry path is reachable by hand. */
export const FailingUploadPrefix = 'fail'
