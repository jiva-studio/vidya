import type { LessonContent } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { addMessages, locale } from '@/shared/i18n'
import { refusal } from '@/shared/testing'

import { messages } from '../i18n'
import {
  addSection,
  AWAY_PATH,
  clickText,
  EDITOR_PATH,
  labels,
  LESSON_PATH,
  openEditor,
  plain,
  saveDraft,
  statuses,
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
    expect(statuses(wrapper)).toContain('Draft')
  })

  it('shows the markdown the author typed, not a rendering of it', async () => {
    const { wrapper } = await openEditor(draftAnswers())

    expect(wrapper.text()).toContain('**world**')
    expect(wrapper.html()).not.toContain('<strong>world</strong>')
  })

  it('reports the reason a refusal gave, and keeps it off the screen', async () => {
    const { wrapper, http } = await openEditor({
      [`GET ${VERSIONS}`]: refusal(403, 'User does not have permission'),
    })

    expect(http.failures).toContainEqual({
      key: 'failure-forbidden',
      reason: 'User does not have permission',
    })
    expect(plain(wrapper.text())).not.toContain('User does not have permission')
  })
})

describe('saving', () => {
  it('sends the whole document in one PATCH', async () => {
    const { wrapper, http } = await openEditor(draftAnswers())

    await addSection(wrapper)
    await saveDraft()

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
    await addSection(wrapper)
    await saveDraft()

    const body = http.calls.find((call) => call.method === 'PATCH')?.body as {
      content: LessonContent
    }

    expect(body.content.sections).toHaveLength(1)
  })

  it('reports the reason a refused save gave, and says the draft is not saved', async () => {
    const { wrapper, http } = await openEditor({
      ...draftAnswers(),
      [`PATCH ${VERSIONS}/v1`]: refusal(409, 'Version v1 is published and cannot be edited.'),
    })

    await addSection(wrapper)
    await saveDraft()

    expect(http.failures).toContainEqual({
      key: 'failure-conflict',
      reason: 'Version v1 is published and cannot be edited.',
    })
    expect(plain(wrapper.text())).not.toContain('Version v1 is published')
    expect(statuses(wrapper)).toContain('Not saved')
  })

  it('refuses to save a document it cannot author, and says why', async () => {
    const broken = details('v1', 1, 'draft')
    broken.content.schemaVersion = 99

    const { wrapper, http } = await openEditor({
      ...draftAnswers(),
      [`GET ${VERSIONS}/v1`]: broken,
    })

    expect(plain(wrapper.text())).toContain('This lesson cannot be saved')

    const publish = wrapper.findAll('button').find((node) => plain(node.text()) === 'Publish')
    expect(publish?.attributes('disabled')).toBeDefined()

    await saveDraft()

    expect(http.calls.filter((call) => call.method === 'PATCH')).toHaveLength(0)
  })

  it('sends nothing while a block it cannot show is still in the lesson', async () => {
    const withUnknown = details('v1', 1, 'draft')
    withUnknown.content.sections[0].blocks.push({
      id: 'b2',
      type: 'diagram',
    } as unknown as LessonContent['sections'][number]['blocks'][number])

    const { wrapper, http } = await openEditor({
      ...draftAnswers(),
      [`GET ${VERSIONS}/v1`]: withUnknown,
    })

    // Saving strips what this build did not model, and the stripped block is
    // one a student has already answered against.
    await addSection(wrapper)
    await saveDraft()

    expect(http.calls.filter((call) => call.method === 'PATCH')).toHaveLength(0)
    expect(plain(wrapper.text())).toContain('This lesson cannot be saved')
  })
})

describe('versions', () => {
  it('opens a published version read-only', async () => {
    const { wrapper } = await openEditor({
      [`GET ${VERSIONS}`]: { items: [summary('v1', 1, 'published')] },
      [`GET ${VERSIONS}/v1`]: details('v1', 1, 'published'),
    })

    expect(statuses(wrapper)).toContain('Published')
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
    expect(statuses(wrapper)).toContain('Draft')
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

    await addSection(wrapper)
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

describe('a lesson with nothing in it', () => {
  const empty = () => {
    const details = (id: string, version: number, status: string) => ({
      id,
      lessonId: 'l1',
      version,
      status,
      content: { schemaVersion: 1, sections: [] },
    })

    return {
      ...draftAnswers(),
      [`GET ${VERSIONS}/v1`]: details('v1', 1, 'draft'),
    }
  }

  it('opens with one section holding one empty text block, so there is a line to type in', async () => {
    const { wrapper } = await openEditor(empty())

    const titles = wrapper.element.querySelectorAll('input[aria-label="Section title"]')
    const blocks = wrapper.element.querySelectorAll('[data-block-id]')

    expect(titles).toHaveLength(1)
    expect((titles[0] as HTMLInputElement).value).toBe('')
    expect(blocks).toHaveLength(1)
    expect(plain(wrapper.text())).not.toContain('This lesson is empty')
  })

  it('reaches the server with nothing, because nobody wrote anything', async () => {
    const { http } = await openEditor(empty())

    await saveDraft()

    const writes = http.calls.filter((call) => call.method === 'PATCH')
    const sent = writes.at(0)?.body as { content: LessonContent } | undefined

    expect(sent?.content.sections ?? []).toEqual([])
  })
})


describe('the shape of what was written', () => {
  const written = () => {
    const details = {
      id: 'v1',
      lessonId: 'l1',
      version: 1,
      status: 'draft',
      content: {
        schemaVersion: 1,
        sections: [
          {
            id: 's1',
            title: 'The alphabet',
            assessment: 'none',
            blocks: [
              { id: 'b1', type: 'text', content: '# Letters and sounds\n\nA paragraph under it.' },
            ],
          },
        ],
      },
    }

    return { ...draftAnswers(), [`GET ${VERSIONS}/v1`]: details }
  }

  it('keeps the heading markers the author typed rather than rendering them', async () => {
    const { wrapper } = await openEditor(written())

    const block = wrapper.element.querySelector('[data-block-id="b1"]')

    expect(block?.textContent).toContain('# Letters and sounds')
    expect(block?.querySelector('h1')).toBeNull()
  })

})
