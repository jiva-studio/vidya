import * as domain from '@vidya/domain'
import { Course } from '@vidya/entities'

import { toCourseDetails, toCourseSummaries } from '../education.mapper'

describe('education.mapper - courses', () => {
  const sampleCourse: Course = {
    id: '11111111-1111-1111-1111-111111111111' as domain.CourseId,
    schoolId: '22222222-2222-2222-2222-222222222222' as domain.SchoolId,
    name: 'Bhagavad Gita As It Is',
    description: 'A study of the core philosophy',
    coverImageUrl: 'https://cdn.example.com/courses/bg-cover.jpg',
    learningType: 'individual',
    status: 'published',
  } as unknown as Course

  it('projects all course details fields including coverImageUrl', () => {
    const details = toCourseDetails(sampleCourse)

    expect(details).toEqual({
      id: '11111111-1111-1111-1111-111111111111',
      schoolId: '22222222-2222-2222-2222-222222222222',
      name: 'Bhagavad Gita As It Is',
      description: 'A study of the core philosophy',
      coverImageUrl: 'https://cdn.example.com/courses/bg-cover.jpg',
      learningType: 'individual',
      status: 'published',
    })
  })

  it('projects null coverImageUrl in course details when null or absent', () => {
    const courseWithoutCover: Course = {
      ...sampleCourse,
      coverImageUrl: null,
    } as unknown as Course

    const details = toCourseDetails(courseWithoutCover)
    expect(details.coverImageUrl).toBeNull()
  })

  it('projects course summaries with coverImageUrl', () => {
    const summaries = toCourseSummaries([sampleCourse])

    expect(summaries).toHaveLength(1)
    expect(summaries[0]).toEqual({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Bhagavad Gita As It Is',
      description: 'A study of the core philosophy',
      coverImageUrl: 'https://cdn.example.com/courses/bg-cover.jpg',
      status: 'published',
    })
  })
})
