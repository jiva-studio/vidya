import { quotaBytesFor } from '../storageQuotas.service'

const INSTALLATION_DEFAULT = 5_368_709_120
const DECIDED = 40_000

describe('the ceiling a school stores under', () => {
  it('is the one it was given, whoever pays for the bucket', () => {
    expect(quotaBytesFor(DECIDED, true, INSTALLATION_DEFAULT)).toBe(DECIDED)
    expect(quotaBytesFor(DECIDED, false, INSTALLATION_DEFAULT)).toBe(DECIDED)
  })

  // A row holding null says a person decided not to cap this school, which is
  // a different answer from nobody having decided.
  it('is none at all for a school that was deliberately left uncapped', () => {
    expect(quotaBytesFor(null, true, INSTALLATION_DEFAULT)).toBeNull()
    expect(quotaBytesFor(null, false, INSTALLATION_DEFAULT)).toBeNull()
  })

  it('falls back to the installation default while nobody has decided', () => {
    expect(quotaBytesFor(undefined, false, INSTALLATION_DEFAULT)).toBe(INSTALLATION_DEFAULT)
  })

  it('leaves a school paying its own provider uncapped until someone decides', () => {
    expect(quotaBytesFor(undefined, true, INSTALLATION_DEFAULT)).toBeNull()
  })

  it('reads a ceiling of zero as a ceiling and not as an absent one', () => {
    expect(quotaBytesFor(0, false, INSTALLATION_DEFAULT)).toBe(0)
  })
})
