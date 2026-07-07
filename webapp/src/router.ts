import { createRouter, createWebHistory } from "vue-router"

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "workbench", component: () => import("@/views/WorkbenchView.vue") },
    { path: "/discs", name: "discs", component: () => import("@/views/DiscsView.vue") },
    { path: "/accounts", name: "accounts", component: () => import("@/views/AccountsView.vue") },
    { path: "/maintenance", redirect: "/maintenance.html" },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
})
