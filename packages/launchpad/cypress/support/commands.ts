import { mount, CyMountOptions } from '@cypress/vue'
import { Component } from 'vue'
import { buildClientSchema, buildSchema, printSchema, print, execute, isScalarType, GraphQLResolveInfo, IntrospectionQuery, graphql, isNonNullType } from 'graphql'

import { createStoreApp, StoreApp } from '../../src/store/app'
import { createStoreConfig, StoreConfig } from '../../src/store/config'
import { TypedDocumentNode } from '@graphql-typed-document-node/core'
import gql from 'graphql-tag'

import introspection from '../generated/introspection.json'

const objectTypes = introspection.__schema.types
.filter((t) => t.kind === 'OBJECT' && !t.name.startsWith('__'))
.map((o) => o.name)

// Add a Union of all types, so we can easily create a query for GraphQL
// data at a given level
const testObjectTypes = `
union CyTestObj = ${objectTypes.join(' | ')}

extend type Query {
  """
  Used in component tests to provide a 
  """
  cyTestObj: CyTestObj
  cyTestObjs: [CyTestObj]
}
`
const schemaWithTestTypes = [printSchema(
  buildClientSchema(introspection as any as IntrospectionQuery),
)].concat(testObjectTypes).join('\n')

/**
 * Re-build the schema, with the new testing types extended onto the Query
 */
const testSchema = buildSchema(schemaWithTestTypes)

interface LaunchpadMountOpts<Props> extends CyMountOptions<Props> {
  graphql?: {}
}

function launchpadMount<Props = any> (comp: Component<Props>, options: LaunchpadMountOpts<Props> = {}) {
  const storeApp = createStoreApp()
  const storeConfig = createStoreConfig(storeApp)

  Cypress.storeApp = storeApp
  Cypress.storeConfig = storeConfig

  options = options || {}
  options.global = options.global || {}

  options.global.plugins = options.global.plugins || []
  options.global.plugins.push(storeApp)
  options.global.plugins.push(storeConfig)

  return mount(comp, options)
}

interface MountFragOpts<Result, Args, Props> {
  fragment: TypedDocumentNode<Result, Args>
  plural?: boolean
  variableValues?: Args
  component: Component<Props>
}

/**
 * Mounts a component with a GraphQL fragment, taking the
 */
function mountFragment <Result, Args, Props> (mountFragOpts: MountFragOpts<Result, Args, Props>) {
  const frag = mountFragOpts?.fragment
  const def = frag?.definitions?.[0]

  if (def?.kind !== 'FragmentDefinition') {
    throw new Error(`Expected cy.mountFragment to provide a options.fragment, saw ${JSON.stringify(mountFragOpts?.fragment?.definitions)}`)
  }

  const testField = mountFragOpts.plural ? 'cyTestObjs' : 'cyTestObj'

  const testQ = `query TestQuery {
  ${testField} {
    ... on ${def.typeCondition.name.value} {
      ...${def.name.value}
    }
  }
}
${print(frag)}`

  const fn = new Function('gql', `
    return gql\`${testQ}\`
  `)

  interface ResolveShape {
    calls: string[]
    proxyVal: any
    parent?: GraphQLResolveInfo
  }

  const noop = () => {}

  function proxyResolve (resolve: ResolveShape) {
    return new Proxy(resolve.proxyVal ?? noop, {
      get (target, p: string, receiver) {
        if (p === '__typename') {
          return 'Query'
        }

        if (p === 'then') {
          return null
        }

        return proxyResolve({
          proxyVal: noop,
          calls: resolve.calls.concat(p),
        })
      },
      apply (target, thisArg, argArray) {
        const [_args, _ctx, info] = argArray as [any, any, GraphQLResolveInfo]

        let returnType = info.returnType

        if (isNonNullType(returnType)) {
          returnType = returnType.ofType
        }

        if (isScalarType(returnType)) {
          switch (returnType.name) {
            case 'String': return 'String'
            case 'Boolean': return true
            case 'Int': return 1
            case 'ID': return 'ID'
            case 'Float': return 1.1
            default:
              return ''
          }
        }

        return proxyResolve({
          calls: resolve.calls,
          proxyVal: {},
          parent: info,
        })
      },
    })
  }

  const result = execute({
    schema: testSchema,
    document: fn(gql),
    variableValues: mountFragOpts.variableValues ?? {},
    rootValue: proxyResolve({
      proxyVal: noop,
      calls: [],
    }),
  })

  // @ts-expect-error
  return launchpadMount(mountFragOpts.component, { props: { gql: result.data[testField] } })
}

Cypress.Commands.add(
  'mount',
  launchpadMount,
)

Cypress.Commands.add(
  'mountFragment',
  mountFragment,
)

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Install all vue plugins and globals then mount
       */
      mount: typeof launchpadMount
      /**
       * Mounts a component with a GraphQL Fragment
       */
      mountFragment: typeof mountFragment
    }
    interface Cypress {
      /**
       * The sroreApp used in the mount command
       */
      storeApp: StoreApp
      /**
       * The sroreConfig used in the mount command
       */
      storeConfig: StoreConfig
    }
  }
}
