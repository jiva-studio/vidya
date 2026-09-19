import type { LessonContent, SectionId } from '@vidya/domain'
import { LessonContentSchemaVersion } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { prunedForSave } from '../model/saving'
import { useLessonContentEditor } from '../model/useLessonContentEditor'

const doc = (title: string): LessonContent => ({
  schemaVersion: LessonContentSchemaVersion,
  sections: [{ id: 'S' as unknown as SectionId, title, assessment: 'none', blocks: [] }],
})

describe('an answer arriving after the editor moved on', () => {
  it('ignores a snapshot this editor never showed', () => {
    const editor = useLessonContentEditor()

    editor.load(doc('First'))
    editor.set(doc('Second'))
    editor.markSaved(doc('Second'))

    expect(editor.dirty.value).toBe(true)
  })

  it('ignores the pruned copy that actually went on the wire', () => {
    const editor = useLessonContentEditor()

    editor.load(doc('First'))
    editor.set(doc('Second'))
    editor.markSaved(prunedForSave(editor.content.value))

    expect(editor.dirty.value).toBe(true)
  })

  it('leaves a version opened mid-flight clean when the old answer lands', () => {
    const editor = useLessonContentEditor()

    editor.load(doc('First'))
    editor.set(doc('Edited'))
    const sent = editor.content.value

    editor.load(doc('Another version'))
    editor.markSaved(sent)

    expect(editor.dirty.value).toBe(false)
  })

  it('keeps the document dirty when the answer belongs to an older edit', () => {
    const editor = useLessonContentEditor()

    editor.load(doc('First'))
    editor.set(doc('Second'))
    const sent = editor.content.value
    editor.set(doc('Third'))

    editor.markSaved(sent)

    expect(editor.dirty.value).toBe(true)
  })

  it('does not call the document clean because an undo returned it to a saved state', () => {
    const editor = useLessonContentEditor()

    editor.load(doc('First'))
    editor.set(doc('Second'))
    const sent = editor.content.value
    editor.undo()

    editor.markSaved(sent)

    expect(editor.dirty.value).toBe(true)
  })
})

describe('history across a reopened version', () => {
  it('carries nothing of the previous version into the new one', () => {
    const editor = useLessonContentEditor()

    editor.load(doc('First'))
    editor.set(doc('Edited'))
    editor.load(doc('Another version'))

    expect(editor.canUndo.value).toBe(false)
    expect(editor.canRedo.value).toBe(false)
    expect(editor.content.value.sections[0].title).toBe('Another version')
  })

  it('leaves no redo behind for a version that was undone before it was replaced', () => {
    const editor = useLessonContentEditor()

    editor.load(doc('First'))
    editor.set(doc('Edited'))
    editor.undo()
    editor.load(doc('Another version'))
    editor.redo()

    expect(editor.content.value.sections[0].title).toBe('Another version')
  })
})
