import {
  BlockId,
  BlockStateId,
  EnrollmentId,
  LessonBlockState,
  LessonVersionId,
  QuizVerdict,
  SchoolId,
} from '@vidya/domain'
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'

import { Enrollment } from './enrollment'
import { LessonVersion } from './lessonVersion'
import { School } from './school'

/** How far a student got through one block: video watched, quiz answered. */
@Entity({ name: 'block_states' })
export class BlockState {
  @PrimaryGeneratedColumn('uuid')
  id: BlockStateId

  @Column({ nullable: false })
  enrollmentId: EnrollmentId

  @ManyToOne(() => Enrollment)
  @JoinColumn()
  enrollment: Enrollment

  @Column({ nullable: false })
  lessonVersionId: LessonVersionId

  @ManyToOne(() => LessonVersion)
  @JoinColumn()
  lessonVersion: LessonVersion

  @Column({ nullable: false })
  blockId: BlockId

  @Column({ nullable: false })
  schoolId: SchoolId

  @ManyToOne(() => School)
  @JoinColumn()
  school: School

  @Column('json')
  state: LessonBlockState

  /** The server's answer to the student's: written here, never by a device. */
  @Column({ type: 'json', nullable: true })
  verdict: QuizVerdict | null

  @Column({ type: 'timestamptz', nullable: false, default: () => 'now()' })
  updatedAt: Date
}
