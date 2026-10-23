import { defineConfig } from "@playwright/test"
import base from "./playwright.config"

/*
 * 外观截图对比：放在独立目录与配置里，默认的 `npm run test:layout`（以及 CI）不会运行。
 * 截图基线与操作系统、字体有关，基线按平台分目录保存；在哪个平台对比，就要先在该平台生成基线：
 *   npm run test:visual:update   # 生成或更新基线（确认界面变化是预期的之后再运行）
 *   npm run test:visual          # 与基线逐像素对比
 */
export default defineConfig({
  ...base,
  testDir: "./e2e-visual",
  testMatch: "**/*.visual.ts",
  outputDir: "../output/playwright/visual-results",
  snapshotPathTemplate: "{testDir}/__screenshots__/{platform}/{projectName}/{arg}{ext}",
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      // 允许极少量抗锯齿差异，避免字体渲染抖动造成误报
      maxDiffPixelRatio: 0.002,
    },
  },
  projects: [
    { name: "desktop-1440-light", use: { viewport: { width: 1440, height: 1000 }, colorScheme: "light" } },
    { name: "desktop-1440-dark", use: { viewport: { width: 1440, height: 1000 }, colorScheme: "dark" } },
    {
      name: "mobile-390",
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: "light" },
    },
  ],
})
