import type { LessonContent } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { addMessages, locale } from '@/shared/i18n'
import { refusal } from '@/shared/testing'

import { messages } from '../i18n'
import {
  AWAY_PATH,
  clickText,
  EDITOR_PATH,
  labels,
  LESSON_PATH,
  openEditor,
  plain,
  VERSIONS,
} from './harness'

addMessages(messages)
locale.value = 'en'

const summary = (id: string, version: number, status: string) => ({
  id,
  lessonId: 'l1',
  version,
  status,
})

const content = (): LessonContent =>
  ({
    schemaVersion: 1,
    sections: [
      {
        id: 's1',
        title: 'The alphabet',
        assessment: 'none',
        blocks: [{ id: 'b1', type: 'text', content: 'Hello **world**' }],
      },
    ],
  }) as unknown as LessonContent

const details = (id: string, version: number, status: string) => ({
  ...summary(id, version, status),
  content: content(),
})

const draftAnswers = () => ({
  [`GET ${LESSON_PATH}`]: { id: 'l1', courseId: 'c1', lessonNumber: 1, title: 'The alphabet' },
  [`GET ${VERSIONS}`]: { items: [summary('v1', 1, 'draft')] },
  [`GET ${VERSIONS}/v1`]: details('v1', 1, 'draft'),
  [`PATCH ${VERSIONS}/v1`]: details('v1', 1, 'draft'),
  [`POST ${VERSIONS}/v1/publish`]: summary('v1', 1, 'published'),
})

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('opening a lesson', () => {
  it('opens the draft the lesson was born with and creates no version', async () => {
    const { wrapper, http } = await openEditor(draftAnswers())

    const versionCalls = http.calls
      .filter((call) => call.path.startsWith(VERSIONS))
      .map((call) => `${call.method} ${call.path}`)

    expect(versionCalls).toEqual([`GET ${VERSIONS}`, `GET ${VERSIONS}/v1`])
    expect(plain(wrapper.text())).toContain('Draft v1')
  })

  it('renders the lesson text through the sanitising markdown chain', async () => {
    const { wrapper } = await openEditor(draftAnswers())

    expect(wrapper.html()).toContain('<strong>world</strong>')
  })

  it('shows the reason a refusal gave rather than a generic error', async () => {
    const { wrapper } = await openEditor({
      [`GET ${VERSIONS}`]: refusal(403, 'User does not have permission'),
    })

    expect(plain(wrapper.text())).toContain('No access.')
  })
})

describe('saving', () => {
  it('sends the whole document in one PATCH', async () => {
    const { wrapper, http } = await openEditor(draftAnswers())

    await clickText(wrapper, 'Add section')
    await clickText(wrapper, 'Save draft')

    const writes = http.calls.filter((call) => call.method === 'PATCH')
    expect(writes).toHaveLength(1)
    expect(writes[0].path).toBe(`${VERSIONS}/v1`)

    const body = writes[0].body as { content: LessonContent }
    expect(body.content.schemaVersion).toBe(1)
    expect(body.content.sections[0].id).toBe('s1')
    expect(body.content.sections[0].blocks).toHaveLength(1)
  })

  it('carries nothing of a section the author added and never wrote in', async () => {
    const { wrapper, http } = await openEditor(draftAnswers())

    // An empty lesson opens with a section to type into, so a section nobody
    // touched would otherwise reach the server every time the editor was opened.
    await clickText(wrapper, 'Add section')
    await clickText(wrapper, 'Save draft')

    const body = http.calls.find((call) => call.method === 'PATCH')?.body as {
      content: LessonContent
    }

    expect(body.content.sections).toHaveLength(1)
  })

  it('shows the reason the server gave when the save is refused', async () => {
    const { wrapper } = await openEditor({
      ...draftAnswers(),
      [`PATCH ${VERSIONS}/v1`]: refusal(409, 'Version v1 is published and cannot be edited.'),
    })

    await clickText(wrapper, 'Add section')
    await clickText(wrapper, 'Save draft')

    expect(plain(wrapper.text())).toContain('Version v1 is published and cannot be edited.')
  })

  it('refuses to save a document it cannot author, and says why', async () => {
    const broken = details('v1', 1, 'draft')
    broken.content.schemaVersion = 99

    const { wrapper, http } = await openEditor({
      ...draftAnswers(),
      [`GET ${VERSIONS}/v1`]: broken,
    })

    expect(plain(wrapper.text())).toContain('This lesson cannot be saved')

    const save = wrapper.findAll('button').find((node) => plain(node.text()) === 'Save draft')
    expect(save?.attributes('disabled')).toBeDefined()
    expect(http.calls.filter((call) => call.method === 'PATCH')).toHaveLength(0)
  })
})

describe('versions', () => {
  it('opens a published version read-only', async () => {
    const { wrapper } = await openEditor({
      [`GET ${VERSIONS}`]: { items: [summary('v1', 1, 'published')] },
      [`GET ${VERSIONS}/v1`]: details('v1', 1, 'published'),
    })

    expect(plain(wrapper.text())).toContain('Published v1')
    expect(labels(wrapper)).not.toContain('Save draft')
    expect(labels(wrapper)).not.toContain('Add section')
    expect(labels(wrapper)).toContain('New version')
  })

  it('walks into the draft that is already open when a revision is refused', async () => {
    let opened = false

    const { wrapper, http } = await openEditor({
      [`GET ${VERSIONS}`]: () => ({
        items: opened
          ? [summary('v1', 1, 'published'), summary('v2', 2, 'draft')]
          : [summary('v1', 1, 'published')],
      }),
      [`GET ${VERSIONS}/v1`]: details('v1', 1, 'published'),
      [`GET ${VERSIONS}/v2`]: details('v2', 2, 'draft'),
      [`POST ${VERSIONS}`]: () => {
        opened = true
        throw refusal(409, 'Lesson l1 already has an open draft')
      },
    })

    await clickText(wrapper, 'New version')

    expect(http.calls.map((call) => `${call.method} ${call.path}`)).toContain(`GET ${VERSIONS}/v2`)
    expect(plain(wrapper.text())).toContain('Draft v2')
    expect(plain(wrapper.text())).not.toContain('already has an open draft')
  })

  it('hides publishing from someone without lessons:publish', async () => {
    const { wrapper } = await openEditor(draftAnswers(), ['lessons:read', 'lessons:update'])

    expect(labels(wrapper)).not.toContain('Publish')
  })

  it('offers publishing to someone with it', async () => {
    const { wrapper } = await openEditor(draftAnswers())

    expect(labels(wrapper)).toContain('Publish')
  })
})

describe('leaving with unsaved edits', () => {
  it('asks before navigating away, and stays put until answered', async () => {
    const { wrapper, router } = await openEditor(draftAnswers())

    await clickText(wrapper, 'Add section')
    void router.push(AWAY_PATH)
    await flushPromises()

    expect(plain(document.body.textContent ?? '')).toContain('Leave without saving?')
    expect(router.currentRoute.value.path).toBe(EDITOR_PATH)
  })

  it('does not ask when nothing was edited', async () => {
    const { router } = await openEditor(draftAnswers())

    await router.push(AWAY_PATH)
    await flushPromises()

    expect(router.currentRoute.value.path).toBe(AWAY_PATH)
  })
})
