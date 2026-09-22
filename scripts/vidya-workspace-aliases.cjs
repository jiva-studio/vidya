/**
 * Points `@vidya/*` at the JavaScript the API build emits.
 *
 * The libraries are published to the workspace as TypeScript: their
 * `package.json` says `"main": "index.ts"`, and there is no build step. Jest
 * maps them to source and the browser bundlers compile them, so nothing has
 * ever needed this — until the API is actually started, at which point Node
 * resolves `@vidya/domain` to `libs/domain/index.ts`, strips the types itself
 * (Node 22.18 and later do this without being asked), decides the file is an
 * ES module because it has exports, and then refuses its extensionless
 * relative imports.
 *
 * `nest build` has already emitted those same libraries next to the service, so
 * the fix is to resolve the package names there instead. This is a local stand
 * concern and lives here rather than in the service, which this branch does not
 * own; giving the libraries a build of their own is the real answer.
 */

const Module = require('module')
const path = require('path')

const DIST = path.resolve(__dirname, '..', 'modules', 'services', 'api', 'dist', 'libs')

const PACKAGES = {
  '@vidya/domain': 'domain',
  '@vidya/entities': 'entities',
  '@vidya/journal': 'journal',
  '@vidya/protocol': 'protocol',
}

const rewrite = (request) => {
  for (const [name, dir] of Object.entries(PACKAGES)) {
    if (request === name) return path.join(DIST, dir, 'index.js')
    if (request.startsWith(`${name}/`)) return path.join(DIST, dir, request.slice(name.length + 1))
  }
  return request
}

const resolveFilename = Module._resolveFilename

Module._resolveFilename = function (request, ...rest) {
  return resolveFilename.call(this, rewrite(request), ...rest)
}
