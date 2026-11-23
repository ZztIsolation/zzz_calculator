import { mount } from "@vue/test-utils"
import { NSelect } from "naive-ui"
import { reactive } from "vue"
import EffectRulesEditor from "./EffectRulesEditor.vue"

describe("EffectRulesEditor", () => {
  it("displays and edits potentialVisionScaling formula parameter sources without corePassiveScaling", async () => {
    const model = reactive<any>({
      scope: "inCombat",
      effects: [
        {
          id: "burnice-potential-anomaly-mastery",
          type: "formula",
          scope: "inCombat",
          stat: "anomalyMasteryFlat",
          mode: "flat",
          target: { kind: "default" },
          source: {
            kind: "outOfCombatStat",
            stat: "energyRegen",
            unit: "storedValue",
            label: { zhCN: "柏妮思初始能量自动回复" },
            variable: "x",
          },
          formula: {
            expression: "clamp(floor(max(x - 1.8, 0) * 10 + 0.0001) * rate, 0, 25)",
            parameters: { rate: 0 },
            parameterSources: {
              rate: { kind: "potentialVisionScaling", field: "potentialMasteryPerTenth" },
            },
            valueUnit: "storedValue",
          },
        },
      ],
    })
    const potentialVisionScaling = {
      name: { zhCN: "潜能觉醒：沸点派对" },
      levels: [
        { level: 0, potentialMasteryPerTenth: 0, potentialDmgBonusPerTenth: 0 },
        { level: 1, potentialMasteryPerTenth: 0, potentialDmgBonusPerTenth: 0 },
        { level: 2, potentialMasteryPerTenth: 1, potentialDmgBonusPerTenth: 1 },
      ],
    }

    const wrapper = mount(EffectRulesEditor, {
      props: {
        model,
        catalog: { meta: {}, agents: { agents: [] }, agentSkills: { agentSkills: [] } },
        allowCoverage: true,
        corePassiveScaling: null,
        potentialVisionScaling,
      },
    })

    const sourceSelect = () => wrapper.findAllComponents(NSelect).find(component =>
      component.props("options")?.some((opt: any) => opt.value === "potential:potentialMasteryPerTenth"),
    )

    expect(sourceSelect()).toBeTruthy()
    expect(sourceSelect()!.props("value")).toBe("potential:potentialMasteryPerTenth")

    await sourceSelect()!.vm.$emit("update:value", "potential:potentialDmgBonusPerTenth")
    expect(model.effects[0].formula.parameterSources.rate).toEqual({
      kind: "potentialVisionScaling",
      field: "potentialDmgBonusPerTenth",
    })
    expect(model.effects[0].formula.parameters.rate).toBe(0)

    await sourceSelect()!.vm.$emit("update:value", "")
    expect(model.effects[0].formula.parameterSources).toBeUndefined()
    wrapper.unmount()
  })
})
