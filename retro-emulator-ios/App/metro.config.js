// Keep Metro out of the vendored native trees.
//
// modules/*/ios/cpp holds the vendored mGBA, melonDS and Azahar snapshots
// -- ~9k C/C++ files, none of which JavaScript can import. Metro's file
// crawler walked all of them, which pushed a plain manifest request to
// ~17s and made the dev client time out before it ever got a bundle.
//
// blockList feeds metro-file-map's ignore pattern, so this cuts the crawl
// itself, not just resolution.

// (metro-config's exclusionList helper is not reachable through the
// package's exports map, and blockList takes RegExps directly anyway.)

const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  // modules/<name>/ios/cpp/** on either path separator.
  /modules[\\/][^\\/]+[\\/]ios[\\/]cpp[\\/].*/,
];

module.exports = config;
