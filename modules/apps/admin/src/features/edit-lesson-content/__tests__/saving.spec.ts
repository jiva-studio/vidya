import type { BlockId, LessonBlock, LessonContent, SectionId } from '@vidya/domain'
import { LessonContentSchemaVersion } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { findInvalidBlocks, pruneForSave } from '../model'

const id = <TId>(value: string) => value as unknown as TId

const doc = (...blocks: LessonBlock[]): LessonContent => ({
  schemaVersion: LessonContentSchemaVersion,
  sections: [{ id: id<SectionId>('s1'), title: 'Alphabet', assessment: 'none', blocks }],
})

const text = (value: string): LessonBlock =>
  ({ id: id<BlockId>('text'), type: 'text', content: value }) as LessonBlock

const image = (url: string, posterUrl?: string): LessonBlock =>
  ({ id: id<BlockId>('image'), type: 'image', source: 'url', url, posterUrl }) as LessonBlock

const quiz = (
  question: string,
  answers: string[],
  rightAnswer = 0,
  explanation?: string,
): LessonBlock =>
  ({
    id: id<BlockId>('quiz'),
    type: 'quiz',
    question,
    answers,
    rightAnswer,
    explanation,
  }) as LessonBlock

const kept = (content: LessonContent) =>
  pruneForSave(content).sections.flatMap((section) => section.blocks.map((block) => block.id))

describe('what reaches the server', () => {
  it('drops a text block holding nothing but whitespace', () => {
    expect(kept(doc(text('   \n\t ')))).toEqual([])
  })

  it('keeps a text block the moment it holds a character', () => {
    expect(kept(doc(text('a')))).toEqual(['text'])
  })

  it('drops a media block with no link', () => {
    expect(kept(doc(image('')))).toEqual([])
  })

  it('keeps a media block that has a poster url, because someone specified it', () => {
    expect(kept(doc(image('', 'https://example.org/poster.png')))).toEqual(['image'])
  })

  it('drops a quiz with no question and nothing typed into any option', () => {
    expect(kept(doc(quiz('', ['', ''])))).toEqual([])
  })

  it('keeps a quiz that has only a question', () => {
    expect(kept(doc(quiz('Who speaks?', ['', ''])))).toEqual(['quiz'])
  })

  it('keeps a quiz that has only one option filled in', () => {
    expect(kept(doc(quiz('', ['Krishna', ''])))).toEqual(['quiz'])
  })

  it('keeps a quiz that has only an explanation', () => {
    expect(kept(doc(quiz('', ['', ''], 0, 'Because he does')))).toEqual(['quiz'])
  })

  it('drops an untitled section once its blocks were dropped, so an untouched lesson stays empty', () => {
    const untouched = doc(text(' '))
    untouched.sections[0].title = ''

    expect(pruneForSave(untouched).sections).toEqual([])
  })

  it('keeps a section the author named, even with nothing written under it', () => {
    expect(pruneForSave(doc(text(' '))).sections).toHaveLength(1)
  })

  it('leaves the document it was handed untouched, so the caret keeps its block', () => {
    const before = doc(text(''), text('written'))
    pruneForSave(before)

    expect(before.sections[0].blocks).toHaveLength(2)
  })

  it('stamps the schema version this build writes', () => {
    const stale = { ...doc(text('a')), schemaVersion: 0 }

    expect(pruneForSave(stale).schemaVersion).toBe(LessonContentSchemaVersion)
  })
})

describe('what stops a version being published', () => {
  it('says nothing about a document that was only just started', () => {
    expect(findInvalidBlocks(doc(text(''), image(''), quiz('', ['', ''])))).toEqual([])
  })

  it('never faults a text block, however it is written', () => {
    expect(findInvalidBlocks(doc(text('# only a heading')))).toEqual([])
  })

  it('faults a media block that was given a poster but never given a link', () => {
    expect(findInvalidBlocks(doc(image('', 'https://example.org/poster.png')))).toEqual(['image'])
  })

  it('faults a quiz with options but no question', () => {
    expect(findInvalidBlocks(doc(quiz('', ['Krishna', 'Arjuna'])))).toEqual(['quiz'])
  })

  it('faults a quiz that offers fewer than two answers to choose between', () => {
    expect(findInvalidBlocks(doc(quiz('Who speaks?', ['Krishna', ' '])))).toEqual(['quiz'])
  })

  it('faults a quiz whose correct answer points at an option nobody filled in', () => {
    expect(findInvalidBlocks(doc(quiz('Who speaks?', ['Krishna', 'Arjuna', ''], 2)))).toEqual([
      'quiz',
    ])
  })

  it('passes a quiz that asks something and marks a real answer', () => {
    expect(findInvalidBlocks(doc(quiz('Who speaks?', ['Krishna', 'Arjuna'], 1)))).toEqual([])
  })

  it('passes a media block once it has a link', () => {
    expect(findInvalidBlocks(doc(image('https://example.org/a.png')))).toEqual([])
  })

  it('reports every fault at once, in the order the author reads them', () => {
    const content = doc(quiz('Who speaks?', ['Krishna']), image('', 'later'))

    expect(findInvalidBlocks(content)).toEqual(['quiz', 'image'])
  })
})
