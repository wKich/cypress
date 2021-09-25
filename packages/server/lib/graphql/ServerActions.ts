import fs from 'fs'
import glob from 'glob'
import fse from 'fs-extra'
import path from 'path'
import Debug from 'debug'
import { promisify } from 'util'
import { readCsfOrMdx, CsfFile } from '@storybook/csf-tools'

import type { ServerContext } from './ServerContext'
import { BaseActions, Project, Storybook } from '@packages/graphql'
import { openProject } from '@packages/server/lib/open_project'
import type { LaunchArgs, LaunchOpts, FoundBrowser, OpenProjectLaunchOptions, FullConfig } from '@packages/types'
import { getProjectRoots, insertProject } from '@packages/server/lib/cache'

// @ts-ignore
import user from '../user'

// @ts-ignore
import auth from '../gui/auth'

// @ts-ignore
import browsers from '../browsers'

import * as config from '../config'

import { getId } from '../project_static'
import type { BrowserContract } from '../../../graphql/src/contracts/BrowserContract'

const debug = Debug('cypress:server:graphql')

const exists = promisify(fs.access)
const readFile = promisify(fs.readFile)
const asyncGlob = promisify(glob)
const writeFile = promisify(fs.writeFile)

/**
 *
 */
export class ServerActions extends BaseActions {
  constructor (protected ctx: ServerContext) {
    super(ctx)
  }

  installDependencies () {
    //
  }

  addProject (projectRoot: string) {
    // no need to re-add
    const found = this.ctx.localProjects.find((x) => x.projectRoot === projectRoot)

    if (found) {
      return found
    }

    const localProject = new Project(projectRoot, this.ctx)

    this.ctx.localProjects.push(localProject)
    insertProject(projectRoot)

    return localProject
  }

  async loadProjects () {
    const cachedProjects = await this._loadProjectsFromCache()

    cachedProjects.forEach((projectRoot) => {
      this.addProject(projectRoot)
    })

    return this.ctx.app.projects
  }

  async _loadProjectsFromCache () {
    return await getProjectRoots()
  }

  async authenticate () {
    this.ctx.setAuthenticatedUser(await auth.start(() => {}, 'launchpad'))
  }

  async logout () {
    try {
      await user.logOut()
    } catch {
      //
    }
    this.ctx.setAuthenticatedUser(null)
  }

  async getProjectId (projectRoot: string) {
    const projectId: string = await getId(projectRoot)

    return projectId ?? null
  }

  getBrowsers (): Promise<FoundBrowser[]> {
    return browsers.get()
  }

  initializeConfig (projectRoot: string): Promise<config.FullConfig> {
    return config.get(projectRoot)
  }

  createConfigFile (code: string, configFilename: string): void {
    const project = this.ctx.activeProject

    if (!project) {
      throw Error(`Cannot create config file without activeProject.`)
    }

    fs.writeFileSync(path.resolve(project.projectRoot, configFilename), code)
  }

  createComponentTemplate (template: string) {
    const project = this.ctx.activeProject

    if (!project) {
      throw Error(`Cannot create config file without activeProject.`)
    }

    if (this.ctx.activeProject?.isFirstTimeCT) {
      const indexHtmlPath = path.resolve(this.ctx.activeProject.projectRoot, 'cypress/component/index.html')

      fse.outputFileSync(indexHtmlPath, template)
    }
  }

  async initializeOpenProject (args: LaunchArgs, options: OpenProjectLaunchOptions, browsers: FoundBrowser[]) {
    await openProject.create(args.projectRoot, args, options, browsers)
    if (!this.ctx.activeProject) {
      throw Error('Cannot initialize project without an active project')
    }

    if (args.testingType === 'e2e') {
      this.ctx.activeProject.setE2EPluginsInitialized(true)
    }

    if (args.testingType === 'component') {
      this.ctx.activeProject.setCtPluginsInitialized(true)
    }

    return
  }

  async launchOpenProject (browser: BrowserContract, spec: any, options: LaunchOpts): Promise<void> {
    debug('launching with browser %o', browser)

    return openProject.launch(browser, spec, options)
  }

  resolveOpenProjectConfig (): FullConfig | null {
    return openProject.getConfig() ?? null
  }

  isFirstTime (projectRoot: string, testingType: Cypress.TestingType): boolean {
    try {
      const config = JSON.parse(fs.readFileSync(path.join(projectRoot, 'cypress.json'), 'utf-8'))
      const type = testingType === 'e2e' ? 'e2e' : 'component'
      const overrides = config[type] || {}

      return Object.keys(overrides).length === 0
    } catch (e) {
      const err = e as Error

      // if they do not have a cypress.json, it's definitely their first time using Cypress.
      if (err.name === 'ENOENT') {
        return true
      }

      // unexpected error
      throw Error(e)
    }
  }

  async detectStorybook (projectRoot: string): Promise<Storybook> {
    const storybookRoot = path.join(projectRoot, '.storybook')

    try {
      await exists(storybookRoot, fs.constants.F_OK)
    } catch {
      return new Storybook(false)
    }
    // Find and resolve mainJs
    // TODO: Should be sandboxed
    const mainJsPath = path.join(storybookRoot, 'main.js')
    let mainJs: any

    try {
      let mainJsModule = require(mainJsPath)

      mainJs = {
        name: 'main.js',
        absolute: mainJsPath,
        relative: path.relative(projectRoot, mainJsPath),
        storyGlobs: mainJsModule.stories,
        // Want to defer this but I'm sure there is a better way
        async getStories () {
          const files: string[] = []

          for (const storyPattern of mainJsModule.stories) {
            const res = await asyncGlob(path.join(storybookRoot, storyPattern))

            files.push(...res)
          }

          return files
        },
      }
    } catch (e) {
      mainJs = null
    }

    const previewJsPath = path.join(storybookRoot, 'preview.js')
    let previewJs: any

    try {
      await exists(previewJsPath)
      previewJs = {
        name: 'preview-head.html',
        absolute: previewJsPath,
        relative: path.relative(projectRoot, previewJsPath),
      }
    } catch (e) {
      previewJs = null
    }

    const previewHeadPath = path.join(storybookRoot, 'preview-head.html')
    let previewHead: any

    try {
      const previewHeadContent = await readFile(previewHeadPath, 'utf-8')

      previewHead = {
        name: 'preview-head.html',
        absolute: previewHeadPath,
        relative: path.relative(projectRoot, previewHeadPath),
        content: previewHeadContent,
      }
    } catch (e) {
      previewHead = null
    }

    const previewBodyPath = path.join(storybookRoot, 'preview-body.html')
    let previewBody: any

    try {
      const previewBodyContent = await readFile(previewBodyPath, 'utf-8')

      previewBody = {
        name: 'preview-head.html',
        absolute: previewBodyPath,
        relative: path.relative(projectRoot, previewBodyPath),
        content: previewBodyContent,
      }
    } catch (e) {
      previewBody = null
    }

    return new Storybook(true, { mainJs, previewJs, previewHead, previewBody })
  }

  async generateSpecFromStory (
    storyPath: string,
    projectRoot: string,
  ): Promise<Cypress.Cypress['spec'] | null> {
    const storyFile = path.parse(storyPath)
    const storyName = storyFile.name.split('.')[0] // assume Button.stories.ts structure

    try {
      const raw = await readCsfOrMdx(storyPath, { defaultTitle: storyName })
      const parsed = raw.parse()

      if (
        (!parsed.meta.title && !parsed.meta.component) ||
        !parsed.stories.length
      ) {
        return null
      }

      const newSpecContent = generateSpecFromStories(parsed, storyFile)
      const newSpecPath = path.join(
        storyPath,
        '..',
        `${parsed.meta.component}.cy-spec${storyFile.ext}`,
      )

      await writeFile(newSpecPath, newSpecContent)

      return {
        name: path.parse(newSpecPath).name,
        relative: path.relative(projectRoot, newSpecPath),
        absolute: newSpecPath,
      }
    } catch (e) {
      return null
    }
  }
}

function generateSpecFromStories (parsed: CsfFile, storyFile: path.ParsedPath) {
  // TODO: Only gen from stories we support (React, Vue)
  if (
    parsed._ast.program.body.some(
      (statement) => {
        return statement.type === 'ImportDeclaration' &&
        statement.source.value.includes('.vue')
      },
    )
  ) {
    return `import * as stories from './${storyFile.name}';
import { mount, composeStories } from '@cypress/vue';

const composedStories = composeStories(stories);

describe('${parsed.meta.title || parsed.meta.component}', () => {
${parsed.stories
    .map((story, i) => {
      const component = story.name.replace(/\s+/, '')

      return `  ${i !== 0 ? '// ' : ''}it('should render ${component}', () => {
  ${i !== 0 ? '// ' : ''}  const { ${component} } = composedStories
  ${i !== 0 ? '// ' : ''}  mount(${component}())
  ${i !== 0 ? '// ' : ''}})`
    })
    .join('\n\n')}
})`
  }

  return `import React from 'react';
import * as stories from './${storyFile.name}';
import { mount, composeStories } from '@cypress/react';

const composedStories = composeStories(stories);

describe('${parsed.meta.title || parsed.meta.component}', () => {
${parsed.stories
  .map((story, i) => {
    const component = story.name.replace(/\s+/, '')

    return `  ${i !== 0 ? '// ' : ''}it('should render ${component}', () => {
  ${i !== 0 ? '// ' : ''}  const { ${component} } = composedStories
  ${i !== 0 ? '// ' : ''}  mount(<${component} />)
  ${i !== 0 ? '// ' : ''}})`
  })
  .join('\n\n')}
})`
}
