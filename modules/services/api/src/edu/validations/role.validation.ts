import { Inject, Injectable } from '@nestjs/common'
import { RolesService } from '@vidya/api/edu/services'
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

@ValidatorConstraint({ async: true, name: 'role-exists' })
@Injectable()
export class IsRoleExistConstraint implements ValidatorConstraintInterface {
  constructor(@Inject(RolesService) private readonly roles: RolesService) {}

  async validate(value: string): Promise<boolean> {
    if (!isUUID(value)) {
      return false
    }
    return await this.roles.existsBy({ id: domain.asId<domain.RoleId>(value) })
  }

  defaultMessage(validationArguments?: ValidationArguments): string {
    // TODO: the message joins the whole array with commas, so it reads as one absurd id.
    return `Role '${validationArguments.value}' not found for '${validationArguments.property}'`
  }
}

export function IsRoleExist(validationOptions?: ValidationOptions) {
  return function (target: DecoratedTarget, propertyName: string) {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsRoleExistConstraint,
    })
  }
}
