import { describe, expect, it } from "vitest"
import { applyDraftValue, mergeAgentDraft, parseAgentBaseline } from "./agentDraftMerge"

describe("role maintenance three-way merge", () => {
  it("retains a server-added rotation when an old draft changes only text", () => {
    const base = { id: "velina", name: { zhCN: "原始" } }
    const local = { ...base, name: { zhCN: "本机修改" } }
    const remote = { ...base, defaultCalculationConfig: { events: [{ id: "release" }] } }
    const result = mergeAgentDraft(base, local, remote)
    expect(result.conflicts).toEqual([])
    expect(result.merged).toEqual({ ...remote, name: local.name })
    expect(base.name.zhCN).toBe("原始")
    expect(remote.name.zhCN).toBe("原始")
  })
  it("accepts independent edits, identical edits, and one-sided deletions", () => {
    expect(mergeAgentDraft({ a: 1, b: 2 }, { a: 2, b: 2 }, { a: 1, b: 3 }).merged).toEqual({ a: 2, b: 3 })
    expect(mergeAgentDraft({ a: 1 }, { a: 2 }, { a: 2 }).conflicts).toEqual([])
    expect(mergeAgentDraft({ a: 1, b: 2 }, { b: 2 }, { a: 1, b: 3 }).merged).toEqual({ b: 3 })
  })
  it("reports scalar and deletion conflicts, preserving absent versus null", () => {
    const result = mergeAgentDraft({ a: 1, b: { nested: 1 } }, { a: null }, { a: 2, b: { nested: 2 } })
    expect(result.conflicts.map(c => c.path)).toEqual([["a"], ["b"]])
    expect(result.conflicts[1].local).toEqual({ present: false })
    expect(applyDraftValue(result.merged, ["b"], result.conflicts[1].remote)).toEqual({ a: null, b: { nested: 2 } })
    expect(applyDraftValue({ a: 1 }, ["a"], { present: false })).toEqual({})
  })
  it("never interleaves arrays or invents IDs", () => {
    const base = { events: [{ x: 1 }, { x: 2 }] }
    const result = mergeAgentDraft(base, { events: [{ x: 3 }, { x: 2 }] }, { events: [{ x: 1 }, { x: 4 }] })
    expect(result.conflicts.map(c => c.path)).toEqual([["events"]])
    expect(result.merged.events).toEqual([{ x: 3 }, { x: 2 }])
    expect(JSON.stringify(result)).not.toContain('"id"')
  })
  it("handles another update after a resolved merge", () => {
    const base = { a: 1, b: 1 }
    const firstRemote = { a: 2, b: 1 }
    const first = mergeAgentDraft(base, { a: 3, b: 1 }, firstRemote)
    const chosen = applyDraftValue(first.merged, ["a"], first.conflicts[0].local)
    expect(mergeAgentDraft(firstRemote, chosen, { a: 2, b: 2 }).merged).toEqual({ a: 3, b: 2 })
    expect(mergeAgentDraft(firstRemote, chosen, { a: 4, b: 2 }).conflicts).toHaveLength(1)
  })
  it("rejects missing, corrupt, or wrong-role legacy baselines", () => {
    for (const text of ["", "{", "null", '{"id":"other"}']) expect(parseAgentBaseline(text, "velina")).toBeNull()
    expect(parseAgentBaseline('{"id":"velina"}', "velina")).toEqual({ id: "velina" })
  })
})
