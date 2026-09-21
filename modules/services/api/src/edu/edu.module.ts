import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { RevokedTokensService } from '@vidya/api/auth/services'
import { AuthUsersService } from '@vidya/api/auth/services'
import {
  BlockStatesService,
  CoursesService,
  EnrollmentsService,
  GroupsService,
  HomeworkService,
  LessonsService,
  LessonVersionsService,
  RolesService,
  SchoolConfigsService,
  SchoolCreationService,
  SchoolsService,
  UserSchoolsService,
  UsersService,
} from '@vidya/api/edu/services'
import { PermissionsCacheEvictionModule } from '@vidya/api/permissionsCacheEviction.module'
import { AuditLogService, RedisService } from '@vidya/api/shared/services'
import {
  AuditLog,
  BlockState,
  Course,
  Enrollment,
  Group,
  Homework,
  Lesson,
  LessonVersion,
  School,
  User,
  UserRole,
} from '@vidya/entities'
import { Role } from '@vidya/entities'

import {
  CoursesController,
  EnrollmentsController,
  GroupsController,
  HomeworkController,
  JoinController,
  LessonsController,
  LessonVersionsController,
  RolesController,
  UserRolesController,
  UsersController,
} from './controllers'
import { SchoolConfigsController } from './controllers/schools/schoolConfigs.controller'
import { SchoolsController } from './controllers/schools/schools.controller'
import { UserSchoolsController } from './controllers/users/userSchools.controller'
import {
  IsRoleExistConstraint,
  IsSchoolExistConstraint,
  IsUserExistConstraint,
} from './validations'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Role,
      UserRole,
      School,
      Course,
      Group,
      Lesson,
      LessonVersion,
      Enrollment,
      Homework,
      BlockState,
      AuditLog,
    ]),
    // Answers `PERMISSIONS_CACHE_EVICTION`, the one instruction a role or
    // school-ownership change needs to give `auth` and cannot carry out on
    // its own.
    PermissionsCacheEvictionModule,
  ],
  controllers: [
    JoinController,
    RolesController,
    UserRolesController,
    UsersController,
    SchoolsController,
    SchoolConfigsController,
    UserSchoolsController,
    CoursesController,
    GroupsController,
    LessonsController,
    LessonVersionsController,
    EnrollmentsController,
    HomeworkController,
  ],
  providers: [
    // Services
    RedisService,
    AuthUsersService,
    AuditLogService,
    RolesService,
    SchoolConfigsService,
    UsersService,
    SchoolsService,
    SchoolCreationService,
    RevokedTokensService,
    UserSchoolsService,
    CoursesService,
    GroupsService,
    LessonsService,
    LessonVersionsService,
    EnrollmentsService,
    HomeworkService,
    BlockStatesService,

    // Constraints
    IsRoleExistConstraint,
    IsUserExistConstraint,
    IsSchoolExistConstraint,
  ],
  exports: [UserSchoolsService],
})
export class EduModule {}
