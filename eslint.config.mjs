import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig({
  languageOptions: {
    ecmaVersion: "latest",
    globals: {
      ...globals.browser,
      ...globals.node,
    },
  },
  rules: {
    "no-unused-vars": "warn",
    "no-undef": "error",
  },
});

