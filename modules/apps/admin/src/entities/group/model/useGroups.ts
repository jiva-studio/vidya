import type { GroupSummary } from '@vidya/protocol'
import { onMounted, ref, watch } from 'vue'

import { useCurrentSchool } from '@/shared/access'
import { useHttp } from '@/shared/api'
import { usePagedList } from '@/shared/lib'

import { getGroups } from '../api'

/**
 * The groups the operator may see, a page at a time, optionally narrowed to
 * one course.
 *
 * The request carries no school: `GetGroupsQuery` has no field for one and the
 * server scopes by the grants in the token. Narrowing by course starts the
 * list again, because page two of every group is not page two of one course's.
 */
export const useGroups = () => {
  const http = useHttp()
  const { generation } = useCurrentSchool()

  const courseId = ref<string>('')

  const list = usePagedList<GroupSummary>({
    read: (page) => getGroups(http, { courseId: courseId.value || undefined, ...page }),
    fallback: 'groups-load-failed',
  })

  watch([generation, courseId], () => {
    list.restart()
  })

  onMounted(() => {
    void list.load()
  })

  return { ...list, items: list.rows, courseId, reload: list.load }
}
