module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  // Every controller spec boots a full Nest application and a pg-mem datasource
  // in `beforeEach`, so a single test case carries several seconds of setup.
  // Saturating the machine with one worker per core makes that setup contend
  // with itself and blow the timeout, which showed up as suites failing only
  // under `make check` and passing when run alone.
  testTimeout: 60000,
  maxWorkers: '50%',
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  // Only the package's own alias is mapped. The sibling packages resolve
  // through the workspace symlinks in node_modules instead of a relative path,
  // so a tool that copies this package into a sandbox — Stryker — still finds
  // them where npm put them.
  moduleNameMapper: {
    '^@vidya/api/(.*)$': '<rootDir>/$1',
  },
}
