import type { IEnrollmentRepository, LocalEnrollment, NewEnrollmentRequest } from '@/ports'

/** What a screen can say about a request: which course, under which id. */
export type EnrollmentRequest = Omit<NewEnrollmentRequest, 'studentId'>

/**
 * Ask to join a course by writing the request down.
 *
 * Nothing is sent: the row is journaled and leaves on the next run, which is
 * what makes the request survive a tunnel, an aeroplane and a flat battery.
 *
 * The student is not named here because a screen holds no identity — the device
 * is signed in as one student per connection, and the repository writes every
 * row under that identity.
 */
export const requestEnrollmentLocally = (
  enrollments: IEnrollmentRepository,
  request: EnrollmentRequest,
): Promise<LocalEnrollment> => enrollments.request(request)
