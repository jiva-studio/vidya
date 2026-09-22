/**
 * Whether this browser believes it can reach the network.
 *
 * A port rather than two calls to `navigator`, because what it answers decides
 * whether a sync run is attempted, and a test has to be able to say no.
 */
export interface INetworkStatus {
  isOnline(): boolean

  /** Calls back when the connection returns. The answer stops listening. */
  onOnline(handler: () => void): () => void
}
