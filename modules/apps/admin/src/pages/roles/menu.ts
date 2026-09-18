import type { MenuGroup } from '@/shared/navigation'

/**
 * Roles sit in the organisation group, which `pages/schools` declares.
 *
 * The sidebar draws one heading per group, so three sections declaring the
 * same heading would draw it three times. The entry for this section lives in
 * that one group; its label is defined by this section's own resources.
 */
export const menu: MenuGroup[] = []
