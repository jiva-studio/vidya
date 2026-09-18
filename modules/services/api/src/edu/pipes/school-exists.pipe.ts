import { Injectable, NotFoundException, PipeTransform } from '@nestjs/common'
import { SchoolsService } from '@vidya/api/edu/services'
import * as domain from '@vidya/domain'

@Injectable()
export class SchoolExistsPipe implements PipeTransform {
  constructor(private readonly schoolsService: SchoolsService) {}

  async transform(raw: string) {
    const value = domain.asId<domain.SchoolId>(raw)

    const school = await this.schoolsService.findOneBy({ id: value })
    if (!school) {
      throw new NotFoundException(`School with ID ${value} not found`)
    }
    return value
  }
}
