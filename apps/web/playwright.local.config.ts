import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: [
    "account.spec.ts",
    "journey.spec.ts",
    "pact-wizard.spec.ts",
    "local-v2.spec.ts",
    "marketplace-v2.spec.ts",
    "responsive.spec.ts",
    "accessibility.spec.ts",
  ],
  workers: 1,
  timeout: 300000,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3011",
    headless: true,
    launchOptions: process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : process.platform === "darwin"
        ? {
            executablePath:
              "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          }
        : {},
    actionTimeout: 20000,
    navigationTimeout: 30000,
    trace: "retain-on-failure",
  },
  outputDir: "test-results/local-v2",
});
