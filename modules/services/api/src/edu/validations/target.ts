/**
 * What a property decorator is handed: the prototype of the class carrying the
 * property.
 *
 * `class-validator` wants `target.constructor` and nothing else, so this names
 * the one member that is actually used rather than widening to `object`, which
 * would say the decorator accepts any value at all.
 */
export type DecoratedTarget = {
  // `lib.es5` types every object's `constructor` as `Function`, so this is the
  // only shape a class instance can be matched against.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  constructor: Function
}
