import { createMap, type Mapper } from '@automapper/core'
import { AutomapperProfile, InjectMapper } from '@automapper/nestjs'
import { Injectable } from '@nestjs/common'
import * as dto from '@vidya/api/edu/dto'
import * as entities from '@vidya/entities'

import { sameFields } from './sameFields'

/**
 * Mappings for the teaching half of the domain. One profile rather than five,
 * because these entities are read together and splitting them would mean five
 * files of identical ceremony.
 */
@Injectable()
export class EducationMappingProfile extends AutomapperProfile {
  constructor(@InjectMapper() mapper: Mapper) {
    super(mapper)
  }

  override get profile() {
    return (mapper: Mapper) => {
      /* --------------------------------- Courses -------------------------------- */

      const course = ['id', 'schoolId', 'name', 'description', 'learningType']
      createMap(mapper, entities.Course, dto.CourseDetails, ...sameFields(...course))
      createMap(mapper, entities.Course, dto.GetCourseResponse, ...sameFields(...course))
      createMap(mapper, entities.Course, dto.UpdateCourseResponse, ...sameFields(...course))
      createMap(
        mapper,
        entities.Course,
        dto.CourseSummary,
        ...sameFields('id', 'name', 'description'),
      )
      createMap(mapper, entities.Course, dto.CreateCourseResponse, ...sameFields('id'))
      createMap(
        mapper,
        dto.CreateCourseRequest,
        entities.Course,
        ...sameFields('schoolId', 'name', 'description', 'learningType'),
      )

      /* --------------------------------- Groups --------------------------------- */

      const group = ['id', 'courseId', 'name', 'description']
      createMap(mapper, entities.Group, dto.GroupDetails, ...sameFields(...group))
      createMap(mapper, entities.Group, dto.GetGroupResponse, ...sameFields(...group))
      createMap(mapper, entities.Group, dto.UpdateGroupResponse, ...sameFields(...group))
      createMap(mapper, entities.Group, dto.GroupSummary, ...sameFields('id', 'name'))
      createMap(mapper, entities.Group, dto.CreateGroupResponse, ...sameFields('id'))

      /* --------------------------------- Lessons -------------------------------- */

      const lesson = ['id', 'courseId', 'lessonNumber', 'title']
      createMap(mapper, entities.Lesson, dto.LessonDetails, ...sameFields(...lesson))
      createMap(mapper, entities.Lesson, dto.GetLessonResponse, ...sameFields(...lesson))
      createMap(mapper, entities.Lesson, dto.UpdateLessonResponse, ...sameFields(...lesson))
      createMap(
        mapper,
        entities.Lesson,
        dto.LessonSummary,
        ...sameFields('id', 'lessonNumber', 'title'),
      )
      createMap(mapper, entities.Lesson, dto.CreateLessonResponse, ...sameFields('id'))

      const version = ['id', 'lessonId', 'version', 'status', 'publishedAt']
      createMap(mapper, entities.LessonVersion, dto.LessonVersionSummary, ...sameFields(...version))
      createMap(
        mapper,
        entities.LessonVersion,
        dto.LessonVersionDetails,
        ...sameFields(...version, 'content'),
      )
      createMap(
        mapper,
        entities.LessonVersion,
        dto.GetLessonVersionResponse,
        ...sameFields(...version, 'content'),
      )
      createMap(
        mapper,
        entities.LessonVersion,
        dto.UpdateLessonVersionResponse,
        ...sameFields(...version, 'content'),
      )
      createMap(
        mapper,
        entities.LessonVersion,
        dto.PublishLessonVersionResponse,
        ...sameFields(...version),
      )

      /* ------------------------------- Enrollments ------------------------------ */

      const enrollment = [
        'id',
        'courseId',
        'groupId',
        'studentId',
        'schoolId',
        'status',
        'decidedById',
        'decidedAt',
        'createdAt',
      ]
      createMap(mapper, entities.Enrollment, dto.EnrollmentDetails, ...sameFields(...enrollment))
      createMap(
        mapper,
        entities.Enrollment,
        dto.GetEnrollmentResponse,
        ...sameFields(...enrollment),
      )
      createMap(
        mapper,
        entities.Enrollment,
        dto.ModerateEnrollmentResponse,
        ...sameFields(...enrollment),
      )
      createMap(
        mapper,
        entities.Enrollment,
        dto.AssignEnrollmentGroupResponse,
        ...sameFields(...enrollment),
      )
      createMap(
        mapper,
        entities.Enrollment,
        dto.EnrollmentSummary,
        ...sameFields('id', 'courseId', 'groupId', 'status', 'createdAt'),
      )
      createMap(mapper, entities.Enrollment, dto.CreateEnrollmentResponse, ...sameFields('id'))

      /* -------------------------------- Homework -------------------------------- */

      const homework = [
        'id',
        'enrollmentId',
        'lessonVersionId',
        'sectionId',
        'schoolId',
        'status',
        'text',
        'grade',
        'reviewedById',
        'submittedAt',
        'reviewedAt',
        'answeredSupersededVersion',
      ]
      createMap(mapper, entities.Homework, dto.HomeworkDetails, ...sameFields(...homework))
      createMap(mapper, entities.Homework, dto.GetHomeworkResponse, ...sameFields(...homework))
      createMap(mapper, entities.Homework, dto.SubmitHomeworkResponse, ...sameFields(...homework))
      createMap(mapper, entities.Homework, dto.ReviewHomeworkResponse, ...sameFields(...homework))
      createMap(
        mapper,
        entities.Homework,
        dto.HomeworkSummary,
        ...sameFields('id', 'enrollmentId', 'sectionId', 'status', 'grade', 'submittedAt'),
      )

      /* ------------------------------ Block states ------------------------------ */

      const blockState = [
        'id',
        'enrollmentId',
        'lessonVersionId',
        'blockId',
        'schoolId',
        'state',
        'updatedAt',
      ]
      createMap(mapper, entities.BlockState, dto.BlockStateDetails, ...sameFields(...blockState))
      createMap(
        mapper,
        entities.BlockState,
        dto.SaveBlockStateResponse,
        ...sameFields(...blockState),
      )
    }
  }
}
