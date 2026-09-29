import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
    "storage/**",
    ".data/**",
    // Installed agent skills: third-party CommonJS helper scripts, gitignored and not part of the
    // app. Linting them only reports `require()` in files where `require()` is correct.
    ".claude/**",
  ]),
]);

export default eslintConfig;
