import { PermissionEnum, PermissionKeys } from '../permissions'

const MEDIA_KEYS = ['media:read', 'media:upload', 'media:delete']
const STORAGE_KEYS = ['storage:read', 'storage:update']

const declared = PermissionKeys as readonly string[]

describe('PermissionKeys', () => {
  it('names reading, uploading and deleting media apart from each other', () => {
    expect(MEDIA_KEYS.filter((key) => !declared.includes(key))).toEqual([])
  })

  it('names reading and updating a school storage profile apart from each other', () => {
    expect(STORAGE_KEYS.filter((key) => !declared.includes(key))).toEqual([])
  })

  it('keeps the storage keys separate from the school presentation keys', () => {
    expect(declared).toContain('schools:update')
    expect(declared).not.toContain('schools:storage')
  })
})

describe('PermissionEnum', () => {
  it('mirrors every media and storage key', () => {
    for (const key of [...MEDIA_KEYS, ...STORAGE_KEYS]) {
      expect(PermissionEnum[key]).toBe(key)
    }
  })
})
