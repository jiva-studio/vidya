import type { HomeworkId } from '@vidya/domain'
import type {
  GetHomeworkListResponse,
  GetHomeworkQuery,
  GetHomeworkResponse,
  ReviewHomeworkRequest,
  ReviewHomeworkResponse,
} from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

import type { HttpClient, HttpQuery } from '@/shared/api'
import { useHttp } from '@/shared/api'

/**
 * Every request the admin makes about a piece of work.
 *
 * `GetHomeworkQuery` declares `groupId`, but the controller reads only
 * `enrollmentId` and `status` from it, so sending a group would narrow nothing
 * and quietly show the wrong list. The queue filters by group on what it has
 * already resolved instead.
 */
export const homeworkApi = (http: HttpClient) => ({
  list: (query: Pick<GetHomeworkQuery, 'enrollmentId' | 'status'> = {}) =>
    http.get<GetHomeworkListResponse>(Routes().edu.homework.find(), query as HttpQuery),

  get: (id: HomeworkId) => http.get<GetHomeworkResponse>(Routes().edu.homework.get(id)),

  review: (id: HomeworkId, body: ReviewHomeworkRequest) =>
    http.patch<ReviewHomeworkResponse>(Routes().edu.homework.review(id), body),
})

export type HomeworkApi = ReturnType<typeof homeworkApi>

export const useHomeworkApi = (): HomeworkApi => homeworkApi(useHttp())
