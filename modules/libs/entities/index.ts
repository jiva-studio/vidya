import { BlockState } from './blockState'
import { Course, LearningType } from './course'
import { Enrollment } from './enrollment'
import { Group, GroupStatus } from './group'
import { Homework } from './homework'
import { Lesson } from './lesson'
import { LessonVersion } from './lessonVersion'
import { Role } from './role'
import { School } from './school'
import { User } from './user'
import { UserRole } from './userRole'

export type { SchoolConfig } from './school'

export {
  BlockState,
  Course,
  Enrollment,
  Group,
  GroupStatus,
  Homework,
  LearningType,
  Lesson,
  LessonVersion,
  Role,
  School,
  User,
  UserRole,
}

export const Entities = [
  BlockState,
  Course,
  Enrollment,
  Group,
  Homework,
  Lesson,
  LessonVersion,
  School,
  User,
  Role,
  UserRole,
]
