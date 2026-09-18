import { Course, LearningType } from './course'
import { Group, GroupStatus } from './group'
import { Lesson } from './lesson'
import { Role } from './role'
import { School } from './school'
import { User } from './user'
import { UserRole } from './userRole'

export { Course, Group, GroupStatus, LearningType, Lesson, Role, School, User, UserRole }

export const Entities = [Course, Group, Lesson, School, User, Role, UserRole]
