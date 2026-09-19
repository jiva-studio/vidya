/**
 * A journal row as the driver returns it — snake_case, because these tests read
 * the table with SQL rather than through the ORM. Reading the real columns is
 * deliberate: the pull endpoints will read them the same way, and a mapper in
 * between would hide a column that was never written.
 */
export interface SyncJournal {
  global_seq: string
  collection: string
  doc_id: string
  op: string
  data: Record<string, unknown> | null
  hlc: string
  scope_kind: string
  scope_id: string
  school_id: string
  device_id: string | null
  author_id: string | null
  created_at: Date
}
