import type { PermissionKey } from '@vidya/domain'

declare module 'vue-router' {
  interface RouteMeta {
    /** Reachable without a session. Only sign-in and the not-found screen are. */
    public?: boolean

    /** Refused without this permission in the current school. */
    permission?: PermissionKey

    /** `false` for screens shown outside the shell, such as sign-in. */
    chrome?: boolean

    /** Fluent keys of the breadcrumb trail, root first. */
    breadcrumbs?: readonly string[]
  }
}

export {}
