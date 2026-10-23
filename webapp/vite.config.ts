import vue from "@vitejs/plugin-vue"
import { copyFileSync, mkdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

import {
  assertBrowserCompatibilityBundle,
  assertBrowserCompatibilityOutputDirectory,
  assertBrowserCompatibilitySources,
} from "../scripts/browser-compatibility-guard.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")
const coreDir = path.join(rootDir, "core")
const runtimeDir = path.join(__dirname, "src", "runtime")
const pagesDir = path.join(rootDir, "dist", "pages")

function browserCompatibilityPlugin() {
  return {
    name: "zzz-browser-compatibility",
    buildStart() {
      assertBrowserCompatibilitySources(rootDir)
    },
    generateBundle(_options: unknown, bundle: Record<string, unknown>) {
      assertBrowserCompatibilityBundle(bundle)
    },
    writeBundle() {
      assertBrowserCompatibilityOutputDirectory(path.join(pagesDir, "static", "app"))
    },
  }
}

function scannerManifestPlugin() {
  return {
    name: "zzz-scanner-manifest",
    closeBundle() {
      const targetDir = path.join(pagesDir, "downloads", "zzz-scanner")
      mkdirSync(targetDir, { recursive: true })
      copyFileSync(path.join(rootDir, "config", "scanner-manifest.json"), path.join(targetDir, "manifest.json"))
    },
  }
}

export default defineConfig({
  plugins: [browserCompatibilityPlugin(), vue(), scannerManifestPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@core": coreDir,
      "@runtime": runtimeDir,
    },
  },
  server: {
    fs: {
      allow: [rootDir],
    },
    proxy: {
      "/api": "http://127.0.0.1:8787",
      "/assets": "http://127.0.0.1:8787",
      "/static": "http://127.0.0.1:8787",
      "/downloads": "http://127.0.0.1:8787",
    },
  },
  build: {
    outDir: pagesDir,
    emptyOutDir: true,
    assetsDir: "static/app",
    rollupOptions: {
      input: {
        app: path.resolve(__dirname, "index.html"),
        optimizerBenchmark: path.resolve(__dirname, "optimizer-benchmark.html"),
      },
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/")
          // naive-ui 不整包打成一个 chunk：按组件实际被哪些页面使用来拆分，
          // 日期选择器、数据表等只有内部页或维护页使用的组件不进入首屏。
          if (
            /node_modules\/(vue|@vue\/runtime-core|@vue\/runtime-dom|@vue\/reactivity|pinia|vue-router)\//.test(normalizedId)
          ) {
            return "vue-vendor"
          }
          if (normalizedId.includes("node_modules/lucide-vue-next")) {
            return "icons"
          }
          if (normalizedId.includes("webapp/src/runtime/scanner-bridge")) {
            return "scanner"
          }
          if (normalizedId.includes("core/driveDiscOptimizer-core") || normalizedId.includes("optimizer.worker")) {
            return "optimizer-core"
          }
          if (normalizedId.includes("core/calculator-core") || normalizedId.includes("core/shared-combat")) {
            return "calculator-core"
          }
        },
      },
    },
  },
})
