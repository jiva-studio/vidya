import {
  CourseId,
  EnrollmentId,
  EnrollmentStatus,
  GroupId,
  PreferredTimes,
  SchoolId,
  UserId,
} from '@vidya/domain'
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'

import { Course } from './course'
import { Group } from './group'
import { School } from './school'
import { User } from './user'

/** A student's place on a course. The group comes later, or not at all yet. */
@Entity({ name: 'enrollments' })
export class Enrollment {
  @PrimaryGeneratedColumn('uuid')
  id: EnrollmentId

  @Column({ nullable: false })
  courseId: CourseId

  @ManyToOne(() => Course)
  @JoinColumn()
  course: Course

  @Column({ nullable: true })
  groupId: GroupId

  @ManyToOne(() => Group)
  @JoinColumn()
  group: Group

  @Column({ nullable: false })
  studentId: UserId

  @ManyToOne(() => User)
  @JoinColumn()
  student: User

  @Column({ nullable: false })
  schoolId: SchoolId

  @ManyToOne(() => School)
  @JoinColumn()
  school: School

  @Column({ nullable: false, default: 'pending' })
  status: EnrollmentStatus

  @Column({ nullable: true })
  decidedById: UserId

  @Column({ type: 'timestamptz', nullable: true })
  decidedAt: Date

  @Column({ type: 'timestamptz', nullable: false, default: () => 'now()' })
  createdAt: Date

  /** The group the student asked for. A wish; `groupId` is the school's answer. */
  @Column({ name: 'preferred_group_id', nullable: true })
  preferredGroupId: GroupId

  @Column({ name: 'preferred_times', type: 'jsonb', nullable: true })
  preferredTimes: PreferredTimes

  @Column({ name: 'comment', nullable: true })
  comment: string

  /** Set when the student puts a finished request away; cleared by a new decision. */
  @Column({ name: 'archived_by_student_at', type: 'timestamptz', nullable: true })
  archivedByStudentAt: Date

  /** The school's own side. Never journalled, never sent to a device. */
  @Column({ name: 'archived_by_school_at', type: 'timestamptz', nullable: true })
  archivedBySchoolAt: Date

  @Column({ name: 'archived_by_school_by_id', nullable: true })
  archivedBySchoolById: UserId
}
