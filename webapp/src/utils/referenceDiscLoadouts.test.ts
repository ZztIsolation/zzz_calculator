import path from "node:path"
import { fileURLToPath } from "node:url"
import { createPinia, setActivePinia } from "pinia"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import { buildMeta, calculateInCombatPanel, loadCalculatorContext } from "../../../backend/calculator.js"
import { useBuildStore } from "@/stores/build"
import { referenceDiscLoadouts } from "@/utils/referenceDiscLoadouts"

describe("挽昼参考配装", () => {
  let catalog: any
  let meta: any
  beforeAll(async () => {
    catalog = await loadCalculatorContext(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.."))
    meta = buildMeta(catalog)
  })
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it("空槽位默认使用星之碑四件与火伤两件，另外四套都能直接参与计算", () => {
    const store = useBuildStore()
    store.applyAgentConfig("sunbringer", meta, { discMode: "manual", manualDriveDiscIdsBySlot: {} })
    const loadouts = referenceDiscLoadouts("sunbringer", meta)
    expect(store.discMode).toBe("loadout")
    expect(store.selectedLoadoutId).toBe(loadouts[0].id)
    expect(loadouts.map(loadout => loadout.driveDiscs[5].setId))
      .toEqual(["inferno_metal", "soul_rock", "woodpecker_electro", "zzz_wiki_2121", "puffer_electro"])
    const baseline = calculateInCombatPanel(catalog, store.buildInput(catalog, meta, []))
    for (const loadout of loadouts) {
      const discs = loadout.driveDiscs
      expect(discs.filter(disc => disc.setId === (discs[5].setId === "puffer_electro" ? "zzz_wiki_2121" : "monument_of_the_star"))).toHaveLength(4)
      const result = calculateInCombatPanel(catalog, store.buildInput(catalog, meta, discs))
      expect(result.damage.totalFinalDamage).toBeGreaterThan(baseline.damage.totalFinalDamage)
      if (discs[5].setId === "zzz_wiki_2121") {
        const withoutPair = discs.map((disc, i) => i < 4 ? disc : { ...disc, setId: i === 4 ? "soul_rock" : "inferno_metal" })
        const control = calculateInCombatPanel(catalog, store.buildInput(catalog, meta, withoutPair))
        const base = result.outOfCombat.baseBreakdown
        expect(result.outOfCombat.panel.def - control.outOfCombat.panel.def)
          .toBeCloseTo((base.agent.def + base.wEngine.def) * .16, 0)
      }
      if (discs[5].setId === "puffer_electro") {
        expect(discs[4].mainStat).toEqual({ stat: "penRatio", value: 24 })
        expect(result.outOfCombat.panel.penRatio - baseline.outOfCombat.panel.penRatio).toBeCloseTo(.32)
      }
    }
  })

  it("保留已有的手选盘和套装；参考方案及后续主动改回的空槽均可恢复", async () => {
    const store = useBuildStore()
    store.applyAgentConfig("sunbringer", meta, { manualDriveDiscIdsBySlot: { 3: "my-disc" } })
    expect(store.discMode).toBe("manual")
    expect(store.manualDriveDiscIdsBySlot).toEqual({ 3: "my-disc" })
    store.applyAgentConfig("sunbringer", meta, { discMode: "loadout", selectedLoadoutId: "my-loadout" })
    expect(store.selectedLoadoutId).toBe("my-loadout")
    const rose = referenceDiscLoadouts("sunbringer", meta).find(item => item.driveDiscs[5].setId === "puffer_electro")!
    store.selectLoadout(rose.id)
    await store.persist()
    store.initialize(catalog, meta)
    expect(store.selectedLoadoutId).toBe(rose.id)
    store.selectLoadout("")
    store.setDiscMode("manual")
    await store.persist()
    store.initialize(catalog, meta)
    expect(store.discMode).toBe("manual")
    expect(store.selectedLoadoutId).toBe("")
  })
})
