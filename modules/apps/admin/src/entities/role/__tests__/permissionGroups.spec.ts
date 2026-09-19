import type { PermissionKey } from '@vidya/domain'
import { PermissionKeys } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { actionOf, groupPermissions, prefixOf } from '../model'

describe('groupPermissions', () => {
  it('groups every key the domain declares, losing none of them', () => {
    const groups = groupPermissions()
    const grouped = groups.flatMap((group) => group.keys)

    expect(grouped).toEqual([...PermissionKeys])
  })

  it('puts the keys of one resource under one prefix', () => {
    const groups = groupPermissions([
      'roles:create',
      'users:read',
      'roles:delete',
    ] as PermissionKey[])

    expect(groups).toEqual([
      { prefix: 'roles', keys: ['roles:create', 'roles:delete'] },
      { prefix: 'users', keys: ['users:read'] },
    ])
  })

  it('keeps the wildcard apart instead of filing it under a resource', () => {
    const groups = groupPermissions(['*', 'roles:read'] as PermissionKey[])

    expect(groups[0]).toEqual({ prefix: 'all', keys: ['*'] })
  })

  it('names the resource and the verb of a key', () => {
    expect(prefixOf('lessons:publish' as PermissionKey)).toBe('lessons')
    expect(actionOf('lessons:publish' as PermissionKey)).toBe('publish')
    expect(prefixOf('*' as PermissionKey)).toBe('all')
    expect(actionOf('*' as PermissionKey)).toBe('all')
  })

  it('keeps the domain order, so the form does not reshuffle between releases', () => {
    const prefixes = groupPermissions().map((group) => group.prefix)

    expect(prefixes[0]).toBe('all')
    expect(prefixes).toContain('homework')
  })
})
