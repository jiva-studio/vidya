import { isPublicAddress } from '../addressRanges'

/**
 * Every address here is one that answers from inside our network and from
 * nowhere else, which is what makes an endpoint pointed at it worth typing in.
 */
const REFUSED: readonly [string, string][] = [
  ['169.254.169.254', 'the cloud metadata service, which hands out this machine credentials'],
  ['169.254.1.1', 'anything else link-local'],
  ['127.0.0.1', 'loopback, which is this process'],
  ['127.5.5.5', 'the rest of the loopback range, not only the first address'],
  ['10.0.0.5', 'a private address in 10/8'],
  ['172.16.4.9', 'the first half of 172.16/12'],
  ['172.31.255.254', 'the last half of 172.16/12'],
  ['192.168.1.10', 'a private address in 192.168/16'],
  ['100.64.0.1', 'a carrier-grade NAT address'],
  ['100.127.255.255', 'the far end of the carrier range'],
  ['0.0.0.0', 'the unspecified address'],
  ['224.0.0.1', 'multicast'],
  ['::1', 'IPv6 loopback'],
  ['::', 'the unspecified IPv6 address'],
  ['fc00::1', 'an IPv6 unique local address'],
  ['fdff::9', 'the other half of fc00::/7'],
  ['fe80::1', 'an IPv6 link-local address'],
  ['::ffff:169.254.169.254', 'the metadata service written as an IPv4-mapped IPv6 address'],
  ['::ffff:10.0.0.5', 'a private address written as an IPv4-mapped IPv6 address'],
  ['not-an-address', 'a string that is no address at all'],
  ['', 'nothing'],
]

const ALLOWED: readonly [string, string][] = [
  ['52.219.44.10', 'an ordinary public address'],
  ['172.32.0.1', 'just past the end of 172.16/12'],
  ['172.15.255.255', 'just before the start of 172.16/12'],
  ['100.63.255.255', 'just before the carrier range'],
  ['100.128.0.0', 'just past the carrier range'],
  ['2606:4700::1111', 'a public IPv6 address'],
  ['fb00::1', 'just before fc00::/7'],
]

describe('the addresses a school endpoint may resolve to', () => {
  for (const [address, reason] of REFUSED) {
    it(`refuses ${address || '(empty)'} — ${reason}`, () => {
      expect(isPublicAddress(address)).toBe(false)
    })
  }

  for (const [address, reason] of ALLOWED) {
    it(`allows ${address} — ${reason}`, () => {
      expect(isPublicAddress(address)).toBe(true)
    })
  }

  it('reads an address with spaces around it rather than refusing it as unparseable', () => {
    expect(isPublicAddress('  52.219.44.10  ')).toBe(true)
    expect(isPublicAddress('  10.0.0.5  ')).toBe(false)
  })
})
