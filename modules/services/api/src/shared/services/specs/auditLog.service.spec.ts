import { AuditLog } from '@vidya/entities'
import { EntityManager, Repository } from 'typeorm'

import { AuditLogService } from '../auditLog.service'

describe('AuditLogService', () => {
  it('defaults every optional field to null, and the payload to an empty object', async () => {
    const insert = jest.fn().mockResolvedValue(undefined)
    const service = new AuditLogService({ insert } as unknown as Repository<AuditLog>)

    await service.record({ action: 'auth.signOut' })

    expect(insert).toHaveBeenCalledWith({
      action: 'auth.signOut',
      actorUserId: null,
      actorLogin: null,
      subjectType: null,
      subjectId: null,
      schoolId: null,
      sourceAddress: null,
      payload: {},
    })
  })

  it('writes through a given manager rather than its own repository', async () => {
    // Proves the transactional path a future `edu` call site depends on: pass
    // a transaction's manager and the entry lands on that connection, not on
    // the repository the service was constructed with.
    const ownInsert = jest.fn()
    const service = new AuditLogService({ insert: ownInsert } as unknown as Repository<AuditLog>)

    const managerInsert = jest.fn().mockResolvedValue(undefined)
    const manager = {
      getRepository: jest.fn().mockReturnValue({ insert: managerInsert }),
    } as unknown as EntityManager

    await service.record({ action: 'auth.signIn.success' }, manager)

    expect(managerInsert).toHaveBeenCalled()
    expect(ownInsert).not.toHaveBeenCalled()
  })
})
