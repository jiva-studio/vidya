import { Marked } from '@ts-stack/markdown'
import DOMPurify from 'dompurify'

/**
 * Lesson text, as the student will see it.
 *
 * The same two steps in the same order as the mobile app: a preview that
 * rendered differently would be a preview of something else. Sanitising is not
 * decoration — the markdown was typed by someone at the school, and the result
 * of this function is the only string the editor is allowed to hand to `v-html`.
 */
export const renderMarkdown = (markdown: string): string =>
  DOMPurify.sanitize(Marked.parse(markdown))
