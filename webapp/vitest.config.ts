import path from "node:path"
import { fileURLToPath } from "node:url"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vitest/config"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@core": path.resolve(__dirname, "../core"),
      "@runtime": path.resolve(__dirname, "src/runtime"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
})
