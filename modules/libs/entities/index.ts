import { AuditLog } from './auditLog'
import { BlockState } from './blockState'
import { Course, LearningType } from './course'
import { Enrollment } from './enrollment'
import { Group } from './group'
import { Homework } from './homework'
import { Lesson } from './lesson'
import { LessonVersion } from './lessonVersion'
import { Media } from './media'
import { Role } from './role'
import { School } from './school'
import { StorageProfile } from './storageProfile'
import { SyncJournal } from './syncJournal'
import { User } from './user'
import { UserRole } from './userRole'

export type { AuditAction } from './auditLog'
export type { SchoolConfig } from './school'
export type { SyncOp, SyncScopeKind } from './syncJournal'
export type { GroupStatus } from '@vidya/domain'

export {
  AuditLog,
  BlockState,
  Course,
  Enrollment,
  Group,
  Homework,
  LearningType,
  Lesson,
  LessonVersion,
  Media,
  Role,
  School,
  StorageProfile,
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
  Media,
  School,
  StorageProfile,
  SyncJournal,
  User,
  Role,
  UserRole,
]
