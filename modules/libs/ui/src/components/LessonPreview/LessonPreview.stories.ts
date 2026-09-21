import LessonPreview from './LessonPreview.vue'

export default { title: 'Design system/Lesson/LessonPreview', component: LessonPreview }

const labels = {
  untitledSection: 'Untitled section',
  embeddedMedia: 'Embedded media',
  missingMedia: 'No playable link yet.',
  emptyQuestion: 'No question yet.',
  rightAnswer: 'right answer',
  describeUnknownBlock: (type: string) => `Unknown block of kind ${type}.`,
}

const content = {
  schemaVersion: 1,
  sections: [
    {
      id: 's1',
      title: 'The alphabet',
      assessment: 'none',
      blocks: [
        { id: 'b1', type: 'text', content: '# Letters and sounds\n\nRead **left to right**.' },
        { id: 'b2', type: 'video', source: 'youtube', url: 'https://youtu.be/abc' },
      ],
    },
    {
      id: 's2',
      title: 'What you remember',
      assessment: 'auto',
      blocks: [
        {
          id: 'b3',
          type: 'quiz',
          question: 'Which letter opens the alphabet?',
          answers: ['The first one', 'The last one'],
          rightAnswer: 0,
        },
      ],
    },
  ],
}

export const AsTheAuthorReadsIt = { args: { content, labels } }

export const AsTheStudentReadsIt = {
  args: { content, labels: { ...labels, rightAnswer: undefined } },
}

const progressLabels = {
  markRead: 'Mark as read',
  answerRecorded: 'Your answer is in.',
  answerCorrect: 'Right',
  answerIncorrect: 'Wrong',
}

export const AsTheStudentAnswersIt = {
  args: {
    content,
    labels: { ...labels, rightAnswer: undefined },
    progress: { states: {}, verdicts: {}, editable: true, labels: progressLabels },
  },
}

export const AsTheStudentLeftIt = {
  args: {
    content,
    labels: { ...labels, rightAnswer: undefined },
    progress: {
      states: { b1: { type: 'text', read: true }, b3: { type: 'quiz', answer: 1 } },
      verdicts: {},
      editable: true,
      labels: progressLabels,
    },
  },
}

export const AsTheSchoolMarkedIt = {
  args: {
    content,
    labels: { ...labels, rightAnswer: undefined },
    progress: {
      states: { b1: { type: 'text', read: true }, b3: { type: 'quiz', answer: 1 } },
      verdicts: { b3: { correct: false, explanation: 'The alphabet opens with a vowel.' } },
      editable: true,
      labels: progressLabels,
    },
  },
}

export const Empty = { args: { content: { schemaVersion: 1, sections: [] }, labels } }
