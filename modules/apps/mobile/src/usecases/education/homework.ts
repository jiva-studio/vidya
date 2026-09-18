import type { BlockId, EnrollmentId, LessonVersionId, SectionId } from '@vidya/domain'
import type {
  BlockStateDetails,
  GetBlockStatesResponse,
  GetHomeworkListResponse,
  HomeworkDetails,
  HomeworkSummary,
  LessonBlockState,
  SaveBlockStateResponse,
  SubmitHomeworkResponse,
} from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

import type { HttpClient } from '@/ports'

const routes = Routes()

export const listHomeworkOfEnrollment = async (
  http: HttpClient,
  enrollmentId: EnrollmentId,
): Promise<HomeworkSummary[]> =>
  (await http.get<GetHomeworkListResponse>(routes.edu.homework.find(), { enrollmentId })).items

/** Submitting freezes the answer until it comes back for revision. */
export const submitHomework = (
  http: HttpClient,
  answer: { lessonVersionId: LessonVersionId; sectionId: SectionId; text: string },
): Promise<HomeworkDetails> =>
  http.post<SubmitHomeworkResponse>(routes.edu.homework.submit(), answer)

export const listBlockStates = async (
  http: HttpClient,
  enrollmentId: EnrollmentId,
  lessonVersionId?: LessonVersionId,
): Promise<BlockStateDetails[]> =>
  (
    await http.get<GetBlockStatesResponse>(routes.edu.progress.find(), {
      enrollmentId,
      lessonVersionId,
    })
  ).items

export const saveBlockState = (
  http: HttpClient,
  progress: { lessonVersionId: LessonVersionId; blockId: BlockId; state: LessonBlockState },
): Promise<BlockStateDetails> =>
  http.post<SaveBlockStateResponse>(routes.edu.progress.save(), progress)
