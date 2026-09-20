import { Image, Music, Type, Video } from 'lucide-vue-next'

import CommandMenu from './CommandMenu.vue'

const items = [
  { value: 'text', label: 'Text', description: 'A paragraph of markdown', icon: Type },
  { value: 'image', label: 'Image', description: 'A picture with a caption', icon: Image },
  { value: 'video', label: 'Video', description: 'An upload or a link', icon: Video },
  { value: 'audio', label: 'Audio', description: 'A recording', icon: Music },
  { value: 'quiz', label: 'Quiz', description: 'A question with options', disabled: true },
]

const args = {
  items,
  placeholder: 'Search blocks',
  emptyLabel: 'Nothing matches that',
  label: 'Insert a block',
}

export default { title: 'Design system/Overlays/CommandMenu', component: CommandMenu }

export const Default = { args }
export const Filtered = { args: { ...args, term: 'vid' } }
export const Empty = { args: { ...args, term: 'nothing here' } }
export const WithoutDescriptions = {
  args: { ...args, items: items.map(({ value, label }) => ({ value, label })) },
}
