const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Limit Metro workers to 1 to avoid V8 Zone Allocation OOM across parallel workers on low-commit Windows systems.
config.maxWorkers = 1;

module.exports = config;

