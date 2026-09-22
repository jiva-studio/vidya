import { Id, LessonVersionId, MediaId, SchoolId } from '@vidya/domain'
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

/**
 * One file a lesson version points at.
 *
 * Written only by the save that recounts a version's content, and in that
 * save's transaction: the table is what refuses the deletion of a file a lesson
 * still shows, so a row that drifts from the content is either a file nobody
 * can delete or a lesson that loses its illustration.
 */
@Entity({ name: 'media_usages' })
export class MediaUsage {
  @PrimaryGeneratedColumn('uuid')
  id: Id<'MediaUsage'>

  @Column({ type: 'uuid', nullable: false })
  mediaId: MediaId

  @Column({ type: 'uuid', nullable: false })
  lessonVersionId: LessonVersionId

  @Column({ type: 'uuid', nullable: false })
  schoolId: SchoolId

  @Column({ type: 'timestamptz', nullable: false, default: () => 'now()' })
  createdAt: Date
}
