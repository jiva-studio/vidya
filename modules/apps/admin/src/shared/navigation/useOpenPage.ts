import { onScopeDispose, ref, watchEffect } from 'vue'

/**
 * What the page that is open calls itself, for the sidebar to show.
 *
 * A record's page is named after the record — a person by their name, a group
 * by its own — and the route cannot know that: it holds an identifier. The
 * page says so once it has read it, and the entry under its section says the
 * same thing rather than the kind of the record.
 */
const openTitle = ref<string | undefined>(undefined)

export const useOpenPageTitle = () => openTitle

/** Names the page for as long as the caller is mounted. */
export const nameOpenPage = (title: () => string | undefined): void => {
  watchEffect(() => {
    openTitle.value = title()
  })

  onScopeDispose(() => {
    openTitle.value = undefined
  })
}
