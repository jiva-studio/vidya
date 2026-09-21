import { isValidPreferredTimes, MAX_TIME_RANGES } from '@vidya/domain'
import { registerDecorator, ValidationOptions } from 'class-validator'

import { DecoratedTarget } from './target'

/**
 * The shape a request may offer, checked by the one rule both sides run.
 *
 * The device runs `isValidPreferredTimes` before writing to the outbox and the
 * applier runs it before writing to the database; REST would otherwise be the
 * one way in that accepts a shape nothing reads back.
 */
export function IsPreferredTimes(validationOptions?: ValidationOptions) {
  return function (object: DecoratedTarget, propertyName: string) {
    registerDecorator({
      name: 'is-preferred-times',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown) => isValidPreferredTimes(value),
        defaultMessage: () =>
          `${propertyName} must name a time zone and at most ${MAX_TIME_RANGES} ranges`,
      },
    })
  }
}
