import { defineConfig } from "@playwright/test"

const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH?.trim() || undefined
const video = process.env.PLAYWRIGHT_DISABLE_VIDEO === "1" ? "off" : "retain-on-failure"

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  outputDir: "../output/playwright/test-results",
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["line"], ["html", { outputFolder: "../output/playwright/report", open: "never" }]]
    : "line",
  use: {
    baseURL: "http://127.0.0.1:8787",
    launchOptions: executablePath ? { executablePath } : undefined,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video,
  },
  projects: [
    { name: "desktop-1920", use: { viewport: { width: 1920, height: 1080 } } },
    { name: "desktop-1366", use: { viewport: { width: 1366, height: 768 } } },
    {
      name: "desktop-125-percent",
      use: { viewport: { width: 1536, height: 864 }, deviceScaleFactor: 1.25 },
    },
    {
      name: "mobile-390",
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: "npm --prefix .. run serve",
    url: "http://127.0.0.1:8787/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
