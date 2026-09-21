import { Controller, Get, NotFoundException, Param } from '@nestjs/common'
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import * as dto from '@vidya/api/edu/dto'
import { SchoolsService } from '@vidya/api/edu/services'
import * as domain from '@vidya/domain'
import { Routes } from '@vidya/protocol'

/**
 * Resolving a joining link, with no token at all.
 *
 * The card is what a person decides on before they have an account, so this
 * route answers strangers on purpose. It carries the school's name and logo
 * and nothing else: who studies there and what it teaches are answers for
 * members.
 */
@Controller()
@ApiTags('🎓 Education :: Join')
export class JoinController {
  constructor(private readonly schools: SchoolsService) {}

  @Get(Routes().join.resolve(':code'))
  @ApiOperation({
    summary: 'Resolve a joining code into the card of the school it belongs to',
    operationId: 'Join::resolve',
  })
  @ApiOkResponse({ type: dto.ResolveSchoolResponse, description: 'The school behind the code' })
  @ApiNotFoundResponse({ description: 'No school holds this code' })
  async resolve(@Param('code') code: string): Promise<dto.ResolveSchoolResponse> {
    const school = domain.isSchoolCode(code)
      ? await this.schools.findOneBy({ code: domain.normaliseSchoolCode(code) })
      : null

    if (!school) {
      throw new NotFoundException('No school holds this code')
    }

    return { id: school.id, name: school.name, logoUrl: school.logoUrl ?? null }
  }
}
