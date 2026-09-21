import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common'
import type { Request, Response } from 'express'

import { LoggerService } from '../../logging/logger.service'
import { SentryExceptionFilter } from '../sentry-exception.filter'
import { SentryService } from '../sentry.service'

describe('SentryExceptionFilter', () => {
  let filter: SentryExceptionFilter
  let sentryService: SentryService
  let loggerService: LoggerService

  let mockResponse: { status: jest.Mock; json: jest.Mock }
  let mockRequest: Partial<Request>
  let mockHost: ArgumentsHost

  beforeEach(() => {
    sentryService = {
      isEnabled: jest.fn(() => true),
      captureException: jest.fn(() => 'sentry-id-1'),
      setUser: jest.fn(),
      addBreadcrumb: jest.fn(),
      onModuleInit: jest.fn(),
    } as unknown as SentryService

    loggerService = {
      setContext: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
    } as unknown as LoggerService

    filter = new SentryExceptionFilter(sentryService, loggerService)

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }
    mockRequest = {
      method: 'POST',
      url: '/api/v1/auth/sign-in',
      headers: { 'user-agent': 'jest' },
      ip: '127.0.0.1',
    }
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse as unknown as Response,
        getRequest: () => mockRequest as unknown as Request,
      }),
    } as unknown as ArgumentsHost
  })

  it('handles HttpException by responding with exception status and body', () => {
    const exception = new HttpException('Bad Request', HttpStatus.BAD_REQUEST)

    filter.catch(exception, mockHost)

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST)
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Bad Request',
      }),
    )
    expect(sentryService.captureException).not.toHaveBeenCalled()
  })

  it('captures 500 error to Sentry, logs error and returns safe error payload', () => {
    const error = new Error('Database disk full')

    filter.catch(error, mockHost)

    expect(sentryService.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        tags: expect.objectContaining({ method: 'POST', route: '/api/v1/auth/sign-in' }),
      }),
    )
    expect(loggerService.error).toHaveBeenCalled()
    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
    })
  })
})
