import type { LessonContent, SectionId } from '@vidya/domain'
import { LessonContentSchemaVersion } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { manualClock } from '@/shared/lib'

import { useAutosave } from '../model'

const doc = (title: string): LessonContent => ({
  schemaVersion: LessonContentSchemaVersion,
  sections: [{ id: 'S' as unknown as SectionId, title, assessment: 'none', blocks: [] }],
})

const titleOf = (content: LessonContent) => content.sections[0].title

/** A save whose every request is settled by hand, so two can be in flight at once. */
const controllable = () => {
  const sent: LessonContent[] = []
  const settle: ((ok: boolean) => void)[] = []

  const save = (content: LessonContent) => {
    sent.push(content)
    return new Promise<boolean>((resolve) => settle.push(resolve))
  }

  return { save, sent, settle }
}

describe('what publishing is told after a save has already failed', () => {
  it('refuses to report success once the document was refused', async () => {
    const clock = manualClock()
    const server = controllable()
    const autosave = useAutosave(server.save, { clock })

    autosave.schedule(doc('One'))
    clock.advance(1_500)
    await flushPromises()
    server.settle[0](false)
    await flushPromises()

    expect(autosave.status.value).toBe('failed')
    expect(await autosave.flush()).toBe(false)
  })

  it('sends nothing new on that flush either, so the refusal is not even retried', async () => {
    const clock = manualClock()
    const server = controllable()
    const autosave = useAutosave(server.save, { clock })

    autosave.schedule(doc('One'))
    clock.advance(1_500)
    await flushPromises()
    server.settle[0](false)
    await flushPromises()

    await autosave.flush()

    expect(server.sent).toHaveLength(1)
  })

  it('offers the refused document again when asked to retry', async () => {
    const clock = manualClock()
    const server = controllable()
    const autosave = useAutosave(server.save, { clock })

    autosave.schedule(doc('One'))
    clock.advance(1_500)
    await flushPromises()
    server.settle[0](false)
    await flushPromises()

    const retried = autosave.retry()
    await flushPromises()
    server.settle[1](true)

    expect(await retried).toBe(true)
    expect(titleOf(server.sent[1])).toBe('One')
  })
})

describe('a failure meeting a queue', () => {
  it('sends the newer document when an older one was refused mid-queue', async () => {
    const clock = manualClock()
    const server = controllable()
    const autosave = useAutosave(server.save, { clock })

    autosave.schedule(doc('One'))
    clock.advance(1_500)
    await flushPromises()

    autosave.schedule(doc('Two'))
    server.settle[0](false)
    await flushPromises()

    expect(server.sent).toHaveLength(2)
    expect(titleOf(server.sent[1])).toBe('Two')

    server.settle[1](true)
    await flushPromises()
    expect(autosave.status.value).toBe('saved')
  })

  it('never lets a flush during a retry put two requests in the air', async () => {
    const clock = manualClock()
    const server = controllable()
    const autosave = useAutosave(server.save, { clock })

    autosave.schedule(doc('One'))
    clock.advance(1_500)
    await flushPromises()
    server.settle[0](false)
    await flushPromises()

    void autosave.retry()
    void autosave.flush()
    void autosave.flush()
    await flushPromises()

    expect(server.sent).toHaveLength(2)
  })

  it('keeps the last edit rather than the last failure when both are pending', async () => {
    const clock = manualClock()
    const server = controllable()
    const autosave = useAutosave(server.save, { clock })

    autosave.schedule(doc('One'))
    clock.advance(1_500)
    await flushPromises()
    server.settle[0](false)
    await flushPromises()

    autosave.schedule(doc('Two'))
    void autosave.retry()
    await flushPromises()
    server.settle[1](true)
    await flushPromises()

    expect(titleOf(server.sent[1])).toBe('Two')
    expect(server.sent).toHaveLength(2)
  })
})

describe('an edit arriving between a request and its answer', () => {
  it('reports neither success nor failure for the document already left behind', async () => {
    const clock = manualClock()
    const server = controllable()
    const autosave = useAutosave(server.save, { clock })

    autosave.schedule(doc('One'))
    clock.advance(1_500)
    await flushPromises()

    autosave.schedule(doc('Two'))
    server.settle[0](true)
    await flushPromises()

    expect(autosave.status.value).toBe('saving')
    expect(titleOf(server.sent[1])).toBe('Two')
  })

  it('answers the flush against the newest document, not the one it started on', async () => {
    const clock = manualClock()
    const server = controllable()
    const autosave = useAutosave(server.save, { clock })

    autosave.schedule(doc('One'))
    const landed = autosave.flush()
    await flushPromises()

    autosave.schedule(doc('Two'))
    server.settle[0](true)
    await flushPromises()
    server.settle[1](false)

    expect(await landed).toBe(false)
  })
})
