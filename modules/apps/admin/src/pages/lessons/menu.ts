import type { MenuGroup } from '@/shared/navigation'

/**
 * Lessons have no sidebar entry. Owned by T3.
 *
 * They are reached from their course, because the screen needs a course to
 * mean anything, and an entry that lands on "choose a course first" is a
 * detour rather than navigation.
 */
export const menu: MenuGroup[] = []
