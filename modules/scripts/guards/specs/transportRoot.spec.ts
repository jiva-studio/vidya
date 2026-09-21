/**
 * The guard, run against a file planted in a layer that may not reach for the
 * transport. Nothing here mocks the walk: the guard reads the workspace, so a
 * case is a real file in a real forbidden layer, removed again whatever happens.
 */

import assert from 'node:assert/strict'
import { rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { MODULES } from '../sources.ts'
import { checkTransportRoot } from '../transportRoot.ts'

/** A layer of the admin that is handed its transport and must never build one. */
const FORBIDDEN = join(MODULES, 'apps', 'admin', 'src', 'entities', 'media', 'model')

const findingsFor = (name: string, source: string): string[] => {
  const path = join(FORBIDDEN, name)
  writeFileSync(path, source, 'utf8')

  try {
    return checkTransportRoot().filter((finding) => finding.includes(name))
  } finally {
    rmSync(path, { force: true })
  }
}

test('catches the builder imported by name', () => {
  const found = findingsFor(
    'guardProbeNamed.ts',
    "import { useApi } from '@/shared/api'\n\nexport const build = () => useApi()\n",
  )

  assert.equal(found.length, 1)
})

test('catches the builder reached through a namespace import', () => {
  const found = findingsFor(
    'guardProbeNamespace.ts',
    "import * as transport from '@/shared/api'\n\nexport const build = () => transport.useApi()\n",
  )

  assert.equal(found.length, 1)
})

test('catches the builder passed on by a re-export', () => {
  const found = findingsFor('guardProbeReexport.ts', "export { useApi } from '@/shared/api'\n")

  assert.equal(found.length, 1)
})

test('catches the builder taken from a dynamic import', () => {
  const found = findingsFor(
    'guardProbeDynamic.ts',
    "export const build = async () => {\n  const { useApi } = await import('@/shared/api')\n  return useApi()\n}\n",
  )

  assert.equal(found.length, 1)
})

test('catches the builder required through the module loader', () => {
  const found = findingsFor(
    'guardProbeRequire.ts',
    "import { createRequire } from 'node:module'\n\n" +
      "export const build = () => createRequire(import.meta.url)('@/shared/api').useApi()\n",
  )

  assert.equal(found.length, 1)
})

test('catches a test reaching for the builder, which is what it was written for', () => {
  const found = findingsFor(
    'guardProbeSuite.spec.ts',
    "import { useApi } from '@/shared/api'\n\nconst client = useApi()\nexport default client\n",
  )

  assert.equal(found.length, 1)
})
