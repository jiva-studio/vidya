/**
 * Reading the workspace the way the guards need it.
 *
 * A `.vue` file is parsed by blanking everything outside its script blocks, so
 * the offsets a TypeScript node reports are still the offsets of the real file
 * and a finding can name a line the reader can open.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'

import ts from 'typescript'

export const MODULES = join(import.meta.dirname, '..', '..')

export const AREAS = ['libs', 'apps', 'services']

export const LIFECYCLE = join(MODULES, 'libs', 'domain', 'lifecycle.ts')

const SKIPPED = new Set([
  'node_modules',
  'dist',
  'coverage',
  'storybook-static',
  '.stryker-tmp',
  '.git',
  '__tests__',
  'android',
  'ios',
])

export const sourcesIn = (directory: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(directory)) {
    if (SKIPPED.has(entry)) continue

    const path = join(directory, entry)
    if (statSync(path).isDirectory()) sourcesIn(path, out)
    else if (/\.(ts|vue)$/.test(entry) && !/\.spec\.ts$/.test(entry)) out.push(path)
  }

  return out
}

export const allSources = (areas: string[] = AREAS): string[] =>
  areas.flatMap((area) => sourcesIn(join(MODULES, area)))

export const shortPath = (path: string): string => path.slice(MODULES.length + 1)

/** The i18n bundle a file belongs to — the nearest one above it, if any. */
export const bundleOwning = (path: string): string | undefined => {
  let directory = dirname(path)

  while (directory.startsWith(MODULES)) {
    if (existsSync(join(directory, 'i18n', 'en.ftl'))) return join(directory, 'i18n')
    directory = dirname(directory)
  }

  return undefined
}

const blanked = (text: string): string => text.replace(/[^\n]/g, ' ')

export const scriptOf = (path: string, text: string): string => {
  if (!path.endsWith('.vue')) return text

  let out = ''
  let cursor = 0

  for (const block of text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) {
    const start = (block.index ?? 0) + block[0].indexOf('>') + 1
    out += blanked(text.slice(cursor, start)) + block[1]
    cursor = start + block[1].length
  }

  return out + blanked(text.slice(cursor))
}

export const parseSource = (path: string, text: string): ts.SourceFile =>
  ts.createSourceFile(path, scriptOf(path, text), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

export const lineOf = (file: ts.SourceFile, position: number): number =>
  file.getLineAndCharacterOfPosition(position).line + 1

export const walk = (node: ts.Node, visit: (node: ts.Node) => void): void => {
  visit(node)
  node.forEachChild((child) => walk(child, visit))
}

const arrayOf = (node?: ts.Node): ts.ArrayLiteralExpression | undefined => {
  let value = node
  while (value && ts.isAsExpression(value)) value = value.expression
  if (!value || !ts.isArrayLiteralExpression(value) || value.elements.length === 0) return undefined

  return value
}

/** The members of `['a', 'b']`, with or without a trailing `as const`. */
export const stringMembersOf = (node?: ts.Node): string[] | undefined => {
  const value = arrayOf(node)
  if (!value) return undefined

  const members: string[] = []
  for (const element of value.elements) {
    if (!ts.isStringLiteral(element)) return undefined
    members.push(element.text)
  }

  return members
}

const propertyOf = (element: ts.ObjectLiteralElementLike, name: string): boolean =>
  element.name !== undefined && ts.isIdentifier(element.name) && element.name.text === name

/** The `key` of every member of `[{ key: 'a', … }, { key: 'b', … }]`. */
const keyMembersOf = (node?: ts.Node): string[] | undefined => {
  const value = arrayOf(node)
  if (!value) return undefined

  const members: string[] = []
  for (const element of value.elements) {
    if (!ts.isObjectLiteralExpression(element)) return undefined

    const key = element.properties.find((property) => propertyOf(property, 'key'))
    if (!key || !ts.isPropertyAssignment(key) || !ts.isStringLiteral(key.initializer))
      return undefined
    members.push(key.initializer.text)
  }

  return members
}

/**
 * The names a list holds, read from the module that declares it.
 *
 * Either the list is of strings, or every member carries a `key` — both shapes
 * are a set of names a screen turns into one locale key each.
 */
export const listMembersOf = (path: string, name: string): string[] | undefined => {
  if (!existsSync(path)) return undefined

  const file = parseSource(path, readFileSync(path, 'utf8'))

  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== name) continue
      return stringMembersOf(declaration.initializer) ?? keyMembersOf(declaration.initializer)
    }
  }

  return undefined
}

/** The lifecycle lists, read from their one home rather than imported. */
export const domainUnions = (): Map<string, string[]> => {
  const file = parseSource(LIFECYCLE, readFileSync(LIFECYCLE, 'utf8'))
  const unions = new Map<string, string[]>()

  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue

    for (const declaration of statement.declarationList.declarations) {
      const members = stringMembersOf(declaration.initializer)
      if (members && ts.isIdentifier(declaration.name)) unions.set(declaration.name.text, members)
    }
  }

  return unions
}
