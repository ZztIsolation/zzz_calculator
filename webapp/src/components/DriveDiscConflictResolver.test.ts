import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"
import DriveDiscConflictResolver from "@/components/DriveDiscConflictResolver.vue"

vi.mock("naive-ui", () => ({
  NTag: {
    props: ["type"],
    template: "<span v-bind=\"$attrs\" :data-type=\"type\"><slot /></span>",
  },
}))

function disc(id: string, level: number, value: number, source: "scanner" | "enka" = "scanner") {
  return {
    id,
    setId: "woodpecker_electro",
    setName: "啄木鸟电音",
    partition: 4,
    rarity: "S",
    level,
    mainStat: { stat: "critRate", mode: "pct", value: 24 },
    subStats: [{ stat: "critDmg", mode: "pct", value }],
    provenance: source === "scanner"
      ? { version: 1, scanner: { lastSequence: 17 } }
      : { version: 1, enkaZzz: { uid: "1300000000", equipmentUid: id } },
  }
}

const longImportedId = "scanner-import-with-an-extremely-long-record-identifier-that-must-wrap-at-320px"
const firstCandidateId = "existing-disc-first"
const secondCandidateId = "existing-disc-second-with-an-equally-long-canonical-identifier"

const conflicts = [
  {
    key: "scanner:conflict-one",
    imported: disc(longImportedId, 15, 9.6),
    candidates: [
      disc(firstCandidateId, 12, 4.8, "enka"),
      disc(secondCandidateId, 10, 7.2),
    ],
    reason: "same-shape-different-content",
  },
  {
    key: "scanner:conflict-two",
    imported: disc("imported-second", 15, 12),
    candidates: [disc("existing-third", 9, 4.8)],
    agentName: "安比",
  },
]

describe("DriveDiscConflictResolver", () => {
  it("renders imported discs and every candidate with controlled resolutions", () => {
    const wrapper = mount(DriveDiscConflictResolver, {
      props: {
        conflicts,
        resolutions: {
          "scanner:conflict-one": { action: "update", existingId: secondCandidateId },
          "scanner:conflict-two": { action: "add" },
        },
      },
    })

    expect(wrapper.attributes("aria-label")).toBe("驱动盘疑似重复处理")
    expect(wrapper.findAll("article.drive-disc-conflict")).toHaveLength(2)
    expect(wrapper.findAll("fieldset")[0].text()).toContain("库存候选（2）")
    expect(wrapper.text()).toContain(longImportedId)
    expect(wrapper.text()).toContain(secondCandidateId)
    expect(wrapper.text()).toContain("安比")
    expect(wrapper.text()).toContain("扫描器 #17")
    expect(wrapper.text()).toContain("Enka")

    const radios = wrapper.findAll<HTMLInputElement>('input[type="radio"]')
    expect(radios).toHaveLength(5)
    expect(radios[0].attributes("aria-label")).toContain(`更新此盘：啄木鸟电音 4号位 · S +12 ID ${firstCandidateId}`)
    expect(radios[1].element.checked).toBe(true)
    expect(radios[2].attributes("aria-label")).toContain(`作为新盘：啄木鸟电音 4号位 · S +15 ID ${longImportedId}`)
    expect(radios[4].element.checked).toBe(true)
    expect(new Set(radios.slice(0, 3).map(radio => radio.attributes("name"))).size).toBe(1)
    expect(radios[3].attributes("name")).not.toBe(radios[0].attributes("name"))
  })

  it("emits the exact update or add decision for the selected conflict", async () => {
    const wrapper = mount(DriveDiscConflictResolver, {
      props: { conflicts, resolutions: {} },
    })
    const radios = wrapper.findAll('input[type="radio"]')

    await radios[0].trigger("change")
    await radios[2].trigger("change")

    expect(wrapper.emitted("resolve")).toEqual([
      [{ key: "scanner:conflict-one", action: "update", existingId: firstCandidateId }],
      [{ key: "scanner:conflict-one", action: "add" }],
    ])
  })

  it("keeps long identifiers and option grids safe in a 320px container", () => {
    const componentPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "DriveDiscConflictResolver.vue",
    )
    const source = readFileSync(componentPath, "utf8")

    expect(source).toContain("container: drive-disc-conflicts / inline-size;")
    expect(source).toContain("@container drive-disc-conflicts (max-width: 420px)")
    expect(source).toContain("grid-template-columns: 20px minmax(0, 1fr);")
    expect(source).toContain("overflow-wrap: anywhere;")
    expect(source).toContain("word-break: break-word;")
  })

  it("renders nothing when there are no conflicts", () => {
    const wrapper = mount(DriveDiscConflictResolver, {
      props: { conflicts: [], resolutions: {} },
    })
    expect(wrapper.find(".drive-disc-conflict-resolver").exists()).toBe(false)
  })

  it("disables every decision while the parent rebuilds the frozen plan", () => {
    const wrapper = mount(DriveDiscConflictResolver, {
      props: { conflicts, resolutions: {}, disabled: true },
    })
    expect(wrapper.attributes("aria-busy")).toBe("true")
    expect(wrapper.findAll<HTMLInputElement>('input[type="radio"]').every(radio => radio.element.disabled)).toBe(true)
  })
})
