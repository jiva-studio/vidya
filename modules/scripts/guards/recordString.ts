/**
 * `Record<string, …>` in a screen that already knows the lifecycle list.
 *
 * A map keyed by `string` accepts every state and demands none, so a state
 * added to the domain falls through to whatever the lookup returns for a key it
 * does not hold.
 */

import { readFileSync } from 'node:fs'

import ts from 'typescript'

import { allSources, lineOf, parseSource, shortPath, walk } from './sources.ts'

const DOMAIN_PACKAGE = '@vidya/domain'

const STATUS_TYPES: Record<string, string> = {
  EnrollmentStatus: 'EnrollmentStatus',
  EnrollmentStatuses: 'EnrollmentStatus',
  GroupStatus: 'GroupStatus',
  GroupStatuses: 'GroupStatus',
  HomeworkStatus: 'HomeworkStatus',
  HomeworkStatuses: 'HomeworkStatus',
  LessonVersionStatus: 'LessonVersionStatus',
  LessonVersionStatuses: 'LessonVersionStatus',
  CourseLearningType: 'CourseLearningType',
  CourseLearningTypes: 'CourseLearningType',
}

const statusImportOf = (file: ts.SourceFile): string | undefined => {
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue
    if (statement.moduleSpecifier.text !== DOMAIN_PACKAGE) continue

    const bindings = statement.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue

    for (const element of bindings.elements) {
      const named = STATUS_TYPES[element.name.text]
      if (named) return named
    }
  }

  return undefined
}

// `Record<string, unknown>` is a bag whose keys are not known at all — a JSON
// column, a query string. What this looks for is a lookup table: a value type
// that names something, keyed by a string that names nothing.
const BAGS = new Set([ts.SyntaxKind.UnknownKeyword, ts.SyntaxKind.AnyKeyword])

const isStringKeyedTable = (node: ts.Node): node is ts.TypeReferenceNode =>
  ts.isTypeReferenceNode(node) &&
  ts.isIdentifier(node.typeName) &&
  node.typeName.text === 'Record' &&
  node.typeArguments?.[0]?.kind === ts.SyntaxKind.StringKeyword &&
  !BAGS.has(node.typeArguments[1]?.kind)

const bagsIn = (path: string): string[] => {
  const file = parseSource(path, readFileSync(path, 'utf8'))
  const named = statusImportOf(file)
  if (!named) return []

  const found: string[] = []

  walk(file, (node) => {
    if (!isStringKeyedTable(node)) return
    found.push(
      `${shortPath(path)}:${lineOf(file, node.getStart(file))}: Record<string, …> beside ${named}. ` +
        `Write Record<${named}, …>, so a new state stops the build here.`,
    )
  })

  return found
}

export const checkRecordString = (): string[] => allSources(['apps']).flatMap(bagsIn)
