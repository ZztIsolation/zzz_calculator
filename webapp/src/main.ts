import { createPinia } from "pinia"
import { createApp } from "vue"
import App from "@/App.vue"
import { router } from "@/router"
import { useAppConfigStore } from "@/stores/app-config"
import { recoverPendingEnkaImport } from "@runtime/enka-import-transaction"
import { loadUserDriveDiscStore } from "@runtime/local-store.js"
import "@/styles/tokens.css"

async function bootstrap() {
  const pinia = createPinia()
  let startupError = ""
  try {
    const store = await loadUserDriveDiscStore()
    await recoverPendingEnkaImport(String(store?.currentOwnerId ?? "default"))
  } catch (error) {
    startupError = `未完成的 Enka 导入自动恢复失败，请刷新页面后再修改配置：${error instanceof Error ? error.message : String(error)}`
  }
  try {
    await useAppConfigStore(pinia).load()
  } catch {
    // The store starts with all optional feature flags disabled.
  }

  createApp(App, { startupError })
    .use(pinia)
    .use(router)
    .mount("#app")
}

void bootstrap()
