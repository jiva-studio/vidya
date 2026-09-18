import { Inject, Injectable } from '@nestjs/common'
import { SchoolsService } from '@vidya/api/edu/services'
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

@ValidatorConstraint({ async: true, name: 'school-exists' })
@Injectable()
export class IsSchoolExistConstraint implements ValidatorConstraintInterface {
  constructor(@Inject(SchoolsService) private readonly schools: SchoolsService) {}

  async validate(value: string): Promise<boolean> {
    if (!isUUID(value)) {
      return false
    }
    return await this.schools.existsBy({ id: domain.asId<domain.SchoolId>(value) })
  }

  defaultMessage(validationArguments?: ValidationArguments): string {
    return `School '${validationArguments.value}' not found for '${validationArguments.property}'`
  }
}

export function IsSchoolExist(validationOptions?: ValidationOptions) {
  return function (target: DecoratedTarget, propertyName: string) {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSchoolExistConstraint,
    })
  }
}
