import Dropzone from './Dropzone.vue'

export default { title: 'Design system/Input and forms/Dropzone', component: Dropzone }

const args = {
  accept: 'image/*',
  label: 'Drop a picture here',
  hint: 'PNG, JPEG or WebP',
  browseLabel: 'Choose a file',
  refusedLabel: 'That file is not a picture',
}

export const Idle = { args }
export const Disabled = { args: { ...args, disabled: true } }
export const Video = {
  args: {
    ...args,
    accept: 'video/*',
    label: 'Drop a video here',
    hint: 'MP4 or WebM',
    refusedLabel: 'That file is not a video',
  },
}
