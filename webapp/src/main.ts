import { createPinia } from "pinia"
import { createApp } from "vue"
import App from "@/App.vue"
import { router } from "@/router"
import { useAppConfigStore } from "@/stores/app-config"
import "@/styles/tokens.css"

async function bootstrap() {
  const pinia = createPinia()
  try {
    await useAppConfigStore(pinia).load()
  } catch {
    // The store starts with all optional feature flags disabled.
  }

  createApp(App)
    .use(pinia)
    .use(router)
    .mount("#app")
}

void bootstrap()
