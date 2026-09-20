import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { AuthConfig } from '@vidya/api/configs'
import { RedisService } from '@vidya/api/shared/services'
import * as domain from '@vidya/domain'
import { Role, User } from '@vidya/entities'
import { UserPermission, UserPermissionsStorageKey } from '@vidya/protocol'
import { Repository } from 'typeorm'

import { toUserPermissions } from '../mappers/permissions.mapper'

export type LoginField = 'email' | 'phone'

@Injectable()
export class AuthUsersService {
  private readonly logger = new Logger(AuthUsersService.name)

  /**
   * Creates an instance of AuthUsersService.
   * @param users Users repository
   * @param roles Rples repository
   */
  constructor(
    private readonly redis: RedisService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @Inject(AuthConfig.KEY)
    private readonly authConfig: ConfigType<typeof AuthConfig>,
  ) {}

  /**
   * Finds a user by id.
   * @param id Id of the user
   * @returns User with the given id or null if not found
   */
  async findById(id: domain.UserId): Promise<User | null> {
    return await this.users.findOne({ where: { id }, relations: ['roles'] })
  }

  /**
   * Gets a user by login or creates a new one if not found.
   * @param field Field to search by
   * @param login Login value
   * @returns User with the given login or null if not found
   */
  async getOrCreateByLogin(field: LoginField, login: string): Promise<User> {
    const existingUser = await this.users.findOne({
      where: { [field]: login },
      relations: ['roles'],
    })
    if (existingUser) {
      return existingUser
    }

    const newUser = this.users.create({
      [field]: login,
      roles: [],
    })
    return await this.users.save(newUser)
  }

  /**
   * Gets roles of a user.
   * @param userId Id of the user
   * @returns Roles of the user
   */
  async getRolesOfUser(userId: domain.UserId): Promise<Role[]> {
    return await this.roles
      .createQueryBuilder('role')
      .innerJoin('role.userRoles', 'userRole')
      .where('userRole.userId = :userId', { userId })
      .getMany()
  }

  /**
   * Gets user permissions.
   * @param userId User id
   * @returns User permissions
   */
  async getUserPermissions(userId: domain.UserId): Promise<UserPermission[]> {
    // Get permissions from cache if available
    const permissions = await this.redis.get(UserPermissionsStorageKey(userId))

    if (permissions) {
      // Permissions are cached. Parse and return them.
      return JSON.parse(permissions)
    } else {
      this.logger.debug(`Fetching '${userId}' permissions from DB`)

      // Permissions are not cached. Fetch them from the database.
      const userRoles = await this.getRolesOfUser(userId)
      const permissions = toUserPermissions(userRoles)

      // A non-positive TTL disables the cache, which is a development convenience.
      if (this.authConfig.userPermissionsCacheTtl > 0) {
        await this.redis.set(
          UserPermissionsStorageKey(userId),
          JSON.stringify(permissions),
          this.authConfig.userPermissionsCacheTtl,
        )
      }

      // Return the permissions
      return permissions
    }
  }

  /**
   * Forgets the cached permissions of the given users.
   *
   * The cache is owned here — this is the only place that knows the key shape
   * and holds the Redis client that writes it — so every context whose action
   * changes what a user may do (`edu`'s roles and school creation, today)
   * reaches this through a port rather than the key itself. A miss just means
   * the next `getUserPermissions` recomputes from the database, so evicting a
   * user who did not need it costs a read, never correctness.
   * @param userIds Ids of the users whose cached permissions are now stale.
   */
  async evictUserPermissions(userIds: domain.UserId[]): Promise<void> {
    await Promise.all(userIds.map((userId) => this.redis.del(UserPermissionsStorageKey(userId))))
  }
}
