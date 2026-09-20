// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, type Ref, ref } from 'vue'

const engine = vi.hoisted(() => ({}) as { syncing: Ref<boolean> })

vi.mock('@/app', async () => {
  const { ref } = await import('vue')
  engine.syncing = ref(false)

  return { useSyncStatus: () => ({ syncing: engine.syncing }) }
})

// The page lifecycle Ionic adds needs a page to be alive; the composable is
// being examined on its own here, so the hook is a no-op.
vi.mock('@ionic/vue', () => ({ onIonViewWillEnter: () => undefined }))

import { useLocalData } from '../useLocalData'

/** Lets the reads a mount starts settle before the result is inspected. */
const settle = async (): Promise<void> => {
  for (let turn = 0; turn < 5; turn += 1) await Promise.resolve()
}

function mountReader<T>(
  load: () => Promise<T>,
  initial: T,
  options: Parameters<typeof useLocalData<T>>[2] = {},
) {
  const seen = { data: { value: initial } } as { data: Ref<T> }

  const Host = defineComponent({
    setup() {
      const state = useLocalData(load, initial, options)
      seen.data = state.data

      return () => h('div')
    },
  })

  return { wrapper: mount(Host), seen }
}

beforeEach(() => {
  engine.syncing.value = false
})

/**
 * A screen reads the device, and the device changes under it.
 *
 * Which moment it re-reads at is the whole of the value: a run that has only
 * started has landed nothing, so reading then answers with exactly what is
 * already on screen and the rows the run brings are never drawn. The moment
 * worth reading at is the one after the last row of the run has been committed.
 */
describe('re-reading the device after a run', () => {
  it('re-reads when a run ends and not when one starts', async () => {
    let reads = 0
    mountReader(async () => (reads += 1), 0)
    await settle()
    expect(reads).toBe(1)

    engine.syncing.value = true
    await settle()
    expect(reads, 'a run that has only started has brought nothing to read').toBe(1)

    engine.syncing.value = false
    await settle()
    expect(reads).toBe(2)
  })

  it('does not re-read while a run goes on', async () => {
    let reads = 0
    mountReader(async () => (reads += 1), 0)
    await settle()

    engine.syncing.value = true
    engine.syncing.value = true
    await settle()

    expect(reads).toBe(1)
  })

  /**
   * Reads overlap — a mount, a run ending and a change of parameter all start
   * one — and they do not come back in the order they left. The screen has to
   * end up showing the newest, or a slow read from before the run paints the
   * device as it no longer is and stays there until something else happens.
   */
  it('shows the newest read even when an older one answers last', async () => {
    const pending: ((value: string) => void)[] = []
    const { seen } = mountReader(() => new Promise<string>((done) => pending.push(done)), '')

    engine.syncing.value = true
    engine.syncing.value = false
    await settle()
    expect(pending).toHaveLength(2)

    pending[1]!('after the run')
    pending[0]!('before the run')
    await settle()

    expect(seen.data.value).toBe('after the run')
  })
})

/**
 * A page Ionic has kept alive can be shown again for a different id, and then
 * everything on it belongs to the previous one.
 */
describe('a screen reused for another document', () => {
  it('re-reads when what it was asked for changes', async () => {
    const asked: string[] = []
    const id = ref('first')
    mountReader(async () => (asked.push(id.value), id.value), '', { watching: [() => id.value] })
    await settle()
    expect(asked).toEqual(['first'])

    id.value = 'second'
    await settle()

    expect(asked).toEqual(['first', 'second'])
  })
})
