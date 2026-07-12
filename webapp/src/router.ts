import { createRouter, createWebHistory } from "vue-router"
import { loadAppConfig } from "@/runtime/app-config"

const includeMaintenance = import.meta.env.VITE_INCLUDE_MAINTENANCE !== "false"

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "workbench", component: () => import("@/views/WorkbenchView.vue") },
    { path: "/discs", name: "discs", component: () => import("@/views/DiscsView.vue") },
    { path: "/accounts", name: "accounts", component: () => import("@/views/AccountsView.vue") },
    ...(includeMaintenance
      ? [{ path: "/maintenance", name: "maintenance", component: () => import("@/views/MaintenanceView.vue") }]
      : []),
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
})

router.beforeEach(async to => {
  if (to.name !== "maintenance") {
    return true
  }
  const config = await loadAppConfig()
  return config.maintenanceEnabled ? true : { name: "workbench" }
})
