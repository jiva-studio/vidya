import { cloudDoneOutline, cloudOfflineOutline, syncOutline } from 'ionicons/icons'

/** What the connection banner is saying at this moment. */
export type BannerMode = 'offline' | 'syncing' | 'synced'

export const bannerIcons: Record<BannerMode, string> = {
  offline: cloudOfflineOutline,
  syncing: syncOutline,
  synced: cloudDoneOutline,
}

export const bannerColors: Record<BannerMode, string> = {
  offline: 'medium',
  syncing: 'primary',
  synced: 'success',
}

export const bannerTitles: Record<BannerMode, string> = {
  offline: 'sync-offline-title',
  syncing: 'sync-online-syncing',
  synced: 'sync-online-synced',
}
