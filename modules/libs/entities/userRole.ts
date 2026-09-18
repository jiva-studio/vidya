import { RoleId, UserId, UserRoleId } from '@vidya/domain'
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'

import { Role } from './role'
import { User } from './user'

@Entity({ name: 'userRoles' })
export class UserRole {
  @PrimaryGeneratedColumn('uuid')
  public id: UserRoleId

  @Column()
  public userId: UserId

  @Column()
  public roleId: RoleId

  @ManyToOne(() => User, (user) => user.userRoles)
  public user: User

  @ManyToOne(() => Role, (role) => role.userRoles)
  public role: Role
}
