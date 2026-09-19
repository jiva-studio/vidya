import { type ISyncClient, SyncPausedError } from '@vidya/usecases'

/**
 * A sync wire that stops the moment the device asks for its database back.
 *
 * The engine notices a suspension when it tries to write, which is one request
 * too late: a pull whose page cannot be committed is a request made by an app
 * the system is already putting to sleep — radio and battery spent exactly when
 * the platform is trying to save them, for an answer with nowhere to go.
 *
 * {@link SyncPausedError} rather than a transport failure, because nothing is
 * wrong with the server: every page committed so far stands, and the run
 * resumes from those positions when the app comes back.
 */
export function haltedWhenSuspended(client: ISyncClient, suspended: () => boolean): ISyncClient {
  const halt = () => {
    if (suspended()) throw new SyncPausedError()
  }

  return {
    pull: (request) => {
      halt()
      return client.pull(request)
    },
    push: (request) => {
      halt()
      return client.push(request)
    },
    ackCursor: (request) => {
      halt()
      return client.ackCursor(request)
    },
  }
}
