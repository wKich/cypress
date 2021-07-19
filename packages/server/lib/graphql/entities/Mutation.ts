import { nxs } from 'nexus-decorators'
import { Wizard } from './Wizard'

export class Mutation {
  @nxs.mutationField(() => ({ type: Wizard }))
  static abc () {}
}
