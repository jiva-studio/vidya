import type { PermissionKey } from '@vidya/domain'
import type { RouteRecordRaw } from 'vue-router'

import type { LocaleMessages } from '../i18n'

/** One entry in the sidebar, declared by the section that owns the screen. */
export interface MenuItem {
  /** Route name the entry leads to. */
  readonly route: string

  /** Fluent key for the label; sections ship both languages with it. */
  readonly label: string

  /** Name of the icon in the shared set. */
  readonly icon: string

  /** Hidden when the current school does not grant this. Always shown when absent. */
  readonly permission?: PermissionKey
}

/** Sidebar entries are grouped; the group is a heading, not a link. */
export interface MenuGroup {
  readonly label: string
  readonly items: readonly MenuItem[]
}

/**
 * What a section hands the composition root.
 *
 * The router, the sidebar and the bundles are assembled from these and are
 * owned by one track, so five sections being written at once never meet in the
 * same file. A section fills its own `routes.ts`, `menu.ts` and `i18n/`.
 */
export interface Section {
  readonly routes: RouteRecordRaw[]
  readonly menu?: readonly MenuGroup[]
  readonly messages?: LocaleMessages
}
