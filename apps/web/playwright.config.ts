import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir:"./tests",timeout:90000,workers:1,reporter:"list",use:{baseURL:"http://localhost:3001",headless:true,launchOptions:{executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"},viewport:{width:1440,height:1000}},outputDir:"test-results" });
