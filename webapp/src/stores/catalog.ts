import { defineStore } from "pinia"
import { markRaw } from "vue"
import { loadCatalog, loadMeta } from "@runtime/catalog-loader.js"
import { auditIconCoverage } from "@/utils/assets"

export const useCatalogStore = defineStore("catalog", {
  state: () => ({
    catalog: null as any,
    meta: null as any,
    loading: false,
    error: "",
  }),
  getters: {
    agents: state => state.meta?.agents ?? [],
    displayAgents: state => state.meta?.displayAgents ?? state.catalog?.displayAgents ?? state.meta?.agents ?? [],
    displayAgentSkills: state => state.meta?.displayAgentSkills ?? state.meta?.agentSkills ?? [],
    wEngines: state => state.meta?.wEngines ?? [],
    displayWEngines: state => state.meta?.displayWEngines ?? state.catalog?.displayWEngines ?? state.meta?.wEngines ?? [],
    driveDiscSets: state => state.catalog?.driveDiscSets ?? [],
    displayDriveDiscSets: state => state.meta?.displayDriveDiscSets ?? state.catalog?.displayDriveDiscSets ?? state.catalog?.driveDiscSets ?? [],
    combatBuffs: state => state.meta?.combatBuffs ?? [],
    iconAudit: state => auditIconCoverage(state.meta),
  },
  actions: {
    async load() {
      if (this.catalog && this.meta) {
        return
      }
      this.loading = true
      this.error = ""
      try {
        const [catalog, meta] = await Promise.all([loadCatalog(), loadMeta()])
        this.catalog = markRaw(catalog)
        this.meta = markRaw(meta)
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error)
      } finally {
        this.loading = false
      }
    },
  },
})
