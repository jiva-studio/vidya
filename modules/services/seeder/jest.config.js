module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  testEnvironment: 'node',
  testTimeout: 60000,
  moduleNameMapper: {
    '^@vidya/entities$': '<rootDir>/../../libs/entities',
    '^@vidya/domain$': '<rootDir>/../../libs/domain',
    '^@vidya/protocol$': '<rootDir>/../../libs/protocol',
  },
}
