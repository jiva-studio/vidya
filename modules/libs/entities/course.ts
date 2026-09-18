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
  id: string

  @Column({ nullable: false })
  name: string

  @Column({ nullable: true })
  description: string

  @Column({
    type: 'enum',
    enum: LearningType,
    enumName: 'courseLearningType',
    default: LearningType.Individual,
  })
  learningType: domain.CourseLearningType

  @Column({ nullable: false })
  schoolId: string

  @ManyToOne(() => School)
  @JoinColumn()
  school: School
}
