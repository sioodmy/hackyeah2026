const path = require("node:path")
const { getDefaultConfig } = require("expo/metro-config")

const config = getDefaultConfig(__dirname)

// @safecall/shared is a workspace package, so Metro has to watch it and resolve
// through the flat node_modules that .npmrc creates.
config.watchFolders = [
  ...config.watchFolders,
  path.resolve(__dirname, "../../packages/shared"),
]
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(__dirname, "../../node_modules"),
]
config.resolver.disableHierarchicalLookup = true

module.exports = config
