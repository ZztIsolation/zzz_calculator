import vue from "@vitejs/plugin-vue"
import { copyFileSync, mkdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")
const coreDir = path.join(rootDir, "core")
const runtimeDir = path.join(__dirname, "src", "runtime")
const pagesDir = path.join(rootDir, "dist", "pages")

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
  plugins: [vue(), scannerManifestPlugin()],
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
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/")
          if (
            normalizedId.includes("node_modules/naive-ui")
            || normalizedId.includes("node_modules/vueuc")
            || normalizedId.includes("node_modules/vooks")
            || normalizedId.includes("node_modules/css-render")
            || normalizedId.includes("node_modules/evtd")
          ) {
            return "naive-ui"
          }
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
