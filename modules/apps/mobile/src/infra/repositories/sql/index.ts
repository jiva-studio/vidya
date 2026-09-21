/**
 * SQL adapters over the device's local schema.
 *
 * Three of them satisfy the sync ports declared in `@vidya/domain/ports`
 * (`outbox`, `syncApply`, `syncState`); eight are the collection repositories the
 * screens read through; one is the journal decorator that ties a local write to
 * its outbox row. No adapter imports another — what they share is the
 * projection table and the row writer, which are data and plumbing, not
 * adapters.
 */

export * from './blockStatesRepository.sql'
export * from './collectionProjections'
export * from './coursesRepository.sql'
export * from './enrollmentsRepository.sql'
export * from './groupsRepository.sql'
export * from './homeworkRepository.sql'
export * from './lessonsRepository.sql'
export * from './lessonVersionsRepository.sql'
export * from './outboxRepository.sql'
export * from './rowWriter'
export * from './schoolsRepository.sql'
export * from './syncApplyRepository.sql'
export * from './syncJournalDecorator'
export * from './syncStateRepository.sql'
