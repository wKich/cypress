const devServer = require('@cypress/react/plugins/react-scripts')

/**
 * @type {Cypress.PluginConfig}
 */
module.exports = (on, config) => {
  devServer(on, config, { template: 'cypress/component/index.html' })

  return config
}
