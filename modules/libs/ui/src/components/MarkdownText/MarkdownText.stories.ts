import MarkdownText from './MarkdownText.vue'

export default { title: 'Design system/Lesson/MarkdownText', component: MarkdownText }

export const Block = {
  args: {
    markdown:
      '# Letters and sounds\n\nRead the alphabet **left to right**.\n\n- The vowels come first\n- The consonants follow',
  },
}

export const Inline = {
  args: { markdown: 'the **speaker** of the *gita*', inline: true },
}
