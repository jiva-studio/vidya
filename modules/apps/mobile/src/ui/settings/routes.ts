import type { RouteRecordRaw } from 'vue-router'

// Settings has no screens of its own yet: the download queue it used to hold
// belonged to offline media, which v1 does not ship.
export const routes: Array<RouteRecordRaw> = []
