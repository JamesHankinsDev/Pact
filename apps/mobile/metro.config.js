// Metro config for the pnpm-monorepo Expo app.
//
// Tells Metro to watch the workspace root and resolve modules from both the
// project's node_modules and the root's node_modules (where pnpm's .pnpm store
// lives). Hierarchical lookup is intentionally LEFT ENABLED so Metro can walk
// up from a package inside .pnpm/<dep>/node_modules/<dep> to find that
// package's transitive deps as siblings — that's how pnpm's isolated layout
// expects resolution to work.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
