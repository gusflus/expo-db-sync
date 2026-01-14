const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..", "..");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Allow Metro to watch and resolve packages in the monorepo root
config.watchFolders = [workspaceRoot];

// Map workspace package names to their source folders so Metro resolves them
const extraNodeModules = {
  db: path.resolve(workspaceRoot, "packages", "db", "src"),
};
config.resolver.extraNodeModules = extraNodeModules;

config.resolver.sourceExts.push("sql"); // <--- add this

module.exports = config;
