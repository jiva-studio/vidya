import Thumbnail from './Thumbnail.vue'

const src = 'https://placehold.co/320x180/png'

export default { title: 'Design system/Data/Thumbnail', component: Thumbnail }

export const WithImage = { args: { kind: 'image', src, alt: 'The temple at dawn' } }
export const Selected = { args: { kind: 'image', src, alt: 'The temple at dawn', selected: true } }
export const MissingImage = { args: { kind: 'image', alt: 'The temple at dawn' } }
export const MissingVideo = { args: { kind: 'video', alt: 'The lecture recording' } }
export const MissingAudio = { args: { kind: 'audio', alt: 'The morning kirtan' } }
