import { RoleId, SchoolId } from '@vidya/domain'
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

export type SchoolConfig = {
  /** Assigned to a student when they join this school. */
  defaultStudentRoleId: RoleId

  /** The roles a student in this school may hold. */
  studentRoleIds: RoleId[]
}

@Entity({ name: 'schools' })
export class School {
  @PrimaryGeneratedColumn('uuid')
  id: SchoolId

  @Column({ nullable: false })
  name: string

  @Column({ nullable: false, type: 'json', default: {} })
  config: SchoolConfig
}
