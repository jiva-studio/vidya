import { Injectable, NotFoundException, PipeTransform } from '@nestjs/common'
import { UsersService } from '@vidya/api/edu/services'
import * as domain from '@vidya/domain'

@Injectable()
export class UserExistsPipe implements PipeTransform {
  constructor(private readonly usersService: UsersService) {}

  async transform(raw: string) {
    const value = domain.asId<domain.UserId>(raw)

    const user = await this.usersService.findOneBy({ id: value })
    if (!user) {
      throw new NotFoundException(`User with ID ${value} not found`)
    }
    return value
  }
}
