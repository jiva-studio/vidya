import { ConfigType } from '@nestjs/config'
import { MediaConfig } from '@vidya/api/configs'

import { AddressResolverPort } from '../../infra/ports'
import { StorageFailedError } from '../../storageFailure'
import { EndpointGuardService } from '../endpointGuard.service'

type Config = ConfigType<typeof MediaConfig>

const guardWith = (answers: Record<string, string[]> | Error, allowlist = ['amazonaws.com']) => {
  const asked: string[] = []

  const resolver: AddressResolverPort = {
    async resolveAddresses(host) {
      asked.push(host)
      if (answers instanceof Error) throw answers

      return answers[host] ?? []
    },
  }

  const guard = new EndpointGuardService({ endpointAllowlist: allowlist } as Config, resolver)
  return { guard, asked }
}

describe('the endpoint a school points the API at', () => {
  it('is dialled when the host is allowed and every address it answers with is public', async () => {
    const { guard } = guardWith({ 's3.eu-central-1.amazonaws.com': ['52.219.44.10'] })

    await expect(
      guard.assertEndpointAllowed('https://s3.eu-central-1.amazonaws.com'),
    ).resolves.toBeUndefined()
  })

  it('is refused over plain http, which anyone on the path can read', async () => {
    const { guard, asked } = guardWith({ 's3.eu-central-1.amazonaws.com': ['52.219.44.10'] })

    await expect(
      guard.assertEndpointAllowed('http://s3.eu-central-1.amazonaws.com'),
    ).rejects.toThrow(StorageFailedError)
    expect(asked).toEqual([])
  })

  it('is refused when it is not an address at all', async () => {
    const { guard } = guardWith({})

    await expect(guard.assertEndpointAllowed('not an endpoint')).rejects.toThrow(StorageFailedError)
  })

  it('is refused when the host is on no allowlist the installation keeps', async () => {
    const { guard, asked } = guardWith({ 'storage.elsewhere.example': ['52.219.44.10'] })

    await expect(guard.assertEndpointAllowed('https://storage.elsewhere.example')).rejects.toThrow(
      StorageFailedError,
    )
    expect(asked).toEqual([])
  })

  it('matches a suffix on a label boundary, not on the letters that end a name', async () => {
    const { guard } = guardWith({ 'evil-amazonaws.com': ['52.219.44.10'] })

    await expect(guard.assertEndpointAllowed('https://evil-amazonaws.com')).rejects.toThrow(
      StorageFailedError,
    )
  })

  it('admits the suffix itself, not only a name below it', async () => {
    const { guard } = guardWith({ 'amazonaws.com': ['52.219.44.10'] })

    await expect(guard.assertEndpointAllowed('https://amazonaws.com')).resolves.toBeUndefined()
  })

  // What a name resolves to is the school's to change at any moment, so the
  // address is what the check has to hold, not the name that was typed.
  it('is refused when an allowed name answers with the metadata service', async () => {
    const { guard } = guardWith({ 's3.eu-central-1.amazonaws.com': ['169.254.169.254'] })

    await expect(
      guard.assertEndpointAllowed('https://s3.eu-central-1.amazonaws.com'),
    ).rejects.toThrow(StorageFailedError)
  })

  it('is refused when one of several addresses is private, not only when all are', async () => {
    const { guard } = guardWith({
      's3.eu-central-1.amazonaws.com': ['52.219.44.10', '10.0.0.5'],
    })

    await expect(
      guard.assertEndpointAllowed('https://s3.eu-central-1.amazonaws.com'),
    ).rejects.toThrow(StorageFailedError)
  })

  it('is refused when the name answers with nothing, rather than passing on an empty list', async () => {
    const { guard } = guardWith({ 's3.eu-central-1.amazonaws.com': [] })

    await expect(
      guard.assertEndpointAllowed('https://s3.eu-central-1.amazonaws.com'),
    ).rejects.toThrow(StorageFailedError)
  })

  it('is refused when the name cannot be resolved at all', async () => {
    const { guard } = guardWith(new Error('ENOTFOUND'))

    await expect(
      guard.assertEndpointAllowed('https://s3.eu-central-1.amazonaws.com'),
    ).rejects.toThrow(StorageFailedError)
  })

  it('resolves the bracketed form of an IPv6 address rather than the brackets', async () => {
    const { guard, asked } = guardWith({ '2606:4700::1111': ['2606:4700::1111'] }, [
      'amazonaws.com',
    ])

    await expect(guard.assertEndpointAllowed('https://[2606:4700::1111]')).rejects.toThrow(
      StorageFailedError,
    )
    expect(asked).toEqual([])
  })
})
