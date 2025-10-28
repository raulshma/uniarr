// https://docs.expo.dev/guides/using-eslint/
const { defineConfig, globalIgnores } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const reactCompiler = require("eslint-plugin-react-compiler");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");

module.exports = defineConfig([
  globalIgnores([
    "dist/*",
    "android/*",
    "ios/*",
    "node_modules/*",
    "scripts/*",
    "coverage/*",
    "src/connectors/client-schemas/*",
    "src/connectors/openapi-specs/*",
    "assets/*",
  ]),
  expoConfig,
  eslintPluginPrettierRecommended,
  reactCompiler.configs.recommended,
  // Project-specific rule adjustments: convert some strict rules to warnings or disable
  // ones that are intentionally handled in code to make the lint run practical across
  // the large codebase during development.
  {
    rules: {
      // Display name warnings are noisy for many local components created inline
      // (we prefer to avoid sprinkling .displayName assignments everywhere).
      "react/display-name": "off",
      // The codebase contains many user-facing strings; allow unescaped entities.
      "react/no-unescaped-entities": "off",

      // React Compiler rule triggered because some components disable other rules;
      // keep it as a warning to surface potential issues.
      "react-compiler/react-compiler": "warn",

      // Expo flags dynamic env var access in a few places; relax to a warning.
      "expo/no-dynamic-env-var": "warn",
    },
  },
]);
