import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { describe, expect, it } from "vitest"

const workerPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "optimizer.worker.ts")
const source = readFileSync(workerPath, "utf8")

describe("browser optimizer worker runtime", () => {
  it("forces strict serial execution without nested task workers", () => {
    expect(source).toContain('algorithm === "exact-super-bound-parallel"')
    expect(source).toContain('algorithm: algorithm ?? "exact-super-bound"')
    expect(source).toContain("disableParallel: true")
    expect(source).not.toContain("createBrowserParallelRunner")
    expect(source).not.toContain("optimizer-task.worker")
    expect(source).not.toContain("runParallel")
  })
})
