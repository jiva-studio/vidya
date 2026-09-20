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
