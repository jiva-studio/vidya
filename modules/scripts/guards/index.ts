/** The checks that catch what the compiler cannot, run as one gate. */

import { checkAttribution } from './attribution.ts'
import { checkDomainLiterals } from './domainLiterals.ts'
import { checkLocaleKeys } from './localeKeys.ts'
import { checkRecordString } from './recordString.ts'

const GUARDS = [
  { name: 'locale keys assembled at runtime', run: checkLocaleKeys },
  { name: 'lifecycle lists copied out of the domain', run: checkDomainLiterals },
  { name: 'string-keyed maps of lifecycle states', run: checkRecordString },
  { name: 'attribution', run: checkAttribution },
]

let failed = false

for (const guard of GUARDS) {
  const failures = guard.run()

  if (failures.length === 0) {
    console.log(`ok   ${guard.name}`)
    continue
  }

  failed = true
  console.log(`FAIL ${guard.name}`)
  for (const failure of failures) console.log(`     ${failure}`)
}

if (failed) process.exit(1)
