import { BlockList, isIP } from 'node:net'

/**
 * The address ranges a school's endpoint may never resolve to.
 *
 * These are the ranges that are reachable from inside our network and from
 * nowhere else, which is exactly what makes them worth pointing us at: the
 * cloud metadata service on `169.254.169.254` hands out the credentials of the
 * machine, loopback is this process, and the private and carrier ranges are
 * whatever else runs beside us.
 */
const reserved = (): BlockList => {
  const list = new BlockList()

  list.addSubnet('0.0.0.0', 8)
  list.addSubnet('10.0.0.0', 8)
  list.addSubnet('100.64.0.0', 10)
  list.addSubnet('127.0.0.0', 8)
  list.addSubnet('169.254.0.0', 16)
  list.addSubnet('172.16.0.0', 12)
  list.addSubnet('192.0.0.0', 24)
  list.addSubnet('192.168.0.0', 16)
  list.addSubnet('198.18.0.0', 15)
  list.addSubnet('224.0.0.0', 4)
  list.addSubnet('240.0.0.0', 4)

  list.addAddress('::', 'ipv6')
  list.addAddress('::1', 'ipv6')
  list.addSubnet('fc00::', 7, 'ipv6')
  list.addSubnet('fe80::', 10, 'ipv6')

  return list
}

const RESERVED = reserved()

/**
 * Whether an address may be dialled: anything unparseable counts as may not.
 *
 * An IPv4-mapped address such as `::ffff:10.0.0.1` needs no unwrapping here —
 * `BlockList` matches it against the IPv4 ranges above, which is the behaviour
 * the suite pins.
 */
export const isPublicAddress = (address: string): boolean => {
  const candidate = address.trim()
  const family = isIP(candidate)

  if (family === 0) return false

  return !RESERVED.check(candidate, family === 4 ? 'ipv4' : 'ipv6')
}
