import BlockPreview from './BlockPreview.vue'

export default { title: 'Design system/Lesson/BlockPreview', component: BlockPreview }

const labels = {
  untitledSection: 'Untitled section',
  embeddedMedia: 'Embedded media',
  missingMedia: 'No playable link yet.',
  emptyQuestion: 'No question yet.',
  rightAnswer: 'right answer',
  describeUnknownBlock: (type: string) => `Unknown block of kind ${type}.`,
}

export const Text = {
  args: {
    block: { id: 'b1', type: 'text', content: 'Read the alphabet **left to right**.' },
    labels,
  },
}

export const Video = {
  args: {
    block: { id: 'b2', type: 'video', source: 'youtube', url: 'https://youtu.be/abc' },
    labels,
  },
}

export const Quiz = {
  args: {
    block: {
      id: 'b3',
      type: 'quiz',
      question: 'Which letter opens the alphabet?',
      answers: ['The first one', 'The last one'],
      rightAnswer: 0,
    },
    labels,
  },
}

export const Unknown = { args: { block: { id: 'b4', type: 'image' }, labels } }
