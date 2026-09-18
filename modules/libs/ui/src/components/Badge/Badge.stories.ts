import Badge from './Badge.vue'

const render = (args: Record<string, unknown>) => ({
  components: { Badge },
  setup: () => ({ args }),
  template: '<Badge v-bind="args">{{ args.tone }}</Badge>',
})

export default { title: 'Data/Badge', component: Badge }

export const Neutral = { render, args: { tone: 'neutral' } }
export const Accent = { render, args: { tone: 'accent' } }
export const Success = { render, args: { tone: 'success' } }
export const Warning = { render, args: { tone: 'warning' } }
export const Danger = { render, args: { tone: 'danger' } }
export const Info = { render, args: { tone: 'info' } }
