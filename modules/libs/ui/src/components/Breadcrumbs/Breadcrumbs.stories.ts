import Breadcrumbs from './Breadcrumbs.vue'

export default { title: 'Shell/Breadcrumbs', component: Breadcrumbs }

export const Deep = {
  args: {
    items: [
      { key: 'courses', label: 'Courses', href: '#courses' },
      { key: 'course', label: 'Sanskrit grammar', href: '#course' },
      { key: 'lesson', label: 'Lesson 3' },
    ],
  },
}

export const Shallow = { args: { items: [{ key: 'courses', label: 'Courses' }] } }
