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

  // An external link: the bytes are never stored, so a device offline falls
  // back to the school's initial rather than to a broken image.
  @Column({ nullable: true, type: 'character varying' })
  logoUrl: string | null

  @Column({ nullable: true, type: 'character varying' })
  description: string | null

  @Column({ nullable: false, type: 'json', default: {} })
  config: SchoolConfig
}
