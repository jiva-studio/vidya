import { onMounted, type Ref, ref, watch, type WatchSource } from 'vue'

import { useSiteStatus } from '@/shared/status'

/**
 * One read of the local database, repeated whenever a run brings more.
 *
 * A screen never polls: the engine reports what it applied, and that report is
 * what says the answer may have changed. `reading` is true only until the
 * first answer is in, so a screen can say "looking" rather than showing an
 * empty list it has not read yet — the two are the difference between waiting
 * a moment and having nothing.
 */
export const useLocalRead = <T>(
  read: () => Promise<T>,
  initial: T,
  watching: WatchSource[] = [],
) => {
  const status = useSiteStatus()
  const data = ref(initial) as Ref<T>
  const reading = ref(true)

  const reload = async (): Promise<void> => {
    try {
      data.value = await read()
    } catch (error) {
      // A reading tab can hold an image written before the writing tab created
      // the schema. An unreadable table is one moment of "nothing yet", not a
      // screen worth failing, and the next run re-reads it.
      console.warn('the local database could not be read', error)
    } finally {
      reading.value = false
    }
  }

  onMounted(() => void reload())
  watch([status.done, status.firstRunCompleted, ...watching], () => void reload())

  return { data, reading, reload }
}
