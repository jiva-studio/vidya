// Public API of the homework entity. Owned by T4.
//
// Requests live in `api/`, the view model in `model/`, small pieces of the
// entity's own interface in `ui/`. Nothing outside this slice reaches past
// this file.
export type { HomeworkApi } from './api'
export { homeworkApi, useHomeworkApi } from './api'
export type { ContextLookup, HomeworkFilters, HomeworkRow, WorkContext } from './model'
export { filterHomeworkRows, reason, toHomeworkRows, useHomework, useHomeworkQueue } from './model'
export { homeworkLabels, HomeworkStatusBadge, homeworkTones } from './ui'
