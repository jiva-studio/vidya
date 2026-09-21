import type { RoleId, SchoolId, UserId } from '@vidya/domain'
import { Role, School, User } from '@vidya/entities'
import { DataSource } from 'typeorm'

import { journalWhatIsMissing } from './journalBackfill'

export interface BootstrapOptions {
  /** Who gets the owner role. The account is created if it does not exist. */
  readonly email: string

  /** Name of the school to create, when there is not one by this name already. */
  readonly schoolName?: string

  /** Name of the owner role inside that school. */
  readonly roleName?: string
}

export interface BootstrapResult {
  readonly schoolId: SchoolId
  readonly roleId: RoleId
  readonly userId: UserId
  readonly created: boolean
}

const DEFAULTS = { schoolName: 'My School', roleName: 'Owner' }

/**
 * Creates the first school, the first owner role and the first owner.
 *
 * Signing in by one-time code creates the account but gives it no role, and
 * `schools:create` is a permission granted inside a school — so with an empty
 * database nobody can make the first one. This is the way in.
 *
 * It is not `seed`. `seed` truncates four tables before it writes and exists to
 * fill an empty database with demo data; running it against a database with
 * work in it destroys that work. This one adds what is missing and leaves
 * everything else alone, so it is safe to run twice, or on a database that is
 * already in use.
 */
export const bootstrap = async (
  dataSource: DataSource,
  options: BootstrapOptions,
): Promise<BootstrapResult> => {
  const email = options.email.trim().toLowerCase()
  if (email.length === 0) throw new Error('bootstrap needs an email address')

  const schoolName = options.schoolName ?? DEFAULTS.schoolName
  const roleName = options.roleName ?? DEFAULTS.roleName

  return dataSource.transaction(async (manager) => {
    const schools = manager.getRepository(School)
    const roles = manager.getRepository(Role)
    const users = manager.getRepository(User)

    const existingSchool = await schools.findOneBy({ name: schoolName })
    const school = existingSchool ?? (await schools.save({ name: schoolName }))

    const existingRole = await roles.findOneBy({ name: roleName, schoolId: school.id })
    const role =
      existingRole ??
      (await roles.save({
        name: roleName,
        description: 'Owner of the school',
        permissions: ['*'],
        schoolId: school.id,
      }))

    const existingUser = await users.findOne({ where: { email }, relations: { roles: true } })
    const user = existingUser ?? (await users.save({ email, name: email, roles: [role] }))

    // An account that already existed — because it signed in by code once —
    // has the role added rather than replaced: it may belong elsewhere too.
    if (existingUser && !existingUser.roles.some((held) => held.id === role.id)) {
      existingUser.roles = [...existingUser.roles, role]
      await users.save(existingUser)
    }

    await journalWhatIsMissing(manager, [[School, school]])

    return {
      schoolId: school.id,
      roleId: role.id,
      userId: user.id,
      created: !existingSchool || !existingRole || !existingUser,
    }
  })
}

/** Reads `--email you@example.com` off the command line. */
export const emailFromArgv = (argv: readonly string[]): string | undefined => {
  const at = argv.indexOf('--email')
  return at === -1 ? undefined : argv[at + 1]
}
