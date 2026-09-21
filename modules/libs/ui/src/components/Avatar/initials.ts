/**
 * The letters shown when there is no picture.
 *
 * Two at most: a third stops being legible at `--control-sm`. One word gives
 * its first two letters rather than one, which tells `Ann` from `Amy`.
 */
export const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) return '?'
  if (parts.length === 1) return [...parts[0]].slice(0, 2).join('')

  return `${firstCharacterOf(parts[0])}${firstCharacterOf(parts[parts.length - 1])}`
}

// Indexing a string cuts a surrogate pair in half and yields a lone half.
const firstCharacterOf = (word: string): string => [...word][0] ?? ''
