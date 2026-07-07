import vue from "@vitejs/plugin-vue"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")
const frontendDir = path.join(rootDir, "frontend")

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@core": frontendDir,
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
    outDir: path.join(rootDir, "dist", "pages"),
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
          if (normalizedId.includes("frontend/scanner-bridge")) {
            return "scanner"
          }
          if (normalizedId.includes("frontend/driveDiscOptimizer-core") || normalizedId.includes("optimizer.worker")) {
            return "optimizer-core"
          }
          if (normalizedId.includes("frontend/calculator-core") || normalizedId.includes("frontend/shared-combat")) {
            return "calculator-core"
          }
        },
      },
    },
  },
})
