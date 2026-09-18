import { bootstrap, emailFromArgv } from './bootstrap'
import { SeedDataSource } from './datasource'

const email = emailFromArgv(process.argv)

if (!email) {
  console.error('usage: npm run bootstrap -w @vidya/seeder -- --email you@example.com')
  process.exit(1)
}

SeedDataSource.initialize()
  .then(async (connection) => {
    const result = await bootstrap(connection, { email })
    console.log(`school ${result.schoolId}`)
    console.log(`role   ${result.roleId}`)
    console.log(`user   ${result.userId} (${email})`)
    console.log(result.created ? 'created' : 'already there, nothing changed')
    await connection.destroy()
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
