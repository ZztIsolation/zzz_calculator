import { defineStore } from "pinia"
import {
  accountSummary,
  createAccount,
  deleteAccount,
  switchAccount,
  updateAccount,
} from "@core/local-store.js"
import { deleteOwnerSelection, setCurrentAccountId } from "@core/shared-combat.js"

export const useAccountStore = defineStore("account", {
  state: () => ({
    summary: null as any,
    loading: false,
    error: "",
  }),
  getters: {
    owners: state => state.summary?.owners ?? [],
    currentOwnerId: state => state.summary?.currentOwnerId ?? "default",
    currentOwner: state => (state.summary?.owners ?? []).find((owner: any) => owner.id === state.summary?.currentOwnerId),
  },
  actions: {
    async load() {
      this.loading = true
      this.error = ""
      try {
        this.summary = await accountSummary()
        setCurrentAccountId(this.currentOwnerId)
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error)
      } finally {
        this.loading = false
      }
    },
    async create(label: string) {
      this.summary = await createAccount({ label })
      setCurrentAccountId(this.currentOwnerId)
    },
    async rename(id: string, label: string) {
      this.summary = await updateAccount(id, { label })
    },
    async switchTo(id: string) {
      this.summary = await switchAccount(id)
      setCurrentAccountId(this.currentOwnerId)
    },
    async remove(id: string) {
      this.summary = await deleteAccount(id)
      deleteOwnerSelection(id)
      setCurrentAccountId(this.currentOwnerId)
    },
  },
})
