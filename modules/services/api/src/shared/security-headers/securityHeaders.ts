import { RequestHandler } from 'express'
import helmet from 'helmet'

export type SecurityHeadersOptions = {
  /** See `configs/security-headers.config.ts` for why this defaults to off. */
  hstsEnabled: boolean
}

/**
 * The response headers every answer from this API carries: no MIME sniffing,
 * no framing, a minimal referrer, and HSTS where a deployment says TLS is
 * really there.
 *
 * Helmet's own default Content-Security-Policy is switched off rather than
 * tuned. This API answers with JSON almost everywhere, and a CSP is a rule for
 * a browser about to render a document — on a JSON response there is no
 * document to render, so the header would be inert noise on every route that
 * matters and, on the one route that is not JSON, would cost more than it
 * buys: Swagger UI (non-production only, see `shared/swagger/setup.ts`) ships
 * its own inline scripts and styles, and matching helmet's default policy to
 * them would mean widening it until it stops meaning anything. A document that
 * needs a CSP gets one from the app that serves it, not from this API.
 *
 * `X-Frame-Options: DENY` stays on, including for Swagger: it is the one HTML
 * surface this API serves, and once a developer pastes a bearer token into it
 * it is an authenticated console, worth keeping out of a frame even though the
 * exposure window is non-production only.
 */
export const securityHeaders = (options: SecurityHeadersOptions): RequestHandler =>
  helmet({
    contentSecurityPolicy: false,
    frameguard: { action: 'deny' },
    hsts: options.hstsEnabled,
  })
