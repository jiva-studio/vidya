export interface TooltipProps {
  // Explains an icon. A tooltip is never the only place a fact appears.
  text: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  delay?: number
  class?: string
}
