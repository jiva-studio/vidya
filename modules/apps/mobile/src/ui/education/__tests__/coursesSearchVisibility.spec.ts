// @vitest-environment jsdom
import { IonSearchbar } from '@ionic/vue'
import { asId, type CourseId } from '@vidya/domain'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app', async () => (await import('./localScreens')).appDouble)
vi.mock('@capacitor/network', async () => (await import('./localScreens')).capacitorNetworkDouble)

import CoursesListPage from '../pages/CoursesListPage.vue'
import { aCourse, mountPage, resetLocalScreens, seed, settle } from './localScreens'

const SEARCHBAR = 'ion-searchbar'

beforeEach(resetLocalScreens)

const anId = (at: number): CourseId =>
  asId<CourseId>(`00000000-0000-4000-8000-${String(at).padStart(12, '0')}`)

const aCatalogueOf = async (size: number) => {
  for (let at = 0; at < size; at += 1) {
    seed.courses.push(aCourse({ id: anId(at), name: `Course ${at}` }))
  }

  const wrapper = await mountPage(CoursesListPage)
  await settle()

  return wrapper
}

/**
 * A catalogue the eye takes in at once is read, not searched. The field earns
 * its place only once the list has outgrown that, and what decides is
 * everything the device holds — a query that narrows the list must not take the
 * field away from the hand still typing into it.
 */
describe('the catalogue offers search once it is worth searching', () => {
  it('leaves the field out of a catalogue that fits on a screen', async () => {
    const wrapper = await aCatalogueOf(10)

    expect(wrapper.find(SEARCHBAR).exists()).toBe(false)
  })

  it('offers the field once the catalogue has outgrown a screen', async () => {
    const wrapper = await aCatalogueOf(11)

    expect(wrapper.find(SEARCHBAR).exists()).toBe(true)
  })

  it('keeps the field while a query narrows the list below the threshold', async () => {
    const wrapper = await aCatalogueOf(11)

    wrapper.findComponent(IonSearchbar).vm.$emit('update:modelValue', 'Course 1')
    await settle()

    expect(wrapper.find(SEARCHBAR).exists()).toBe(true)
  })
})
