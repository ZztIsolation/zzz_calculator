import { defineStore } from "pinia"
import { deleteAccount as planDeleteInventoryAccount } from "@core/inventory-model.js"
import { buildDriveDiscImportTransactionPlan } from "@core/drive-disc-import/transaction-plan.js"
import {
  accountSummary,
  createAccount,
  loadUserDriveDiscStoreFresh,
  switchAccount,
  updateAccount,
} from "@runtime/local-store.js"
import {
  readBuildSelectionDocument,
  readLegacySelectionDocument,
} from "@runtime/build-storage"
import { commitDriveDiscImportPlan } from "@runtime/drive-disc-import-transaction"
import { recoverPendingEnkaImport } from "@runtime/enka-import-transaction"
import { setCurrentAccountId } from "@runtime/selection-storage.js"

function withoutOwnerSelection(document: any, ownerId: string, currentOwnerId: string): any {
  const source = document && typeof document === "object" && !Array.isArray(document)
    ? JSON.parse(JSON.stringify(document))
    : { version: 2, currentOwnerId, byOwner: {} }
  if (source.byOwner && typeof source.byOwner === "object") {
    delete source.byOwner[ownerId]
    if (source.currentOwnerId === ownerId) source.currentOwnerId = currentOwnerId
    return source
  }
  if (ownerId !== "default") return source
  return { version: 2, currentOwnerId, byOwner: {} }
}

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
      await recoverPendingEnkaImport(id)
      this.summary = await switchAccount(id)
      setCurrentAccountId(this.currentOwnerId)
    },
    async remove(id: string) {
      await recoverPendingEnkaImport(id)
      const store = await loadUserDriveDiscStoreFresh()
      const deletion = planDeleteInventoryAccount(store, id)
      const buildSelection = readBuildSelectionDocument()
      const legacySelection = readLegacySelectionDocument()
      const nextOwnerId = String(deletion.nextStore.currentOwnerId ?? "default")
      const transactionId = String(globalThis.crypto?.randomUUID?.() ?? `account-delete-${Date.now()}`)
      const plan = buildDriveDiscImportTransactionPlan({
        kind: "account-delete",
        ownerId: id,
        transactionId,
        store,
        nextStore: deletion.nextStore,
        buildSelection,
        legacySelection,
        nextBuildSelection: withoutOwnerSelection(buildSelection, id, nextOwnerId),
        nextLegacySelection: withoutOwnerSelection(legacySelection, id, nextOwnerId),
        metadata: { deletedOwnerId: id },
      })
      await commitDriveDiscImportPlan(plan)
      this.summary = await accountSummary()
      setCurrentAccountId(this.currentOwnerId)
    },
  },
})
