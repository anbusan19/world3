// Signs release builds with your own keystore instead of the debug key.
// Reads WRLD3_KEYSTORE (path), WRLD3_KEYSTORE_PASSWORD, WRLD3_KEY_ALIAS and WRLD3_KEY_PASSWORD from the environment at build time.
// Without them the release build falls back to the debug key, so a fresh clone still builds.
const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = (config) =>
  withAppBuildGradle(config, (c) => {
    let g = c.modResults.contents;
    if (g.includes('WRLD3_KEYSTORE')) return c;
    g = g.replace(
      /signingConfigs \{/,
      `signingConfigs {
        release {
            if (System.getenv('WRLD3_KEYSTORE')) {
                storeFile file(System.getenv('WRLD3_KEYSTORE'))
                storePassword System.getenv('WRLD3_KEYSTORE_PASSWORD')
                keyAlias System.getenv('WRLD3_KEY_ALIAS') ?: 'wrld3'
                keyPassword System.getenv('WRLD3_KEY_PASSWORD') ?: System.getenv('WRLD3_KEYSTORE_PASSWORD')
            }
        }`
    );
    g = g.replace(/(release \{\s*\/\/ Caution[^]*?)signingConfig signingConfigs\.debug/, `$1signingConfig System.getenv('WRLD3_KEYSTORE') ? signingConfigs.release : signingConfigs.debug`);
    c.modResults.contents = g;
    return c;
  });
