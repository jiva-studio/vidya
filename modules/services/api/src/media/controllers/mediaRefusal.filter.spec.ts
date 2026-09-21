import { ArgumentsHost } from '@nestjs/common'
import { MediaRefusals } from '@vidya/protocol'

import { MediaRefusedError } from '../mediaRefusal'
import { MediaRefusalFilter } from './mediaRefusal.filter'

type Answer = { status: number; body: Record<string, unknown> }

/** A response that records what was written to it instead of writing it. */
const answering = (): { answer: Answer; host: ArgumentsHost } => {
  const answer: Answer = { status: 0, body: {} }

  const response = {
    status(code: number) {
      answer.status = code
      return this
    },
    json(body: Record<string, unknown>) {
      answer.body = body
    },
  }

  return {
    answer,
    host: { switchToHttp: () => ({ getResponse: () => response }) } as ArgumentsHost,
  }
}

const answerFor = (error: MediaRefusedError): Answer => {
  const { answer, host } = answering()
  new MediaRefusalFilter().catch(error, host)

  return answer
}

describe('how a media refusal reaches the client', () => {
  it('answers a file a lesson still shows with a conflict', () => {
    expect(answerFor(new MediaRefusedError('in-use'))).toMatchObject({
      status: 409,
      body: { message: [MediaRefusals.inUse], error: 'Conflict', statusCode: 409 },
    })
  })

  it('carries the lessons a refusal was given, so it says where', () => {
    const lessons = [{ lessonId: 'a1b2', title: 'Lesson 4. Practice' }]

    expect(answerFor(new MediaRefusedError('in-use', { lessons })).body.lessons).toEqual(lessons)
  })

  it('answers content naming a file the school does not have with 422', () => {
    expect(answerFor(new MediaRefusedError('unknown-media'))).toMatchObject({
      status: 422,
      body: {
        message: [MediaRefusals.unknownMedia],
        error: 'Unprocessable Entity',
        statusCode: 422,
      },
    })
  })

  it('keeps answering an upload refusal the way it did', () => {
    expect(answerFor(new MediaRefusedError('quota-exceeded'))).toMatchObject({
      status: 413,
      body: { message: [MediaRefusals.quotaExceeded], error: 'Payload Too Large' },
    })
  })
})
