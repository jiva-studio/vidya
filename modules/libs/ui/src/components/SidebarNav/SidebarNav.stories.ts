import SidebarNav from './SidebarNav.vue'

const groups = [
  {
    key: 'edu',
    label: 'Teaching',
    items: [
      { key: 'courses', label: 'Courses', href: '#courses', active: true },
      { key: 'groups', label: 'Groups', href: '#groups' },
      { key: 'enrollments', label: 'Enrolments', href: '#enrollments', badge: '4' },
      { key: 'homework', label: 'Homework', href: '#homework', badge: '12' },
    ],
  },
  {
    key: 'org',
    label: 'Organisation',
    items: [
      { key: 'schools', label: 'Schools', href: '#schools' },
      { key: 'roles', label: 'Roles', href: '#roles' },
      { key: 'users', label: 'Users', href: '#users', disabled: true },
    ],
  },
]

export default { title: 'Design system/Layout/SidebarNav', component: SidebarNav }

export const Default = { args: { groups } }
export const SingleGroup = { args: { groups: [groups[0]] } }
export const Empty = { args: { groups: [] } }
