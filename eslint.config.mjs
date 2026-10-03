import js from "@eslint/js";
import ts from "typescript-eslint";
import prettier from "eslint-config-prettier";
export default ts.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.envio/**",
      "**/out/**",
      "**/lib/forge-std/**",
      "**/test-results/**",
      "**/*.tsbuildinfo",
      "**/cache/**",
      "**/abis/**",
      "**/next-env.d.ts",
      "**/envio-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  prettier,
  {
    files: ["**/*.{ts,tsx,js,mjs}"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        fetch: "readonly",
        URL: "readonly",
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        queueMicrotask: "readonly",
        AbortSignal: "readonly",
        performance: "readonly",
        Request: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
    },
  },
);
