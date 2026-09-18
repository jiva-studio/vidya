import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'

import { Enrollment } from './enrollment'
import { LessonVersion } from './lessonVersion'
import { School } from './school'

/** How far a student got through one block: video watched, quiz answered. */
@Entity({ name: 'block_states' })
export class BlockState {
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
  blockId: string

  @Column({ nullable: false })
  schoolId: string

  @ManyToOne(() => School)
  @JoinColumn()
  school: School

  @Column('json')
  state: object

  @Column({ type: 'timestamptz', nullable: false, default: () => 'now()' })
  updatedAt: Date
}
