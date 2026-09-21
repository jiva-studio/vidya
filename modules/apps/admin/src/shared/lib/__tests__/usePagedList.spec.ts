import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import type { PagedAnswer } from '../usePagedList'
import { PAGE_SIZE, usePagedList } from '../usePagedList'

interface Row {
  id: string
}

const deferred = <T>() => {
  let settle: (value: T) => void = () => {}
  const promise = new Promise<T>((resolve) => {
    settle = resolve
  })
  return { promise, settle }
}

describe('usePagedList', () => {
  it('redraws a screen reading the rows through the cast', async () => {
    const list = usePagedList<Row>({
      read: () => Promise.resolve({ items: [{ id: 'a' }, { id: 'b' }], total: 2 }),
    })

    const screen = mount(
      defineComponent({
        setup: () => () =>
          h(
            'ul',
            list.rows.value.map((row) => h('li', row.id)),
          ),
      }),
    )

    expect(screen.findAll('li')).toHaveLength(0)

    await list.load()
    await nextTick()

    expect(screen.findAll('li').map((item) => item.text())).toEqual(['a', 'b'])
  })

  it('asks for the page the reader is on', async () => {
    const asked: { limit: number; offset: number }[] = []
    const list = usePagedList<Row>({
      read: (page) => {
        asked.push(page)
        return Promise.resolve({ items: [], total: 100 })
      },
    })

    list.goTo(3)
    await Promise.resolve()

    expect(asked).toEqual([{ limit: PAGE_SIZE, offset: 2 * PAGE_SIZE }])
    expect(list.pages.value).toBe(4)
    expect(list.paged.value).toBe(true)
  })

  it('drops an answer overtaken by a later one, and still stops loading', async () => {
    const answers = [deferred<PagedAnswer<Row>>(), deferred<PagedAnswer<Row>>()]
    let served = 0

    const list = usePagedList<Row>({ read: () => answers[served++].promise })

    const first = list.load()
    const second = list.load()

    answers[1].settle({ items: [{ id: 'second' }], total: 1 })
    answers[0].settle({ items: [{ id: 'first' }], total: 1 })
    await Promise.all([first, second])

    expect(list.rows.value.map((row) => row.id)).toEqual(['second'])
    expect(list.loading.value).toBe(false)
  })

  it('starts again at the first page', async () => {
    const offsets: number[] = []
    const list = usePagedList<Row>({
      read: (page) => {
        offsets.push(page.offset)
        return Promise.resolve({ items: [], total: 100 })
      },
    })

    list.goTo(4)
    await Promise.resolve()
    list.restart()
    await Promise.resolve()

    expect(list.page.value).toBe(1)
    expect(offsets).toEqual([3 * PAGE_SIZE, 0])
  })
})
