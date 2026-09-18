import { CourseId, LessonId, SchoolId } from '@vidya/domain'
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'

import { Course } from './course'
import { School } from './school'

@Entity({ name: 'lessons' })
export class Lesson {
  @PrimaryGeneratedColumn('uuid')
  id: LessonId

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

  @Column()
  lessonNumber: number

  @Column()
  title: string
}
