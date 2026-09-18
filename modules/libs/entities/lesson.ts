import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'

import { Course } from './course'
import { School } from './school'

@Entity({ name: 'lessons' })
export class Lesson {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ nullable: false })
  courseId: string

  @ManyToOne(() => Course)
  @JoinColumn()
  course: Course

  @Column({ nullable: false })
  schoolId: string

  @ManyToOne(() => School)
  @JoinColumn()
  school: School

  @Column()
  lessonNumber: number

  @Column()
  title: string
}
