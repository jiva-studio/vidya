declare module 'vue-router' {
  interface RouteMeta {
    /** Reachable without a session: the joining page, sign-in, the catch-all. */
    public?: boolean

    /** `false` for screens shown outside the shell, such as sign-in. */
    chrome?: boolean
  }
}

export {}
