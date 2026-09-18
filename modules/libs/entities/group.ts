import { CourseId, GroupId, SchoolId } from '@vidya/domain'
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'

import { Course } from './course'
import { School } from './school'

export enum GroupStatus {
  Pending = 'pending',
  Active = 'active',
  Inactive = 'inactive',
}

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

  @Column({
    type: 'enum',
    enum: GroupStatus,
    default: GroupStatus.Pending,
    enumName: 'groupStatus',
  })
  status: GroupStatus
}
