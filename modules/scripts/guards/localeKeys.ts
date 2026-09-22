/**
 * Locale keys assembled at runtime, checked against the lists they span.
 *
 * `$t(`enrollment-status-${status}`)` names one key per lifecycle state, and
 * nothing in the build knows that. A state added to the domain and forgotten in
 * a bundle reaches the screen as its own identifier.
 *
 * The list is either one of the domain's lifecycles or any other list of names
 * a module declares — a preset, a tab, a menu entry. Both are read where they
 * live, so no name is written down twice.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  allSources,
  bundleOwning,
  domainUnions,
  listMembersOf,
  MODULES,
  shortPath,
} from './sources.ts'

interface DynamicKey {
  prefix: string
  /** The lifecycle list the key spans; absent for a state machine of its own. */
  union?: string
  /** A list elsewhere that names the keys, as `<path>#<export>`. */
  list?: string
  /** Names the screen deliberately never uses. */
  except?: string[]
}

const DYNAMIC_KEYS: DynamicKey[] = [
  { prefix: 'enrollment-status-', union: 'EnrollmentStatuses' },
  { prefix: 'group-members-status-', union: 'EnrollmentStatuses' },
  { prefix: 'homework-status-', union: 'HomeworkStatuses' },
  { prefix: 'group-status-', union: 'GroupStatuses' },
  { prefix: 'lesson-version-status-', union: 'LessonVersionStatuses' },
  { prefix: 'course-learning-type-', union: 'CourseLearningTypes' },

  // A page that only ever renders the states that stop a student, so the
  // accepted one has no text of its own.
  { prefix: 'enrollment-', union: 'EnrollmentStatuses', except: ['accepted'] },

  // Whether the draft is being saved: the editor's own three states.
  { prefix: 'editor-status-' },

  {
    prefix: 'time-preset-',
    list: 'libs/client/usecases/education/timeRanges.ts#TIME_RANGE_PRESETS',
  },
  { prefix: 'weekday-short-', list: 'libs/domain/preferredTimes.ts#Weekdays' },

  // How far a journaled row has travelled: the four states a screen shows.
  {
    prefix: 'submission-',
    list: 'libs/client/usecases/sync/submissions.ts#SubmissionStates',
  },
]

const TEMPLATE_KEY = /`([a-z][a-z0-9]*(?:-[a-z0-9]+)*-)\$\{([^`{}]*)\}([a-z0-9-]*)`/g

const LANGUAGES = ['ru', 'en'] as const

const keysIn = (bundle: string, language: string): Set<string> => {
  const path = join(bundle, `${language}.ftl`)
  if (!existsSync(path)) return new Set()

  const text = readFileSync(path, 'utf8')
  return new Set([...text.matchAll(/^([a-z][\w-]*) *=/gm)].map((match) => match[1]))
}

interface Use {
  path: string
  line: number
  prefix: string
  suffix: string
}

const usesIn = (path: string): Use[] => {
  const text = readFileSync(path, 'utf8')
  const uses: Use[] = []

  for (const match of text.matchAll(TEMPLATE_KEY)) {
    const line = text.slice(0, match.index).split('\n').length
    uses.push({ path, line, prefix: match[1], suffix: match[3] })
  }

  return uses
}

/** The names a key spans, or the reason the guard cannot read them. */
const membersFor = (entry: DynamicKey, unions: Map<string, string[]>): string[] | string => {
  if (entry.union) {
    return unions.get(entry.union) ?? `${entry.union} is not a list in libs/domain/lifecycle.ts.`
  }

  const [path, name] = (entry.list ?? '').split('#')
  return listMembersOf(join(MODULES, path), name ?? '') ?? `${entry.list} is not a list of names.`
}

const missingFor = (use: Use, entry: DynamicKey, union: string[]): string[] => {
  const bundle = bundleOwning(use.path)
  if (!bundle) return [`no i18n bundle owns ${shortPath(use.path)}`]

  const wanted = union.filter((state) => !entry.except?.includes(state))
  const held = LANGUAGES.map((language) => ({ language, keys: keysIn(bundle, language) }))

  return wanted.flatMap((state) => {
    const key = `${use.prefix}${state}${use.suffix}`
    const absent = held.filter(({ keys }) => !keys.has(key)).map(({ language }) => language)
    return absent.length === 0 ? [] : [`${key} — missing in ${absent.join(', ')}`]
  })
}

export const checkLocaleKeys = (): string[] => {
  const unions = domainUnions()
  const failures: string[] = []

  for (const use of allSources(['apps']).flatMap(usesIn)) {
    const entry = DYNAMIC_KEYS.find((candidate) => candidate.prefix === use.prefix)
    const where = `${shortPath(use.path)}:${use.line}`

    if (!entry) {
      if (/(^|-)status(es)?-$/.test(use.prefix)) {
        failures.push(`${where}: \`${use.prefix}\${…}\` names states nothing checks.`)
        failures.push(`  Add it to DYNAMIC_KEYS in scripts/guards/localeKeys.ts.`)
      }
      continue
    }

    if (!entry.union && !entry.list) continue

    const members = membersFor(entry, unions)
    if (typeof members === 'string') {
      failures.push(`${where}: ${members}`)
      continue
    }

    for (const missing of missingFor(use, entry, members)) failures.push(`${where}: ${missing}`)
  }

  return failures
}
