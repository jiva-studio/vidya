/**
 * Human text written into a screen instead of into its bundle.
 *
 * A Russian string in a `.vue` or a `.ts` file reads correctly to whoever adds
 * it and is invisible to every other language: it cannot be translated, it
 * cannot be reviewed beside the rest of the copy, and the English build shows
 * it in Russian. The presets of `model/timeRanges.ts` are the case this was
 * written for — a key in the file, the words in `ru.ftl` and `en.ftl`.
 *
 * Only files an i18n bundle owns are read. A file with no bundle above it has
 * nowhere to put its text: the start-up failure screen is mounted before the
 * catalogue exists and carries its two sentences itself.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { bundleOwning, MODULES, shortPath, sourcesIn } from './sources.ts'

const CYRILLIC = /[Ѐ-ӿ]/

const MOBILE = join(MODULES, 'apps', 'mobile')

const textIn = (path: string): string[] => {
  const bundle = bundleOwning(path)
  if (bundle === undefined) return []

  return readFileSync(path, 'utf8')
    .split('\n')
    .flatMap((line, index) =>
      CYRILLIC.test(line)
        ? [`${shortPath(path)}:${index + 1}: Russian text. It belongs in ${shortPath(bundle)}.`]
        : [],
    )
}

export const checkCyrillicText = (): string[] => sourcesIn(MOBILE).flatMap(textIn)
