module.exports = {
  runtimeCompiler: true,
  chainWebpack: (config) => {
    config.resolve.alias
    .set('vue', require('path').resolve('./node_modules/vue'))
  },
}
