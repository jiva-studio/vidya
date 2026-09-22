import MediaPreview from './MediaPreview.vue'

export default { title: 'Design system/Lesson/MediaPreview', component: MediaPreview }

const labels = {
  untitledSection: 'Untitled section',
  embeddedMedia: 'Embedded media',
  missingMedia: 'No playable link yet.',
  emptyQuestion: 'No question yet.',
  rightAnswer: 'right answer',
  describeUnknownBlock: (type: string) => `Unknown block of kind ${type}.`,
}

export const Embed = {
  args: {
    block: { id: 'b1', type: 'video', source: 'youtube', url: 'https://youtu.be/abc' },
    labels,
  },
}

export const Audio = {
  args: {
    block: { id: 'b2', type: 'audio', source: 'url', url: 'https://example.org/kirtan.mp3' },
    labels,
  },
}

export const Missing = {
  args: { block: { id: 'b3', type: 'video', source: 'url', url: '' }, labels },
}
