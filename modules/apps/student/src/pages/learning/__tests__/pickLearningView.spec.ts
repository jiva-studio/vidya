import { describe, expect, it } from 'vitest'

import { pickLearningView } from '../model'

/**
 * The two empty screens are not the same screen.
 *
 * "Nobody has invited you anywhere" is the end of the road; "your courses have
 * not arrived yet" is half a minute of waiting. Both look like an empty
 * database, and telling a student the first while the second is true says
 * their school is gone.
 */
describe('what the learning screen has to say when it has nothing', () => {
  it('shows the schools once there are any', () => {
    expect(pickLearningView({ schools: 1, filled: true, joined: false })).toBe('schools')
  })

  it('waits rather than concluding anything before a run has finished', () => {
    expect(pickLearningView({ schools: 0, filled: false, joined: false })).toBe('arriving')
  })

  it('says nobody invited them only once a run has finished and found nothing', () => {
    expect(pickLearningView({ schools: 0, filled: true, joined: false })).toBe('uninvited')
  })

  it('never says that to somebody who has just joined a school', () => {
    expect(pickLearningView({ schools: 0, filled: true, joined: true })).toBe('arriving')
  })

  it('prefers what is on the machine to what a run has said about it', () => {
    expect(pickLearningView({ schools: 2, filled: false, joined: true })).toBe('schools')
  })
})
