import type { BlockSource } from '@vidya/domain'
import type { SelectOption } from '@vidya/ui'

import { AuthorableSources } from '../types'

/**
 * The sources an author may choose from.
 *
 * `upload` is not offered: there is no media storage in v1, so a control that
 * produced an uploaded block would promise something nothing can deliver. It
 * still appears when the stored block already carries it, because silently
 * rewriting somebody's block to `url` on open is worse than showing the truth.
 */
export const sourceOptions = (
  current: BlockSource,
  translate: (key: string) => string,
): SelectOption[] => {
  const values = AuthorableSources.includes(current)
    ? AuthorableSources
    : [current, ...AuthorableSources]

  return values.map((value) => ({ value, label: translate(`editor-source-${value}`) }))
}
