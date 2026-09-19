/**
 * The public face of @vidya/ui.
 *
 * Every component of the library is listed here once, with its types. Nothing
 * in this package knows the Vidya domain: no protocol types, no router, no
 * HTTP. A component that needs one of those belongs in the application.
 */

export { cn } from './lib/utils'

/* ---------------------------- Input and forms ----------------------------- */

export { default as Button, IconButton } from './components/Button'
export type * from './components/Button/types'
export { default as Checkbox } from './components/Checkbox'
export type * from './components/Checkbox/types'
export { default as Combobox, ComboboxList } from './components/Combobox'
export type * from './components/Combobox/types'
export { default as FieldGroup } from './components/FieldGroup'
export type * from './components/FieldGroup/types'
export { default as FormField } from './components/FormField'
export type * from './components/FormField/types'
export { default as FormFooter } from './components/FormFooter'
export type * from './components/FormFooter/types'
export { default as Input } from './components/Input'
export type * from './components/Input/types'
export { default as Label } from './components/Label'
export type * from './components/Label/types'
export { default as RadioGroup, RadioGroupItem } from './components/RadioGroup'
export type * from './components/RadioGroup/types'
export { default as Select, SelectList } from './components/Select'
export type * from './components/Select/types'
export { default as Switch } from './components/Switch'
export type * from './components/Switch/types'
export { default as Textarea } from './components/Textarea'
export type * from './components/Textarea/types'

/* ---------------------------------- Data ---------------------------------- */

export { default as Avatar } from './components/Avatar'
export type * from './components/Avatar/types'
export { default as Badge } from './components/Badge'
export type * from './components/Badge/types'
export { default as EmptyState } from './components/EmptyState'
export type * from './components/EmptyState/types'
export { default as FailureState } from './components/FailureState'
export type * from './components/FailureState/types'
export { default as Pagination, PaginationItem } from './components/Pagination'
export type * from './components/Pagination/types'
export { default as Skeleton } from './components/Skeleton'
export type * from './components/Skeleton/types'
export { default as Table, TableCell, TableHead, TableRow } from './components/Table'
export type * from './components/Table/types'
export { default as TableFilters } from './components/TableFilters'
export type * from './components/TableFilters/types'

/* -------------------------------- Overlays -------------------------------- */

export { default as AlertDialog, AlertDialogActions } from './components/AlertDialog'
export type * from './components/AlertDialog/types'
export { default as Dialog, DialogFooter, DialogHeader } from './components/Dialog'
export type * from './components/Dialog/types'
export { default as DropdownMenu, DropdownMenuItems } from './components/DropdownMenu'
export type * from './components/DropdownMenu/types'
export { default as Toast, Toaster } from './components/Toast'
export type * from './components/Toast/types'
export { default as Tooltip } from './components/Tooltip'
export type * from './components/Tooltip/types'

/* ------------------------------ Shell and nav ----------------------------- */

export { default as AppShell } from './components/AppShell'
export type * from './components/AppShell/types'
export { default as Breadcrumbs } from './components/Breadcrumbs'
export type * from './components/Breadcrumbs/types'
export { default as Card } from './components/Card'
export type * from './components/Card/types'
export { default as PageHeader } from './components/PageHeader'
export type * from './components/PageHeader/types'
export { default as Separator } from './components/Separator'
export type * from './components/Separator/types'
export { SidebarGroup, SidebarItem, default as SidebarNav } from './components/SidebarNav'
export type * from './components/SidebarNav/types'
export { default as Spinner } from './components/Spinner'
export type * from './components/Spinner/types'
export { default as Tabs, TabsPanel } from './components/Tabs'
export type * from './components/Tabs/types'
