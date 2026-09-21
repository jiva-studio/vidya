import SectionPreview from './SectionPreview.vue'

export default { title: 'Design system/Lesson/SectionPreview', component: SectionPreview }

const labels = {
  untitledSection: 'Untitled section',
  embeddedMedia: 'Embedded media',
  missingMedia: 'No playable link yet.',
  emptyQuestion: 'No question yet.',
  rightAnswer: 'right answer',
  describeUnknownBlock: (type: string) => `Unknown block of kind ${type}.`,
}

const blocks = [{ id: 'b1', type: 'text', content: 'The vowels come first.' }]

export const Titled = {
  args: { section: { id: 's1', title: 'The alphabet', assessment: 'none', blocks }, labels },
}

export const Untitled = {
  args: { section: { id: 's1', title: '', assessment: 'none', blocks }, labels },
}
