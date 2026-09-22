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
 *
 * The name is what is looked for, wherever it is written: an import binds it,
 * but so do a namespace, a re-export, a dynamic import and the module loader,
 * and a guard that read import statements alone would pass all four. The suites
 * are read as well — a test reaching past the seam is the case this exists for.
 */

import { readFileSync } from 'node:fs'

import ts from 'typescript'

import { allSources, AREAS, lineOf, parseSource, shortPath, walk } from './sources.ts'

const BUILDER = 'useApi'

/** Where building the client is the job rather than a shortcut out of a layer. */
const ALLOWED = [/\/src\/app\//, /\/src\/shared\/api\//]

const namesBuilder = (node: ts.Node): boolean => ts.isIdentifier(node) && node.text === BUILDER

/** One finding per file: a layer either reaches for the builder or it does not. */
const reachesIn = (path: string): string[] => {
  const file = parseSource(path, readFileSync(path, 'utf8'))
  let at: number | undefined

  walk(file, (node) => {
    if (at === undefined && namesBuilder(node)) at = node.getStart(file)
  })

  if (at === undefined) return []

  return [
    `${shortPath(path)}:${lineOf(file, at)}: reaches for ${BUILDER}. ` +
      'Take the transport as a parameter, or ask useHttp in a screen.',
  ]
}

export const checkTransportRoot = (): string[] =>
  allSources(AREAS, { tests: true })
    .filter((path) => !ALLOWED.some((allowed) => allowed.test(path)))
    .flatMap(reachesIn)
