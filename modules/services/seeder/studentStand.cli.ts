import { emailFromArgv } from './bootstrap'
import { SeedDataSource } from './datasource'
import { seedStudentStand } from './studentStand'

const email = emailFromArgv(process.argv)

if (!email) {
  console.error('usage: npm run seed:student -w @vidya/seeder -- --email student@example.com')
  process.exit(1)
}

SeedDataSource.initialize()
  .then(async (connection) => {
    const result = await seedStudentStand(connection, { email })
    console.log(`school  ${result.schoolId}`)
    console.log(`course  ${result.courseId} (published, 1 lesson)`)
    console.log(`student ${result.userId} (${email}, no roles)`)
    console.log(`join    /j/${result.schoolCode}`)
    console.log(result.created ? 'created' : 'already there, nothing changed')
    await connection.destroy()
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
