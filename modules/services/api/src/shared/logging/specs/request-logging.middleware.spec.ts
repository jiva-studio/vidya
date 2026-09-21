import type { Response } from 'express'

import { LoggerService } from '../logger.service'
import { RequestLoggingMiddleware, RequestWithId } from '../request-logging.middleware'

describe('RequestLoggingMiddleware', () => {
  let middleware: RequestLoggingMiddleware
  let logger: LoggerService

  beforeEach(() => {
    logger = new LoggerService({ level: 'debug', format: 'json' })
    jest.spyOn(logger, 'log').mockImplementation(() => {})
    jest.spyOn(logger, 'warn').mockImplementation(() => {})
    jest.spyOn(logger, 'error').mockImplementation(() => {})
    middleware = new RequestLoggingMiddleware(logger)
  })

  it('assigns x-request-id header and calls next()', () => {
    const req = {
      headers: {},
      method: 'GET',
      url: '/health/live',
    } as unknown as RequestWithId

    const headers: Record<string, string> = {}
    const finishListeners: (() => void)[] = []
    const res = {
      setHeader: jest.fn((k: string, v: string) => {
        headers[k] = v
      }),
      on: jest.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishListeners.push(cb)
      }),
      statusCode: 200,
      getHeader: jest.fn(() => 15),
    } as unknown as Response

    const next = jest.fn()

    middleware.use(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(req.id).toBeDefined()
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', req.id)

    // Trigger finish
    finishListeners.forEach((l) => l())
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('GET /health/live 200'),
      'HTTP',
      expect.objectContaining({ statusCode: 200, requestId: req.id }),
    )
  })

  it('preserves existing x-request-id from caller', () => {
    const req = {
      headers: { 'x-request-id': 'custom-req-id-123' },
      method: 'POST',
      url: '/api/v1/auth/sign-in',
    } as unknown as RequestWithId

    const res = {
      setHeader: jest.fn(),
      on: jest.fn(),
    } as unknown as Response

    const next = jest.fn()

    middleware.use(req, res, next)

    expect(req.id).toBe('custom-req-id-123')
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'custom-req-id-123')
  })
})
