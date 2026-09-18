import type { CourseId } from '@vidya/domain'
import type { GetGroupsResponse, GroupSummary } from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

import type { HttpClient } from '@/ports'

const routes = Routes()

export const listGroupsOfCourse = async (
  http: HttpClient,
  courseId: CourseId,
): Promise<GroupSummary[]> =>
  (await http.get<GetGroupsResponse>(routes.edu.groups.find(), { courseId })).items
