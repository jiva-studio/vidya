import { Inject, Injectable } from '@nestjs/common'
import { RolesService } from '@vidya/api/edu/services'
import {
  isUUID,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator'

@ValidatorConstraint({ async: true, name: 'role-exists' })
@Injectable()
export class IsRoleExistConstraint implements ValidatorConstraintInterface {
  constructor(@Inject(RolesService) private readonly roles: RolesService) {}

  async validate(value: string): Promise<boolean> {
    if (!isUUID(value)) {
      return false
    }
    return await this.roles.existsBy({ id: value })
  }

  defaultMessage(validationArguments?: ValidationArguments): string {
    // TODO: the message joins the whole array with commas, so it reads as one absurd id.
    return `Role '${validationArguments.value}' not found for '${validationArguments.property}'`
  }
}

export function IsRoleExist(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsRoleExistConstraint,
    })
  }
}
