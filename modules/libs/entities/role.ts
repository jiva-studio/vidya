import { RoleId, SchoolId } from '@vidya/domain'
import * as domain from '@vidya/domain'
import { Column, Entity, OneToMany, OneToOne, PrimaryGeneratedColumn } from 'typeorm'

import { School } from './school'
import { UserRole } from './userRole'

@Entity({ name: 'roles' })
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: RoleId

  @Column({ nullable: false })
  name: string

  @Column({ nullable: false })
  description: string

  @Column({ nullable: false })
  schoolId: SchoolId

  @OneToOne(() => School)
  school: School

  @Column('varchar', { array: true, nullable: true })
  permissions: domain.PermissionKey[]

  @OneToMany(() => UserRole, (userRole) => userRole.role)
  public userRoles: UserRole[]
}
