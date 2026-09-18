import type { PermissionKey } from '@vidya/domain'

declare module 'vue-router' {
  interface RouteMeta {
    /** Reachable without a session. Only sign-in and the not-found screen are. */
    public?: boolean

    /** Refused without this permission in the current school. */
    permission?: PermissionKey

    /** `false` for screens shown outside the shell, such as sign-in. */
    chrome?: boolean

    /**
     * The index screen of the section this one belongs to.
     *
     * A screen showing one record of one school cannot stay open when the
     * school changes, so the shell sends the operator here instead (AC-6).
     */
    section?: string

    /** Fluent keys of the breadcrumb trail, root first. */
    breadcrumbs?: readonly string[]
  }
}

export {}
