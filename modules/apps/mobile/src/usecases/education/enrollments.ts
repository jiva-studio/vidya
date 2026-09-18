import type { CourseId, EnrollmentId } from '@vidya/domain'
import type {
  CreateEnrollmentResponse,
  EnrollmentDetails,
  EnrollmentSummary,
  GetEnrollmentResponse,
  GetEnrollmentsResponse,
} from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

import type { HttpClient } from '@/ports'

const routes = Routes()

/** No student id: the API answers a plain student with their own rows. */
export const listMyEnrollments = async (http: HttpClient): Promise<EnrollmentSummary[]> =>
  (await http.get<GetEnrollmentsResponse>(routes.edu.enrollments.find())).items

export const getEnrollment = (http: HttpClient, id: EnrollmentId): Promise<EnrollmentDetails> =>
  http.get<GetEnrollmentResponse>(routes.edu.enrollments.get(id))

/** The student asks to join. The school decides, so the answer is only an id. */
export const requestEnrollment = async (
  http: HttpClient,
  courseId: CourseId,
): Promise<EnrollmentId> =>
  (await http.post<CreateEnrollmentResponse>(routes.edu.enrollments.create(), { courseId })).id
