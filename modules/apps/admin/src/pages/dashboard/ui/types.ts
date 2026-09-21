import type { DashboardIsland } from '../model'

export interface DashboardIslandCardProps {
  island: DashboardIsland
  loading?: boolean
}

export interface DashboardIslandCardEmits {
  open: [route: string]
}
