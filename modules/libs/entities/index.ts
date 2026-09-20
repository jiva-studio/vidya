import { AuditLog } from './auditLog'
import { BlockState } from './blockState'
import { Course, LearningType } from './course'
import { Enrollment } from './enrollment'
import { Group, GroupStatus } from './group'
import { Homework } from './homework'
import { Lesson } from './lesson'
import { LessonVersion } from './lessonVersion'
import { Role } from './role'
import { School } from './school'
import { SyncJournal } from './syncJournal'
import { User } from './user'
import { UserRole } from './userRole'

export type { AuditAction } from './auditLog'
export type { SchoolConfig } from './school'
export type { SyncOp, SyncScopeKind } from './syncJournal'

export {
  AuditLog,
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
  SyncJournal,
  User,
  UserRole,
}

export const Entities = [
  AuditLog,
  BlockState,
  Course,
  Enrollment,
  Group,
  Homework,
  Lesson,
  LessonVersion,
  School,
  SyncJournal,
  User,
  Role,
  UserRole,
]
