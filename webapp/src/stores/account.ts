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

export type AccountLoadState = "idle" | "loading" | "ready" | "error"

const pendingLoads = new WeakMap<object, Promise<any>>()
const summaryGenerations = new WeakMap<object, number>()

class AccountSummaryApplyError extends Error {}

function accountErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "").trim()
    if (message) return message
  }
  return String(error)
}

function applyAccountSummary(store: any, summary: any) {
  const ownerId = String(summary?.currentOwnerId ?? "").trim()
  try {
    if (!ownerId) throw new Error("账号数据缺少当前账号。")
    setCurrentAccountId(ownerId)
  } catch (error) {
    const failure = new AccountSummaryApplyError(accountErrorMessage(error))
    summaryGenerations.set(store, (summaryGenerations.get(store) ?? 0) + 1)
    store.loadState = "error"
    store.error = failure.message
    throw failure
  }
  summaryGenerations.set(store, (summaryGenerations.get(store) ?? 0) + 1)
  store.summary = summary
  store.loadState = "ready"
  store.error = ""
  return summary
}

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
    loadState: "idle" as AccountLoadState,
    error: "",
  }),
  getters: {
    owners: state => state.summary?.owners ?? [],
    loading: state => state.loadState === "loading",
    currentOwnerId: state => String(state.summary?.currentOwnerId ?? "").trim() || null,
    currentOwner: state => (state.summary?.owners ?? []).find((owner: any) => owner.id === state.summary?.currentOwnerId) ?? null,
    currentOwnerLabel: state => {
      const owner = (state.summary?.owners ?? []).find((item: any) => item.id === state.summary?.currentOwnerId)
      return String(owner?.label ?? "").trim() || null
    },
    ownerLabelById: state => (ownerId: string) => {
      const owner = (state.summary?.owners ?? []).find((item: any) => item.id === ownerId)
      return String(owner?.label ?? "").trim() || null
    },
  },
  actions: {
    ensureLoaded(options: { force?: boolean } = {}) {
      if (!options.force && this.loadState === "ready" && this.summary) {
        return Promise.resolve(this.summary)
      }
      const pending = pendingLoads.get(this)
      if (pending) return pending

      this.loadState = "loading"
      this.error = ""
      const generation = summaryGenerations.get(this) ?? 0
      const request = accountSummary()
        .then(summary => (summaryGenerations.get(this) ?? 0) === generation
          ? applyAccountSummary(this, summary)
          : this.summary)
        .catch(error => {
          if ((summaryGenerations.get(this) ?? 0) !== generation && !(error instanceof AccountSummaryApplyError)) {
            return this.summary
          }
          this.loadState = "error"
          this.error = accountErrorMessage(error)
          throw error
        })
        .finally(() => {
          if (pendingLoads.get(this) === request) pendingLoads.delete(this)
        })
      pendingLoads.set(this, request)
      return request
    },
    load() {
      return this.ensureLoaded({ force: true })
    },
    async create(label: string) {
      applyAccountSummary(this, await createAccount({ label }))
    },
    async rename(id: string, label: string) {
      applyAccountSummary(this, await updateAccount(id, { label }))
    },
    async switchTo(id: string) {
      await recoverPendingEnkaImport(id)
      applyAccountSummary(this, await switchAccount(id))
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
      applyAccountSummary(this, await accountSummary())
    },
  },
})
