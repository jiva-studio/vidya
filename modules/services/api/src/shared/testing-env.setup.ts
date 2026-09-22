/**
 * `JwtConfig` refuses to start without a real `VIDYA_JWT_SECRET` (see
 * `configs/jwt.config.ts`), and most suites boot the whole `AppModule` through
 * `createTestingApp`. This runs before any of that, as a Jest `setupFiles`
 * entry, so every suite gets a key without repeating it — and it only fills
 * the gap: a suite that sets its own value first (`jwt.config.spec.ts`, to
 * exercise the validation) keeps it.
 *
 * The value is a fixture, not a secret: it is committed, so it must never
 * protect anything real. A per-suite random key was rejected the same way a
 * random key at boot is rejected in `jwt.config.ts` — it would make two test
 * runs sign with different keys for no benefit, since nothing here needs the
 * key to be unpredictable.
 */
process.env.VIDYA_JWT_SECRET ||= 'test-fixture-jwt-secret-not-for-production-use'

/**
 * The media master key, for the same reason and on the same terms: suites that
 * boot the whole `AppModule` need one, and none of them is testing it. The
 * value is a fixture — committed, so it must never protect anything real — and
 * the suite that exercises booting without a key removes it itself.
 */
process.env.VIDYA_MEDIA_MASTER_KEY ||= Buffer.alloc(32, 7).toString('base64')
