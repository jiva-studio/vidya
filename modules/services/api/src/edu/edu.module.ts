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
  SchoolCreationService,
  SchoolsService,
  UserSchoolsService,
  UsersService,
} from '@vidya/api/edu/services'
import { RedisService } from '@vidya/api/shared/services'
import {
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
  LessonsController,
  LessonVersionsController,
  ProgressController,
  RolesController,
  UserRolesController,
  UsersController,
} from './controllers'
import { SchoolConfigsController } from './controllers/schools/schoolConfigs.controller'
import { SchoolsController } from './controllers/schools/schools.controller'
import { UserSchoolsController } from './controllers/users/userSchools.controller'
import { EducationMappingProfile } from './mappers/education.mapper'
import { RolesMappingProfile } from './mappers/roles.mapper'
import { SchoolsMappingProfile } from './mappers/schools.mapper'
import { UsersMappingProfile } from './mappers/users.mapper'
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
    ]),
  ],
  controllers: [
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
    ProgressController,
  ],
  providers: [
    // Services
    RedisService,
    AuthUsersService,
    RolesService,
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
    // Mappers
    RolesMappingProfile,
    UsersMappingProfile,
    SchoolsMappingProfile,
    EducationMappingProfile,
  ],
})
export class EduModule {}
