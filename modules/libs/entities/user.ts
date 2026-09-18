import { UserId } from '@vidya/domain'
import {
  Check,
  Column,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { Role } from './role'
import { UserRole } from './userRole'

@Entity({ name: 'users' })
@Check(`"email" IS NOT NULL OR "phone" IS NOT NULL`)
@Index('unique_lower_email_idx', ['email'], { unique: true }) // Case-insensitive unique index
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: UserId

  @Column({ nullable: true })
  name: string

  @Index({ unique: true })
  @Column({ nullable: true })
  email: string

  @Index({ unique: true })
  @Column({ nullable: true })
  phone: string

  @OneToMany(() => UserRole, (userRole) => userRole.user)
  public userRoles: UserRole[]

  @ManyToMany(() => Role)
  @JoinTable({
    name: 'userRoles',
    joinColumn: {
      name: 'userId',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'roleId',
      referencedColumnName: 'id',
    },
  })
  public roles: Role[]
}
