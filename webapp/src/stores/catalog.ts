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
    wEngines: state => state.meta?.wEngines ?? [],
    driveDiscSets: state => state.catalog?.driveDiscSets ?? [],
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
