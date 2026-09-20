import type { BlockId, LessonContent, SectionId } from '@vidya/domain'
import { emptyLessonContent, LessonContentSchemaVersion } from '@vidya/domain'
import { describe, expect, it, vi } from 'vitest'

import { useLessonContentEditor } from '../model'

const id = <TId>(value: string) => value as unknown as TId

const doc = (...titles: string[]): LessonContent => ({
  schemaVersion: LessonContentSchemaVersion,
  sections: titles.map((title, at) => ({
    id: id<SectionId>(`s${at}`),
    title,
    assessment: 'none' as const,
    blocks: [{ id: id<BlockId>(`b${at}`), type: 'text' as const, content: title }],
  })),
})

const titles = (content: LessonContent) => content.sections.map((section) => section.title)

describe('what the editor holds', () => {
  it('starts on an empty document that owes the server nothing', () => {
    const editor = useLessonContentEditor()

    expect(editor.content.value).toEqual(emptyLessonContent())
    expect(editor.dirty.value).toBe(false)
  })

  it('goes dirty on an edit and clean again when that very document is saved', () => {
    const editor = useLessonContentEditor()

    editor.set(doc('One'))
    expect(editor.dirty.value).toBe(true)

    editor.markSaved(editor.content.value)
    expect(editor.dirty.value).toBe(false)
  })

  it('stays dirty when the author typed while the save was in flight', () => {
    const editor = useLessonContentEditor()

    editor.set(doc('One'))
    const sent = editor.content.value
    editor.set(doc('One more'))

    editor.markSaved(sent)

    expect(editor.dirty.value).toBe(true)
    expect(titles(editor.content.value)).toEqual(['One more'])
  })

  it('takes a document from the server as the new clean starting point', () => {
    const editor = useLessonContentEditor()

    editor.load(doc('From the server'))

    expect(editor.dirty.value).toBe(false)
    expect(titles(editor.content.value)).toEqual(['From the server'])
  })

  it('counts an edit instead of serialising the document to notice one', () => {
    const editor = useLessonContentEditor()
    editor.load(doc('One', 'Two', 'Three'))

    const serialise = vi.spyOn(JSON, 'stringify')
    editor.set(doc('One', 'Two', 'Edited'))

    const before = editor.revision.value
    expect(editor.dirty.value).toBe(true)
    editor.set(doc('One', 'Two', 'Edited again'))
    expect(editor.dirty.value).toBe(true)

    expect(editor.revision.value).toBeGreaterThan(before)
    expect(serialise).not.toHaveBeenCalled()

    serialise.mockRestore()
  })
})

describe('undoing', () => {
  it('restores the document as it was before the last edit', () => {
    const editor = useLessonContentEditor()
    editor.load(doc('One'))
    editor.set(doc('One', 'Two'))

    editor.undo()

    expect(titles(editor.content.value)).toEqual(['One'])
  })

  it('brings back a deleted section with every block it held', () => {
    const editor = useLessonContentEditor()
    editor.load(doc('One', 'Two'))
    editor.set(doc('One'))

    editor.undo()

    expect(titles(editor.content.value)).toEqual(['One', 'Two'])
    expect(editor.content.value.sections[1].blocks).toHaveLength(1)
  })

  it('redoes what it undid', () => {
    const editor = useLessonContentEditor()
    editor.load(doc('One'))
    editor.set(doc('One', 'Two'))

    editor.undo()
    editor.redo()

    expect(titles(editor.content.value)).toEqual(['One', 'Two'])
  })

  it('drops the redone future as soon as something else is written', () => {
    const editor = useLessonContentEditor()
    editor.load(doc('One'))
    editor.set(doc('One', 'Two'))

    editor.undo()
    editor.set(doc('One', 'Another'))

    expect(editor.canRedo.value).toBe(false)
    editor.redo()
    expect(titles(editor.content.value)).toEqual(['One', 'Another'])
  })

  it('does nothing at either end of the history', () => {
    const editor = useLessonContentEditor()
    editor.load(doc('One'))

    expect(editor.canUndo.value).toBe(false)
    editor.undo()
    expect(titles(editor.content.value)).toEqual(['One'])

    editor.redo()
    expect(titles(editor.content.value)).toEqual(['One'])
  })

  it('remembers fifty steps and forgets the oldest', () => {
    const editor = useLessonContentEditor()
    editor.load(doc('step 0'))

    for (let step = 1; step <= 60; step += 1) editor.set(doc(`step ${step}`))

    for (let step = 0; step < 60; step += 1) editor.undo()

    expect(titles(editor.content.value)).toEqual(['step 10'])
    expect(editor.canUndo.value).toBe(false)
  })

  it('forgets one version when another is opened, so undo cannot cross between them', () => {
    const editor = useLessonContentEditor()
    editor.load(doc('First version'))
    editor.set(doc('First version', 'Edited'))

    editor.load(doc('Second version'))

    expect(editor.canUndo.value).toBe(false)
    editor.undo()
    expect(titles(editor.content.value)).toEqual(['Second version'])
  })

  it('leaves the document dirty after an undo that walked away from what was saved', () => {
    const editor = useLessonContentEditor()
    editor.load(doc('One'))
    editor.set(doc('One', 'Two'))
    editor.markSaved(editor.content.value)

    editor.undo()

    expect(editor.dirty.value).toBe(true)
  })
})
