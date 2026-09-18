import Pagination from './Pagination.vue'

export default { title: 'Data/Pagination', component: Pagination }

export const FirstPage = { args: { page: 1, perPage: 20, total: 240 } }
export const MiddlePage = { args: { page: 6, perPage: 20, total: 240 } }
export const SinglePage = { args: { page: 1, perPage: 20, total: 7 } }
