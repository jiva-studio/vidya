/**
 * No trace of the tool that produced a change.
 *
 * Read the working tree, the diff against `main` and the branch's commit
 * messages, because a footer can be introduced in any of the three.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { MODULES } from './sources.ts'

const ROOT = join(MODULES, '..')

const SIGNS: { name: string; pattern: RegExp }[] = [
  { name: 'assistant name', pattern: /\b(claude|anthropic)\b/i },
  { name: 'co-author trailer', pattern: /co-authored-by\s*:/i },
  { name: 'generation footer', pattern: /\bgenerated\s+(with|by)\b/i },
  { name: 'session link', pattern: /session_[A-Za-z0-9]{8,}|\bclaude-session\b/i },
]

/** Files whose subject is the rule itself, and which therefore name the signs. */
const QUOTING_THE_RULE = [
  'AGENTS.md',
  'CLAUDE.md',
  '.agents/',
  'modules/scripts/guards/attribution.ts',
]

const TEXT = /\.(ts|tsx|js|cjs|mjs|vue|json|md|ya?ml|sql|ftl|html|css|sh)$/

const git = (args: string[]): string =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

const isQuotingTheRule = (path: string): boolean =>
  QUOTING_THE_RULE.some((allowed) => path === allowed || path.startsWith(allowed))

const signsIn = (text: string, where: string, lineOffset = 0): string[] => {
  const found: string[] = []

  text.split('\n').forEach((line, index) => {
    for (const sign of SIGNS) {
      if (sign.pattern.test(line)) found.push(`${where}:${index + 1 + lineOffset}: ${sign.name}`)
    }
  })

  return found
}

const checkWorkingTree = (): string[] => {
  const listed = [
    ...git(['ls-files']).split('\n'),
    ...git(['ls-files', '--others', '--exclude-standard']).split('\n'),
  ]

  return listed
    .filter((path) => path && TEXT.test(path) && !isQuotingTheRule(path))
    .filter((path) => existsSync(join(ROOT, path)) && statSync(join(ROOT, path)).isFile())
    .flatMap((path) => signsIn(readFileSync(join(ROOT, path), 'utf8'), path))
}

const addedLinesOf = (diff: string): { path: string; text: string }[] => {
  const added: { path: string; text: string }[] = []
  let path = ''

  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ b/')) path = line.slice(6)
    else if (line.startsWith('+') && !line.startsWith('+++')) added.push({ path, text: line })
  }

  return added
}

const checkDiff = (base: string): string[] =>
  addedLinesOf(git(['diff', base]))
    .filter((added) => !isQuotingTheRule(added.path))
    .flatMap((added) =>
      SIGNS.filter((sign) => sign.pattern.test(added.text)).map(
        (sign) => `${added.path}: ${sign.name} in an added line: ${added.text.trim()}`,
      ),
    )

/**
 * The commits this branch added, and no others.
 *
 * Everything reachable from an upstream ref is excluded by name rather than by
 * a single merge base: a branch that merged `main` back into itself carries
 * upstream commits in its history, and their messages are not its to answer
 * for.
 */
const checkMessages = (upstream: string[]): string[] =>
  git(['log', 'HEAD', '--not', ...upstream, '--no-merges', '--format=%H%n%B%n--'])
    .split('\n--\n')
    .flatMap((message) => signsIn(message, `commit ${message.trim().slice(0, 12)}`))

/**
 * The commit this branch grew from, or nothing when it cannot be named.
 *
 * CI clones shallowly and without local branches, so `main` is often not a ref
 * there at all. The commits and the diff are then out of reach, and the check
 * reads the working tree alone rather than failing the build over a ref.
 */
const upstreamRefs = (): string[] =>
  ['origin/main', 'main'].filter((ref) => {
    try {
      execFileSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], {
        cwd: ROOT,
        stdio: 'ignore',
      })
      return true
    } catch {
      return false
    }
  })

const branchPoint = (refs: string[]): string | null => {
  for (const ref of refs) {
    try {
      return execFileSync('git', ['merge-base', ref, 'HEAD'], {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()
    } catch {
      continue
    }
  }

  return null
}

export const checkAttribution = (): string[] => {
  const upstream = upstreamRefs()
  const base = branchPoint(upstream)
  if (base === null) return checkWorkingTree()

  return [...checkWorkingTree(), ...checkDiff(base), ...checkMessages(upstream)]
}
