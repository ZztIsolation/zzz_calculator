import { describe, expect, it } from "vitest"
import catalog from "../../../../data/w_engines.json"
import { prepareDraft } from "./maintenance-model"
import { defaultRuntimeForBuff, materializeWEngineForModificationLevel, normalizeRuntimeForBuff, runtimeStackGroups, storedEffectRulesText } from "@core/shared-combat.js"

describe("new anomaly W-Engine editor and runtime roundtrips", () => {
  for (const id of ["zzz_wiki_1964", "zzz_wiki_841", "zzz_wiki_2087", "zzz_wiki_154"]) {
    it(`${id} preserves effects, exact refinement values and runtime inputs`, () => {
      const source = catalog.wEngines.find(item => item.id === id)!
      const draft = prepareDraft("w-engines", source)
      const restored = prepareDraft("w-engines", JSON.parse(JSON.stringify(draft)))
      expect(restored.effect.selfBuff.effects).toEqual(source.effect.selfBuff!.effects)
      expect(restored.effect.description).toMatchObject(source.effect.description)
      expect(restored.level60).toEqual(source.level60)

      const refined = materializeWEngineForModificationLevel(restored, 5)
      const buff = refined.effect.selfBuff
      const groups = runtimeStackGroups(buff)
      expect(groups).toHaveLength(id === "zzz_wiki_2087" ? 0 : 1)
      const runtime = defaultRuntimeForBuff(buff)
      // Like the picker, update every rule belonging to the one visible control.
      for (const group of groups) {
        for (const ruleId of group.ruleIds) runtime.effects[ruleId].stacks = id === "zzz_wiki_1964" ? 1 : 4
      }
      for (const rule of buff.effects) runtime.effects[rule.id].coverage = 0.5
      const saved = normalizeRuntimeForBuff(buff, JSON.parse(JSON.stringify(runtime)))
      expect(saved).toEqual(runtime)
      const text = storedEffectRulesText(buff, saved)
      if (id === "zzz_wiki_1964") {
        expect(text).toContain("+16%")
        expect(text).toContain("+0%")
        expect(text).toContain("异放")
      } else if (id === "zzz_wiki_841") {
        expect(text).toContain("+14%")
        expect(text).toMatch(/精通.*\+0/)
      } else if (id === "zzz_wiki_2087") {
        expect(text).toContain("+9.2%")
      } else {
        expect(text).toContain("+8%")
      }
    })
  }
})
