import { InlineLexer, Marked } from '@ts-stack/markdown'
import DOMPurify, { type Config } from 'dompurify'

// A single newline is a line break, as the author typed it. Markdown's rule
// that two are needed comes from typesetting prose, and a lesson is written by
// someone watching the screen rather than setting a page.
Marked.setOptions({ breaks: true })

const SANITIZE_OPTIONS: Config = {
  USE_PROFILES: { html: true },
}

/**
 * Lesson text, as the student will see it.
 *
 * The same two steps in the same order as the mobile app: a preview that
 * rendered differently would be a preview of something else. Sanitising is not
 * decoration — the markdown was typed by someone at the school, and the result
 * of this function is the only string the editor is allowed to hand to `v-html`.
 */
export const renderMarkdown = (markdown: string): string =>
  DOMPurify.sanitize(Marked.parse(markdown), SANITIZE_OPTIONS) as string

/**
 * One line of markdown, for a place that already has its own element.
 *
 * A question, a caption and an option are single lines of text inside a control
 * of their own, so the block grammar never runs: `# heading` there is the two
 * characters the author typed, not a page title inside a form field.
 */
export const renderInlineMarkdown = (markdown: string): string =>
  DOMPurify.sanitize(InlineLexer.output(markdown, {}, Marked.options), SANITIZE_OPTIONS) as string
