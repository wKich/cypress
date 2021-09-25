import { objectType } from 'nexus'
import { nxs, NxsResult } from 'nexus-decorators'

const StorybookFile = objectType({
  name: 'StorybookFile',
  definition (t) {
    t.nonNull.string('name')
    t.nonNull.string('absolute')
    t.nonNull.string('relative')
  },
})

const StorybookMainJs = objectType({
  name: 'StorybookMainJs',
  definition (t) {
    t.nonNull.string('name')
    t.nonNull.string('absolute')
    t.nonNull.string('relative')
    t.list.string('storyGlobs')
    t.list.json('stories', {
      async resolve (source, args, ctx) {
        return (source as any).getStories()
      },
    })
  },
})

const StorybookHtmlFile = objectType({
  name: 'StorybookHtmlFile',
  definition (t) {
    t.nonNull.string('name')
    t.nonNull.string('absolute')
    t.nonNull.string('relative')
    t.nonNull.string('content')
  },
})

@nxs.objectType({
  description: 'Storybook detection',
})
export class Storybook {
  _generatedSpecs: Cypress.Cypress['spec'][] = [];
  constructor (private _configured: boolean, private _files?: IStorybookFiles) {}

  @nxs.field.nonNull.boolean({
    description: 'Whether Storybook is configured',
  })
  get configured (): NxsResult<'Storybook', 'configured'> {
    return this._configured
  }

  @nxs.field.type(() => StorybookMainJs, {
    description: 'Detected Storybook main.js file',
  })
  get mainJs (): NxsResult<'Storybook', 'mainJs'> {
    return this._files?.mainJs || null
  }

  @nxs.field.type(() => StorybookFile, {
    description: 'Detected Storybook preview.js file',
  })
  get previewJs (): NxsResult<'Storybook', 'previewJs'> {
    return this._files?.previewJs || null
  }

  @nxs.field.type(() => StorybookHtmlFile, {
    description: 'Detected Storybook preview-head.html file',
  })
  get previewHead (): NxsResult<'Storybook', 'previewHead'> {
    return this._files?.previewHead || null
  }

  @nxs.field.type(() => StorybookHtmlFile, {
    description: 'Detected Storybook preview-body.html file',
  })
  get previewBody (): NxsResult<'Storybook', 'previewBody'> {
    return this._files?.previewBody || null
  }

  @nxs.field.nonNull.list.nonNull.type(() => StorybookFile, {
    description: 'Generated specs',
  })
  get generatedSpecs (): NxsResult<'Storybook', 'generatedSpecs'> {
    return this._generatedSpecs
  }
}

interface IBaseStorybookFile {
  name: string
  absolute: string
  relative: string
}

interface IStorybookMainJs extends IBaseStorybookFile {
  stories?: string[]
  getStories: () => Promise<string[]>
}

interface IStorybookHtmlFile extends IBaseStorybookFile {
  content: string
}

interface IStorybookFiles {
  mainJs: IStorybookMainJs | null
  previewJs: IBaseStorybookFile | null
  previewHead: IStorybookHtmlFile | null
  previewBody: IStorybookHtmlFile | null
}
