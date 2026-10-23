import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { createPinia, setActivePinia } from "pinia"
import { useOptimizerStore } from "./optimizer"
import { useAccountStore } from "./account"
import { readBuildSelectionDocument, writeBuildSelectionDocument } from "@runtime/build-storage"
import { loadUserDriveDiscStoreFresh } from "@runtime/local-store.js"

class WorkerStub {
  static instances: WorkerStub[] = []
  onmessage: any
  onerror: any
  messages: any[] = []
  terminate = vi.fn()
  constructor() { WorkerStub.instances.push(this) }
  postMessage(message: any) { this.messages.push(message) }
}
const source = { currentOwnerId: "default", owners: [{ id: "default" }], driveDiscs: [] }

beforeEach(() => {
  vi.stubGlobal("indexedDB", undefined)
  localStorage.clear()
  setActivePinia(createPinia())
  WorkerStub.instances = []
  vi.stubGlobal("Worker", WorkerStub)
})
afterEach(() => { useOptimizerStore().disposeRuntime(); vi.unstubAllGlobals() })

describe("context and persistence safety", () => {
  it("reset terminates the task, settles its promise and ignores queued success and error callbacks", async () => {
    const store = useOptimizerStore()
    const pending = store.run({}, source, { ownerId: "default", agentId: "miyabi" })
    const worker = WorkerStub.instances[0]
    const lateMessage = worker.onmessage
    const lateError = worker.onerror
    const id = worker.messages[0].runId
    store.reset()
    expect(worker.terminate).toHaveBeenCalledOnce()
    await pending
    lateMessage({ data: { type: "complete", runId: id, result: { results: [{ rank: 1 }] } } })
    lateError({ message: "late error" })
    expect(store.status).toBe("idle")
    expect(store.resultSchemes).toEqual([])
    expect(store.error).toBe("")
  })

  it("reset also settles preview and rejects queued preview callbacks", async () => {
    const store = useOptimizerStore()
    const pending = store.preview({}, source, { agentId: "miyabi" })
    const worker = WorkerStub.instances[0]
    const callback = worker.onmessage
    store.reset()
    expect(worker.terminate).toHaveBeenCalledOnce()
    await pending
    callback({ data: { type: "preview", runId: worker.messages[0].runId, preview: { metrics: { evaluated: 88 } } } })
    expect(store.progress).toBeNull()
  })

  it("rejects duplicate account mutations while preserving the successful operation", async () => {
    const accounts = useAccountStore()
    await accounts.load()
    const first = accounts.create("新账号")
    expect(accounts.operation).toBe("create")
    await expect(accounts.create("重复账号")).rejects.toThrow("执行中")
    await first
    expect(accounts.operation).toBe("")
    expect(accounts.owners.filter((owner: any) => owner.label === "新账号")).toHaveLength(1)
    expect(accounts.owners.some((owner: any) => owner.label === "重复账号")).toBe(false)
  })

  it("retains malformed fallback inventory instead of treating it as empty", async () => {
    const raw = '{"driveDiscs": ['
    localStorage.setItem("zzz-calculator.userStore.v1", raw)
    await expect(loadUserDriveDiscStoreFresh()).rejects.toThrow("无法解析")
    expect(localStorage.getItem("zzz-calculator.userStore.v1")).toBe(raw)
  })

  it("keeps broken build and optimizer settings instead of replacing them with defaults", () => {
    localStorage.setItem("zzz-calculator.webapp.build.v1", "broken")
    expect(() => readBuildSelectionDocument()).toThrow("无法解析")
    expect(() => writeBuildSelectionDocument({ version: 2 })).toThrow("无法解析")
    expect(localStorage.getItem("zzz-calculator.webapp.build.v1")).toBe("broken")
    localStorage.setItem("zzz-calculator.webapp.optimizer.v1", "broken")
    expect(() => useOptimizerStore().initialize()).toThrow("无法解析")
    expect(localStorage.getItem("zzz-calculator.webapp.optimizer.v1")).toBe("broken")
  })
})
