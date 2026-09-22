import QuizPreview from './QuizPreview.vue'

export default { title: 'Design system/Lesson/QuizPreview', component: QuizPreview }

const labels = {
  untitledSection: 'Untitled section',
  embeddedMedia: 'Embedded media',
  missingMedia: 'No playable link yet.',
  emptyQuestion: 'No question yet.',
  rightAnswer: 'right answer',
  describeUnknownBlock: (type: string) => `Unknown block of kind ${type}.`,
}

const block = {
  id: 'b1',
  type: 'quiz',
  question: 'Which letter opens the alphabet?',
  answers: ['The first one', 'The last one'],
  rightAnswer: 0,
}

export const WithTheKeyNamed = { args: { block, labels } }

export const AsTheStudentReadsIt = {
  args: { block, labels: { ...labels, rightAnswer: undefined } },
}

export const WithoutAQuestion = { args: { block: { ...block, question: '' }, labels } }
