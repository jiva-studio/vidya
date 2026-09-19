import Button from '../Button'
import Dialog from './Dialog.vue'
import DialogFooter from './DialogFooter.vue'

const render = (args: Record<string, unknown>) => ({
  components: { Dialog, DialogFooter, Button },
  setup: () => ({ args }),
  template: `
    <Dialog v-bind="args">
      <template #trigger><Button variant="secondary">Assign group</Button></template>
      <p>Pick the group this student joins.</p>
      <template #footer>
        <DialogFooter>
          <Button variant="secondary">Cancel</Button>
          <Button>Assign</Button>
        </DialogFooter>
      </template>
    </Dialog>
  `,
})

export default { title: 'Design system/Overlays/Dialog', component: Dialog }

export const Closed = { render, args: { title: 'Assign a group' } }
export const Open = { render, args: { title: 'Assign a group', open: true } }
export const WithDescription = {
  render,
  args: {
    title: 'Assign a group',
    description: 'The student starts the course with this group.',
    open: true,
  },
}
export const Wide = { render, args: { title: 'Lesson preview', open: true, size: 'lg' } }
