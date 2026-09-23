import { CourseId, SchoolId } from '@vidya/domain'
import * as domain from '@vidya/domain'
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'

import { School } from './school'

/** @deprecated Use {@link domain.CourseLearningType}; kept as the TypeORM enum name. */
export enum LearningType {
  Individual = 'individual',
  Group = 'group',
}

@Entity({ name: 'courses' })
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id: CourseId

  @Column({ nullable: false })
  name: string

  @Column({ nullable: true })
  description: string

  @Column({ nullable: true, type: 'character varying' })
  coverImageUrl: string | null

  @Column({
    type: 'enum',
    enum: LearningType,
    enumName: 'courseLearningType',
    default: LearningType.Individual,
  })
  learningType: domain.CourseLearningType

  @Column({ nullable: false, default: 'draft' })
  status: domain.CourseStatus

  @Column({ nullable: false })
  schoolId: SchoolId

  @ManyToOne(() => School)
  @JoinColumn()
  school: School
}
