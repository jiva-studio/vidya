import { HomeworkStatus } from '@vidya/domain'
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'

import { Enrollment } from './enrollment'
import { LessonVersion } from './lessonVersion'
import { School } from './school'

/**
 * One student's answer to one section of one lesson version.
 *
 * `schoolId` is denormalised because these rows sync to devices and the sync
 * engine filters by school; deriving it through the enrolment on every pull
 * would make the query the slowest part of syncing.
 */
@Entity({ name: 'homework' })
export class Homework {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ nullable: false })
  enrollmentId: string

  @ManyToOne(() => Enrollment)
  @JoinColumn()
  enrollment: Enrollment

  @Column({ nullable: false })
  lessonVersionId: string

  @ManyToOne(() => LessonVersion)
  @JoinColumn()
  lessonVersion: LessonVersion

  @Column({ nullable: false })
  sectionId: string

  @Column({ nullable: false })
  schoolId: string

  @ManyToOne(() => School)
  @JoinColumn()
  school: School

  @Column({ nullable: false, default: 'open' })
  status: HomeworkStatus

  @Column({ nullable: false, default: '' })
  text: string

  @Column({ nullable: true })
  grade: number

  /** True when the answered version had already been superseded at submit time. */
  @Column({ nullable: false, default: false })
  answeredSupersededVersion: boolean

  @Column({ nullable: true })
  reviewedById: string

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt: Date

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date

  @Column({ type: 'timestamptz', nullable: false, default: () => 'now()' })
  createdAt: Date

  @Column({ type: 'timestamptz', nullable: false, default: () => 'now()' })
  updatedAt: Date
}
