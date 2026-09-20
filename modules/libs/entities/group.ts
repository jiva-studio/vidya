import { CourseId, GroupId, GroupStatus, GroupStatuses, SchoolId } from '@vidya/domain'
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'

import { Course } from './course'
import { School } from './school'

@Entity({ name: 'groups' })
export class Group {
  @PrimaryGeneratedColumn('uuid')
  id: GroupId

  @Column({ unique: true })
  name: string

  @Column({ nullable: true })
  description: string

  @Column({ nullable: false })
  courseId: CourseId

  @ManyToOne(() => Course)
  @JoinColumn()
  course: Course

  @Column({ nullable: false })
  schoolId: SchoolId

  @ManyToOne(() => School)
  @JoinColumn()
  school: School

  @Column({ nullable: true })
  startsAt: Date

  @Column({ type: 'enum', enum: GroupStatuses, enumName: 'groupStatus', default: 'pending' })
  status: GroupStatus
}
