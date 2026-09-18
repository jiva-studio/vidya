import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'

import { Course } from './course'

/**
 * Shape of the `content` JSON column. The lesson content schema is not settled
 * yet, so this stays deliberately open rather than pretending to be empty.
 */
export type LessonContent = Record<string, unknown>

@Entity({ name: 'lessons' })
export class Lesson {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ nullable: false })
  courseId: string

  @ManyToOne(() => Course)
  @JoinColumn()
  course: Course

  @Column({ unique: true })
  lessonNumber: number

  @Column({ unique: true })
  title: string

  @Column('json')
  content: LessonContent
}
