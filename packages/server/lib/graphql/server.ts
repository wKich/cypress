import { graphqlHTTP } from 'express-graphql'
import express from 'express'
import { introspectionFromSchema } from 'graphql'
import fs from 'fs'
import path from 'path'

import { graphqlSchema } from './schema'
import type { AddressInfo } from 'net'
import { ExecContext } from './ExecContext'

// TODO: Only execute this stuff in development mode

const app = express()

app.use('/graphql', graphqlHTTP(() => {
  return {
    schema: graphqlSchema,
    graphiql: true,
    context: new ExecContext({}),
  }
}))

const srv = app.listen(52159, () => {
  // eslint-disable-next-line
  console.log(`GraphQL Server at http://localhost:${(srv.address() as AddressInfo).port}/graphql`)
})

const generatedDir = path.join(__dirname, '../../../', 'launchpad/cypress/generated')

fs.mkdirSync(generatedDir, { recursive: true })
fs.writeFileSync(
  path.join(generatedDir, 'introspection.json'),
  JSON.stringify(introspectionFromSchema(graphqlSchema), null, 2),
)

export { graphqlSchema }
