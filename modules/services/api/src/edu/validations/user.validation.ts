import { Inject, Injectable } from '@nestjs/common'
import { UsersService } from '@vidya/api/edu/services'
import * as domain from '@vidya/domain'
import {
  isUUID,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator'

import { DecoratedTarget } from './target'

@ValidatorConstraint({ async: true, name: 'user-exists' })
@Injectable()
export class IsUserExistConstraint implements ValidatorConstraintInterface {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  async validate(value: string): Promise<boolean> {
    if (!isUUID(value)) {
      return false
    }
    return await this.users.existsBy({ id: domain.asId<domain.UserId>(value) })
  }

  defaultMessage(validationArguments?: ValidationArguments): string {
    return `User '${validationArguments.value}' not found for '${validationArguments.property}'`
  }
}

export function IsUserExist(validationOptions?: ValidationOptions) {
  return function (target: DecoratedTarget, propertyName: string) {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsUserExistConstraint,
    })
  }
}
