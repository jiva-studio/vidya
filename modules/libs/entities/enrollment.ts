import { EnrollmentStatus } from '@vidya/domain'
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'

import { Course } from './course'
import { Group } from './group'
import { School } from './school'
import { User } from './user'

/** A student's place on a course. The group comes later, or not at all yet. */
@Entity({ name: 'enrollments' })
export class Enrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ nullable: false })
  courseId: string

  @ManyToOne(() => Course)
  @JoinColumn()
  course: Course

  @Column({ nullable: true })
  groupId: string

  @ManyToOne(() => Group)
  @JoinColumn()
  group: Group

  @Column({ nullable: false })
  studentId: string

  @ManyToOne(() => User)
  @JoinColumn()
  student: User

  @Column({ nullable: false })
  schoolId: string

  @ManyToOne(() => School)
  @JoinColumn()
  school: School

  @Column({ nullable: false, default: 'pending' })
  status: EnrollmentStatus

  @Column({ nullable: true })
  decidedById: string

  @Column({ type: 'timestamptz', nullable: true })
  decidedAt: Date

  @Column({ type: 'timestamptz', nullable: true })
  archivedAt: Date

  @Column({ type: 'timestamptz', nullable: false, default: () => 'now()' })
  createdAt: Date
}
