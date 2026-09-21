import { LoggerService } from '../logger.service'

describe('LoggerService', () => {
  let stdoutSpy: jest.SpyInstance
  let stderrSpy: jest.SpyInstance

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    stdoutSpy.mockRestore()
    stderrSpy.mockRestore()
  })

  it('outputs valid JSON lines when format is json', () => {
    const logger = new LoggerService({ level: 'info', format: 'json' })
    logger.setContext('TestContext')
    logger.log('User signed in', { userId: '123' })

    expect(stdoutSpy).toHaveBeenCalledTimes(1)
    const raw = stdoutSpy.mock.calls[0][0].toString()
    const parsed = JSON.parse(raw)

    expect(parsed.level).toBe('info')
    expect(parsed.context).toBe('TestContext')
    expect(parsed.message).toBe('User signed in')
    expect(parsed.userId).toBe('123')
    expect(parsed.timestamp).toBeDefined()
  })

  it('filters out logs below the configured log level', () => {
    const logger = new LoggerService({ level: 'warn', format: 'json' })
    logger.debug('This is debug')
    logger.log('This is info')

    expect(stdoutSpy).not.toHaveBeenCalled()

    logger.warn('This is a warning')
    expect(stdoutSpy).toHaveBeenCalledTimes(1)
  })

  it('routes error level to stderr with stack trace when error object is passed', () => {
    const logger = new LoggerService({ level: 'error', format: 'json' })
    const err = new Error('Database connection timeout')
    logger.error('Failed to query', err.stack, 'Database')

    expect(stderrSpy).toHaveBeenCalledTimes(1)
    const raw = stderrSpy.mock.calls[0][0].toString()
    const parsed = JSON.parse(raw)

    expect(parsed.level).toBe('error')
    expect(parsed.message).toBe('Failed to query')
    expect(parsed.context).toBe('Database')
    expect(parsed.stack).toContain('Database connection timeout')
  })

  it('formats human-readable text when format is pretty', () => {
    const logger = new LoggerService({ level: 'debug', format: 'pretty' })
    logger.setContext('Auth')
    logger.log('OTP verified')

    expect(stdoutSpy).toHaveBeenCalledTimes(1)
    const raw = stdoutSpy.mock.calls[0][0].toString()
    expect(raw).toContain('[INFO]')
    expect(raw).toContain('[Auth]')
    expect(raw).toContain('OTP verified')
  })
})
