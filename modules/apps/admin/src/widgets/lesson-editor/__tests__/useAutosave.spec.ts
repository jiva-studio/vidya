import type { LessonContent, SectionId } from '@vidya/domain'
import { LessonContentSchemaVersion } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

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

describe('when a save is sent', () => {
  it('waits for the author to stop writing', async () => {
    const clock = manualClock()
    const server = controllable()
    const autosave = useAutosave(server.save, { clock })

    autosave.schedule(doc('One'))
    clock.advance(1_400)
    expect(server.sent).toHaveLength(0)

    clock.advance(100)
    await flushPromises()
    expect(server.sent).toHaveLength(1)
  })

  it('sends the last state once, however many edits arrived in the meantime', async () => {
    const clock = manualClock()
    const server = controllable()
    const autosave = useAutosave(server.save, { clock })

    autosave.schedule(doc('One'))
    clock.advance(1_000)
    autosave.schedule(doc('Two'))
    clock.advance(1_000)
    autosave.schedule(doc('Three'))
    clock.advance(1_500)
    await flushPromises()

    expect(server.sent).toHaveLength(1)
    expect(titleOf(server.sent[0])).toBe('Three')
  })

  it('leaves no timer behind once the pending save has been superseded', () => {
    const clock = manualClock()
    const server = controllable()
    const autosave = useAutosave(server.save, { clock })

    autosave.schedule(doc('One'))
    autosave.schedule(doc('Two'))

    expect(clock.pending).toBe(1)
  })

  it('never runs two saves at once', async () => {
    const clock = manualClock()
    const server = controllable()
    const autosave = useAutosave(server.save, { clock })

    autosave.schedule(doc('One'))
    clock.advance(1_500)
    await flushPromises()

    autosave.schedule(doc('Two'))
    clock.advance(1_500)
    await flushPromises()

    expect(server.sent).toHaveLength(1)

    server.settle[0](true)
    await flushPromises()

    expect(server.sent).toHaveLength(2)
    expect(titleOf(server.sent[1])).toBe('Two')
  })

  it('ignores the answer to a save that a later one has already replaced', async () => {
    const clock = manualClock()
    const server = controllable()
    const autosave = useAutosave(server.save, { clock })

    autosave.schedule(doc('One'))
    clock.advance(1_500)
    await flushPromises()

    autosave.schedule(doc('Two'))
    clock.advance(1_500)
    await flushPromises()

    server.settle[0](false)
    await flushPromises()

    expect(autosave.status.value).not.toBe('failed')

    server.settle[1](true)
    await flushPromises()

    expect(autosave.status.value).toBe('saved')
  })
})

describe('what the toolbar is told', () => {
  it('says nothing before anything has been written', () => {
    const clock = manualClock()
    const autosave = useAutosave(controllable().save, { clock })

    expect(autosave.status.value).toBe('idle')
  })

  it('reports the save while it is in flight and once it lands', async () => {
    const clock = manualClock()
    const server = controllable()
    const autosave = useAutosave(server.save, { clock })

    autosave.schedule(doc('One'))
    clock.advance(1_500)
    await flushPromises()
    expect(autosave.status.value).toBe('saving')

    server.settle[0](true)
    await flushPromises()
    expect(autosave.status.value).toBe('saved')
  })

  it('reports a refusal and offers the same document again', async () => {
    const clock = manualClock()
    const server = controllable()
    const autosave = useAutosave(server.save, { clock })

    autosave.schedule(doc('One'))
    clock.advance(1_500)
    await flushPromises()
    server.settle[0](false)
    await flushPromises()

    expect(autosave.status.value).toBe('failed')

    void autosave.retry()
    await flushPromises()

    expect(server.sent).toHaveLength(2)
    expect(titleOf(server.sent[1])).toBe('One')
  })
})

describe('asking for a save by hand', () => {
  it('sends straight away rather than waiting out the debounce', async () => {
    const clock = manualClock()
    const server = controllable()
    const autosave = useAutosave(server.save, { clock })

    autosave.schedule(doc('One'))
    void autosave.flush()
    await flushPromises()

    expect(server.sent).toHaveLength(1)
    expect(clock.pending).toBe(0)
  })

  it('answers whether the document reached the server, so publishing can stop', async () => {
    const clock = manualClock()
    const server = controllable()
    const autosave = useAutosave(server.save, { clock })

    autosave.schedule(doc('One'))
    const landed = autosave.flush()
    await flushPromises()
    server.settle[0](false)

    expect(await landed).toBe(false)
  })

  it('has nothing to send when nothing is waiting', async () => {
    const clock = manualClock()
    const server = controllable()
    const autosave = useAutosave(server.save, { clock })

    expect(await autosave.flush()).toBe(true)
    expect(server.sent).toHaveLength(0)
  })
})

describe('the timers it is allowed to own', () => {
  it('schedules through the clock it was given and never through the environment', () => {
    const clock = manualClock()
    const server = controllable()
    const timer = vi.spyOn(globalThis, 'setTimeout')

    useAutosave(server.save, { clock }).schedule(doc('One'))

    expect(clock.pending).toBe(1)
    expect(timer).not.toHaveBeenCalled()

    timer.mockRestore()
  })
})
