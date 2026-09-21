import { describe, expect, it } from 'vitest'

import { pickSyncView } from '../model'

const state = {
  signedIn: true,
  syncing: false,
  firstRunCompleted: true,
  received: true,
}

describe('what the settings screen has to say about the data', () => {
  it('asks a signed-out visitor to sign in rather than reporting a state', () => {
    expect(pickSyncView({ ...state, signedIn: false, received: false })).toBe('signed-out')
  })

  it('says a run is going on while one is', () => {
    expect(pickSyncView({ ...state, syncing: true })).toBe('running')
  })

  it('says no run has finished here when none has', () => {
    expect(pickSyncView({ ...state, firstRunCompleted: false, received: false })).toBe('never')
  })

  it('does not call a device up to date before anything has arrived on it', () => {
    expect(pickSyncView({ ...state, received: false })).toBe('empty')
  })

  it('tells a device that has never synced apart from one that synced to nothing', () => {
    const never = pickSyncView({ ...state, firstRunCompleted: false, received: false })
    const empty = pickSyncView({ ...state, received: false })

    expect(never).not.toBe(empty)
  })

  it('reports it up to date once something has arrived', () => {
    expect(pickSyncView(state)).toBe('idle')
  })
})
