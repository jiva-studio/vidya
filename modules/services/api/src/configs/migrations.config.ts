import { registerAs } from '@nestjs/config'
import { join } from 'path'

/**
 * Where the `.sql` files live at runtime.
 *
 * In development that is the source tree; in the image it is whatever the
 * Dockerfile copied next to `dist`. It is configurable because those two
 * answers differ, and getting it wrong is the failure the runner refuses to
 * treat as success.
 */
export default registerAs('migrations', () => ({
  dir: process.env.VIDYA_MIGRATIONS_DIR || join(process.cwd(), 'migrations'),
}))
