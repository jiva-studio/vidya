/**
 * The lifecycle lists, and the rule that each of them is written once.
 *
 * A status list copied into a second file is the one kind of drift nothing
 * else here catches: both copies compile, both pass their own tests, and the
 * disagreement surfaces as a row the index allows and the service refuses.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

import {
  EnrollmentStatus,
  EnrollmentStatuses,
  GroupStatus,
  GroupStatuses,
  isLive,
  isRecruiting,
  LiveEnrollmentStatuses,
  RECRUITING_GROUP_STATUS,
} from '../lifecycle'

describe('EnrollmentStatuses', () => {
  it('names leaving the course apart from being refused and being taken back', () => {
    expect([...EnrollmentStatuses]).toEqual([
      'pending',
      'accepted',
      'declined',
      'revoked',
      'withdrawn',
    ])
  })

  it('does not carry archiving, which is a field and not an outcome', () => {
    expect(EnrollmentStatuses).not.toContain('archived')
  })
})

describe('LiveEnrollmentStatuses', () => {
  it('holds the states that occupy a place on the course', () => {
    expect([...LiveEnrollmentStatuses]).toEqual(['pending', 'accepted'])
  })

  it('names only states the lifecycle knows', () => {
    for (const status of LiveEnrollmentStatuses) {
      expect(EnrollmentStatuses).toContain(status)
    }
  })

  it('is what isLive answers from, for every status', () => {
    for (const status of EnrollmentStatuses) {
      expect(isLive(status)).toBe((LiveEnrollmentStatuses as readonly string[]).includes(status))
    }
  })

  it('leaves a finished request outside', () => {
    for (const status of ['declined', 'revoked', 'withdrawn'] as EnrollmentStatus[]) {
      expect(isLive(status)).toBe(false)
    }
  })
})

describe('GroupStatuses', () => {
  it('names the three states a group can be in', () => {
    expect([...GroupStatuses]).toEqual(['pending', 'active', 'inactive'])
  })

  it('recruits while it has not started', () => {
    expect(RECRUITING_GROUP_STATUS).toBe('pending')
    expect(GroupStatuses).toContain(RECRUITING_GROUP_STATUS)
  })

  it('is what isRecruiting answers from, for every status', () => {
    for (const status of GroupStatuses) {
      expect(isRecruiting(status)).toBe(status === RECRUITING_GROUP_STATUS)
    }
  })

  it('stops recruiting once the group is running', () => {
    for (const status of ['active', 'inactive'] as GroupStatus[]) {
      expect(isRecruiting(status)).toBe(false)
    }
  })
})

/* -------------------------------------------------------------------------- */

const findModulesRoot = (start: string): string => {
  let curr = start
  while (curr !== '/' && basename(curr) !== 'modules') {
    curr = dirname(curr)
  }
  return curr
}

const MODULES = findModulesRoot(__dirname)

const SKIPPED = new Set(['node_modules', 'dist', 'coverage', '.stryker-tmp', '__tests__'])

const OWNER = join(MODULES, 'libs', 'domain', 'lifecycle.ts')

/** The live list spelled out by hand, in either order the copy might take. */
const COPIES = [
  /\[\s*(['"])pending\1\s*,\s*(['"])accepted\2\s*\]/,
  /\[\s*(['"])accepted\1\s*,\s*(['"])pending\2\s*\]/,
]

const sourcesIn = (directory: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(directory)) {
    if (SKIPPED.has(entry)) continue

    const path = join(directory, entry)
    if (statSync(path).isDirectory()) sourcesIn(path, out)
    else if (/\.(ts|vue)$/.test(entry) && !/\.spec\.ts$/.test(entry)) out.push(path)
  }

  return out
}

describe('the live list has one home', () => {
  it('is spelled out nowhere but in the domain', () => {
    const sources = ['libs', 'apps', 'services'].flatMap((area) => sourcesIn(join(MODULES, area)))

    const copies = sources.filter(
      (path) => path !== OWNER && COPIES.some((copy) => copy.test(readFileSync(path, 'utf8'))),
    )

    expect(copies.map((path) => path.slice(MODULES.length + 1))).toEqual([])
  })
})
