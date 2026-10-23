import { createPinia } from "pinia"
import { createApp } from "vue"
import App from "@/App.vue"
import { router } from "@/router"
import { useAccountStore } from "@/stores/account"
import { useAppConfigStore } from "@/stores/app-config"
import { recoverAllPendingDriveDiscImports } from "@runtime/drive-disc-import-transaction"
import { recoverPendingEnkaImport } from "@runtime/enka-import-transaction"
import { loadUserDriveDiscStoreFresh } from "@runtime/local-store.js"
import { formatStartupError } from "@runtime/startup-errors"
import { recoverPersonalRestore } from "@runtime/personal-backup"
import "@/styles/tokens.css"
import { initTheme } from "@/runtime/theme"
import "@/styles/workbench.css"

const STARTUP_RECOVERY_LOCK_TIMEOUT_MS = 5_000
initTheme()

async function bootstrap() {
  const pinia = createPinia()
  const accountStore = useAccountStore(pinia)
  let startupError = ""
  try {
    await recoverPersonalRestore()
    const recoveryLockOptions = {
      waitTimeoutMs: STARTUP_RECOVERY_LOCK_TIMEOUT_MS,
      purpose: "恢复未完成的驱动盘导入",
    }
    await recoverAllPendingDriveDiscImports(recoveryLockOptions)
    const store = await loadUserDriveDiscStoreFresh()
    const ownerIds = new Set([
      String(store?.currentOwnerId ?? "default"),
      ...(store?.owners ?? []).map((owner: any) => String(owner?.id ?? "")).filter(Boolean),
      ...Object.keys(store?.enkaImportState?.byOwner ?? {}),
    ])
    for (const ownerId of ownerIds) {
      await recoverPendingEnkaImport(ownerId, recoveryLockOptions)
    }
  } catch (error) {
    startupError = `${formatStartupError(error)}；也可尝试从完整个人备份恢复。`
  }
  if (!startupError) {
    try {
      await accountStore.ensureLoaded()
    } catch {
      // Account-dependent views expose the shared error state and retry action.
    }
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
