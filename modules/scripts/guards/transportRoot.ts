/**
 * The transport reached for instead of taken.
 *
 * `useApi` builds the one client an application shares. Everything else is
 * handed one: a module of an entity takes it as a parameter, a screen asks
 * `useHttp`, and that injection is the seam a test or a story replaces. A layer
 * that imports `useApi` itself bypasses the seam — the double is ignored and
 * the suite talks to the real client without saying so, which no type and no
 * layer rule can catch, because `shared` is open to every layer by design.
 *
 * So the composition root is the only place allowed to name it: `app/`, and the
 * module that defines it. This is written as a guard rather than as an ESLint
 * rule because it holds for every client application, present and future, and
 * not for one app's layer list.
 */

import { readFileSync } from 'node:fs'

import ts from 'typescript'

import { allSources, lineOf, parseSource, shortPath, walk } from './sources.ts'

const BUILDER = 'useApi'

/** Where building the client is the job rather than a shortcut out of a layer. */
const ALLOWED = [/\/src\/app\//, /\/src\/shared\/api\//]

const reachesForBuilder = (node: ts.Node): boolean => {
  if (!ts.isImportDeclaration(node)) return false

  const bindings = node.importClause?.namedBindings
  if (!bindings || !ts.isNamedImports(bindings)) return false

  return bindings.elements.some(
    (element) => (element.propertyName ?? element.name).text === BUILDER,
  )
}

const reachesIn = (path: string): string[] => {
  const file = parseSource(path, readFileSync(path, 'utf8'))
  const found: string[] = []

  walk(file, (node) => {
    if (!reachesForBuilder(node)) return

    found.push(
      `${shortPath(path)}:${lineOf(file, node.getStart(file))}: reaches for ${BUILDER}. ` +
        'Take the transport as a parameter, or ask useHttp in a screen.',
    )
  })

  return found
}

export const checkTransportRoot = (): string[] =>
  allSources()
    .filter((path) => !ALLOWED.some((allowed) => allowed.test(path)))
    .flatMap(reachesIn)
