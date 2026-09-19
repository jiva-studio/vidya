import { Module } from '@nestjs/common'
import { EduModule } from '@vidya/api/edu/edu.module'
import { UserSchoolsService } from '@vidya/api/edu/services'
import { SCHOOL_MEMBERSHIP, SchoolMembership } from '@vidya/api/sync'

/**
 * Binds the one question `sync` asks of `edu` to the code that answers it.
 *
 * Composition, and nothing else. It sits here rather than in either module so
 * that neither names the other: `sync` knows the port it declared, `edu` knows
 * nothing of `sync`, and the fact that membership happens to be a role today is
 * a fact this file alone holds. Before it, `SyncModule` imported all of
 * `EduModule` — thirteen entities, every controller — to reach one method.
 *
 * The return type is what checks the shape: an answer that stops fitting the
 * port fails to compile here rather than at the first request.
 */
@Module({
  imports: [EduModule],
  providers: [
    {
      provide: SCHOOL_MEMBERSHIP,
      useFactory: (schools: UserSchoolsService): SchoolMembership => ({
        schoolsOf: (userId) => schools.getUserSchools(userId),
      }),
      inject: [UserSchoolsService],
    },
  ],
  exports: [SCHOOL_MEMBERSHIP],
})
export class SchoolMembershipModule {}
