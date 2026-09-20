import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface'

/**
 * What the browser is told about cross-origin access, built from the list of
 * origins a deployment allows.
 *
 * The preflight is answered by middleware, before any guard runs: an `OPTIONS`
 * carries no `Authorization` header by definition, so a guarded route would
 * refuse the question that asks whether the real request may be sent at all.
 *
 * An origin that is not on the list gets no `Access-Control-Allow-Origin` back
 * rather than an error. That is the refusal the specification defines, and it
 * keeps a probe from learning anything a plain request would not already tell
 * it.
 */
export const corsOptionsFor = (origins: readonly string[]): CorsOptions => ({
  origin: (origin, callback) => {
    // A request with no `Origin` is not a cross-origin one — curl, a health
    // check, another service. It was never the browser's to police.
    callback(null, !origin || origins.includes(origin))
  },

  // The refresh token travels in the body rather than a cookie today, but the
  // answers are per-student either way, so the wildcard origin stays forbidden.
  credentials: true,

  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],

  // Exactly what the clients send: the bearer token and the body's type.
  allowedHeaders: ['Authorization', 'Content-Type'],

  // A sync run is many requests to one origin; without this the browser asks
  // permission before each of them.
  maxAge: 86_400,
})
