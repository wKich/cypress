import type { Storybook } from '../entities/Storybook'
import { FRAMEWORK_CONFIG_FILE, WizardCodeLanguage } from '../constants/wizardConstants'
import type { WizardBundler } from '../entities/WizardBundler'
import type { WizardFrontendFramework } from '../entities/WizardFrontendFramework'

interface GetCodeOptsE2E {
  type: 'e2e'
  lang: WizardCodeLanguage
}

interface GetCodeOptsCt {
  type: 'component'
  framework: WizardFrontendFramework
  bundler: WizardBundler
  lang: WizardCodeLanguage
  storybook: Storybook | null
}

type GetCodeOpts = GetCodeOptsCt | GetCodeOptsE2E

const LanguageNames: Record<WizardCodeLanguage, string> = {
  js: 'JavaScript',
  ts: 'TypeScript',
}

export const wizardGetConfigCodeE2E = (opts: GetCodeOptsE2E): string | null => {
  return `{
  e2e: {
    viewportHeight: 660,
    viewportWidth: 1000,
}`
}

export const wizardGetConfigCode = (opts: GetCodeOpts): string | null => {
  if (opts.type === 'component') {
    return wizardGetConfigCodeCt(opts)
  }

  if (opts.type === 'e2e') {
    return wizardGetConfigCodeE2E(opts)
  }

  return null
}

export const wizardGetConfigCodeCt = (opts: GetCodeOptsCt): string | null => {
  const { framework, bundler, lang } = opts

  const comments = `Component testing, ${LanguageNames[opts.lang]}, ${framework.name}, ${bundler.name}`
  const frameworkConfig = (FRAMEWORK_CONFIG_FILE as any)[framework.id]

  if (frameworkConfig) {
    return `// ${comments}

${frameworkConfig(opts)[lang]}`
  }

  const exportStatement =
    lang === 'js' ? 'module.exports = {' : 'export default {'

  const importStatements =
    lang === 'js'
      ? ''
      : [
          `import { startDevServer } from \'${bundler.package}\'`,
          `import webpackConfig from './webpack.config'`,
          '',
      ].join('\n')

  const requireStatements =
    lang === 'ts'
      ? ''
      : [
          `const { startDevServer } = require('${bundler.package}')`,
          `const webpackConfig = require('./webpack.config')`,
          '',
      ].join('\n  ')

  const startServerReturn = `return startDevServer({ options, webpackConfig, template: 'cypress/component/index.html' })`

  return `// ${comments}
${importStatements}
${exportStatement}
  ${requireStatements}component(on, config) {
    on('dev-server:start', (options) => {
      ${startServerReturn}
    })
  }
}`
}

export const wizardGetComponentTemplate = (opts: Omit<GetCodeOptsCt, 'lang' | 'type'>) => {
  const framework = opts.framework.id
  let headModifier = ''
  let bodyModifier = ''

  if (framework === 'nextjs') {
    headModifier += '<div id="__next_css__DO_NOT_USE__"></div>'
  }

  if (opts.storybook?.previewHead?.content) {
    headModifier += opts.storybook?.previewHead?.content
  }

  if (opts.storybook?.previewBody?.content) {
    headModifier += opts.storybook?.previewBody?.content
  }

  return getComponentTemplate({ headModifier, bodyModifier })
}

const getComponentTemplate = (opts: {headModifier: string, bodyModifier: string}) => {
  // TODO: Properly indent additions and strip newline if none
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>Components App</title>
    ${opts.headModifier}
  </head>
  <body>
    ${opts.bodyModifier}
    <div id="__cy_root"></div>
  </body>
</html>`
}
