import { LessonVersionStatus } from '@vidya/domain'
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'

import { Lesson } from './lesson'

/**
 * A snapshot of a lesson's content. A draft is editable; publishing freezes it,
 * because homework references the version it was answered against and that
 * reference is only worth anything if the version cannot change underneath it.
 */
@Entity({ name: 'lesson_versions' })
export class LessonVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ nullable: false })
  lessonId: string

  @ManyToOne(() => Lesson)
  @JoinColumn()
  lesson: Lesson

  @Column({ nullable: false })
  version: number

  @Column('json')
  content: object

  @Column({ nullable: false, default: 'draft' })
  status: LessonVersionStatus

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date

  @Column({ type: 'timestamptz', nullable: false, default: () => 'now()' })
  createdAt: Date
}
