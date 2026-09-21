import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { UserAuthentication } from '@vidya/api/auth/utils'
import * as domain from '@vidya/domain'
import { Enrollment, Lesson, LessonVersion, Media } from '@vidya/entities'
import { DataSource, In } from 'typeorm'

/** Who is asking, as the token describes them and nothing more. */
export type MediaReader = Pick<UserAuthentication, 'userId' | 'permissions'>

const stated = (address: string | undefined): address is string => typeof address === 'string'

/**
 * Where each kind of block keeps the files it shows.
 *
 * Written out per kind rather than probed by field name so that a block type
 * added to the document cannot quietly carry an address nobody reads: it has no
 * entry here and the module does not compile. A student's access is computed
 * from these addresses, so a missed one is a lesson they cannot open.
 */
const ADDRESSES: {
  [TKind in domain.LessonBlock['type']]: (
    block: Extract<domain.LessonBlock, { type: TKind }>,
  ) => string[]
} = {
  text: () => [],
  quiz: () => [],
  image: (block) => [block.url].filter(stated),
  audio: (block) => [block.url].filter(stated),
  video: (block) => [block.url, block.posterUrl].filter(stated),
}

/** The files one block shows, in the order the block names them. */
export const addressesOf = (block: domain.LessonBlock): string[] =>
  (ADDRESSES[block.type] as (named: domain.LessonBlock) => string[])(block)

const mediaIdsIn = (content: domain.LessonContent | null): domain.MediaId[] =>
  (content?.sections ?? [])
    .flatMap((section) => section.blocks ?? [])
    .flatMap(addressesOf)
    .map(domain.parseMediaPath)
    .filter((mediaId): mediaId is domain.MediaId => mediaId !== undefined)

/**
 * Which of the asked-for files this caller may be given an address for.
 *
 * Two entirely different rights meet here. A member of staff holds
 * `media:read` in a school and may read everything that school stores. A
 * student holds no permission at all: the place on the course is the whole of
 * it, and it reaches exactly the files a published version of one of that
 * course's lessons shows — a draft names nothing anyone but the school may see.
 */
@Injectable()
export class MediaReadAccessService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findReadable(ids: domain.MediaId[], auth: MediaReader): Promise<Media[]> {
    if (ids.length === 0) return []

    const rows = await this.findReadyRows(ids)
    const byPermission = rows.filter((row) => this.mayReadSchool(auth, row))
    const rest = rows.filter((row) => !this.mayReadSchool(auth, row))

    if (rest.length === 0) return byPermission

    const published = await this.publishedToStudent(auth.userId)

    return [...byPermission, ...rest.filter((row) => published.has(row.id))]
  }

  private mayReadSchool(auth: MediaReader, media: Media): boolean {
    return auth.permissions.has(['media:read'], { schoolId: media.schoolId })
  }

  /** A pending row has no bytes behind it and a failed one never will. */
  private async findReadyRows(ids: domain.MediaId[]): Promise<Media[]> {
    return this.dataSource.getRepository(Media).find({ where: { id: In(ids), status: 'ready' } })
  }

  /**
   * Every file a published lesson of this student's courses shows.
   *
   * The documents are read and scanned rather than filtered in the database:
   * `lesson_versions.content` is a `json` column, which Postgres cannot index
   * or search by containment, so the work is bounded by the student's own
   * accepted places instead.
   */
  private async publishedToStudent(studentId: domain.UserId): Promise<Set<domain.MediaId>> {
    const documents = await this.dataSource
      .getRepository(LessonVersion)
      .createQueryBuilder('version')
      .innerJoin(Lesson, 'lesson', 'lesson.id = version.lessonId')
      .innerJoin(Enrollment, 'enrollment', 'enrollment.courseId = lesson.courseId')
      .where('version.status = :published', { published: 'published' })
      .andWhere('enrollment.studentId = :studentId', { studentId })
      .andWhere('enrollment.status = :accepted', { accepted: 'accepted' })
      .select('version.content', 'content')
      .getRawMany<{ content: domain.LessonContent | null }>()

    return new Set(documents.flatMap((document) => mediaIdsIn(document.content)))
  }
}
