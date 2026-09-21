/**
 * Lifecycle lists spelled out by hand outside the domain.
 *
 * Both copies compile, both pass their own tests, and the disagreement surfaces
 * as a row one side allows and the other refuses.
 */

import { readFileSync } from 'node:fs'

import ts from 'typescript'

import {
  allSources,
  domainUnions,
  LIFECYCLE,
  lineOf,
  parseSource,
  shortPath,
  stringMembersOf,
  walk,
} from './sources.ts'

const sameMembers = (left: string[], right: string[]): boolean =>
  left.length === right.length && new Set(left).size === new Set([...left, ...right]).size

const copiesIn = (path: string, unions: Map<string, string[]>): string[] => {
  const file = parseSource(path, readFileSync(path, 'utf8'))
  const found: string[] = []

  walk(file, (node) => {
    if (!ts.isArrayLiteralExpression(node)) return

    const members = stringMembersOf(node)
    if (!members) return

    for (const [name, union] of unions) {
      if (!sameMembers(members, union)) continue
      found.push(
        `${shortPath(path)}:${lineOf(file, node.getStart(file))}: spells out ${name}. Import it.`,
      )
    }
  })

  return found
}

export const checkDomainLiterals = (): string[] => {
  const unions = domainUnions()

  return allSources()
    .filter((path) => path !== LIFECYCLE)
    .flatMap((path) => copiesIn(path, unions))
}
