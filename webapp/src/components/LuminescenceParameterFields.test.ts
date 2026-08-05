import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { NInputNumber } from "naive-ui"
import LuminescenceParameterFields from "@/components/LuminescenceParameterFields.vue"
import {
  LUMINESCENCE_DAMAGE_SHARE_ERROR,
  LUMINESCENCE_TEAMMATE_ATTACK_ERROR,
  resolveLuminescenceParameters,
} from "@/utils/luminescenceParameters"

describe("LuminescenceParameterFields", () => {
  it("uses defaults only when the fields are absent", () => {
    expect(resolveLuminescenceParameters({})).toMatchObject({
      teammateAttack: 2800,
      luminescenceDamageSharePct: 50,
      errors: [],
      valid: true,
    })

    const wrapper = mount(LuminescenceParameterFields, { props: { event: {} } })
    const inputs = wrapper.findAllComponents(NInputNumber)
    expect(inputs).toHaveLength(2)
    expect(wrapper.get('[data-testid="luminescence-teammate-attack"]')).toBeTruthy()
    expect(wrapper.get('[data-testid="luminescence-damage-share"]')).toBeTruthy()
    expect(inputs[0].props("value")).toBe(2800)
    expect(inputs[1].props("value")).toBe(50)
    expect(wrapper.text()).toContain("可以参考危局、防卫战结束时蕾米埃尔的伤害占比，约等于耀变伤害占比。普遍而言，丹的影画越高，耀变伤害占比越高。")
    expect(wrapper.find('[aria-label="耀变伤害占比说明"]').exists()).toBe(false)
  })

  it("preserves explicit empty and out-of-range values as visible errors", () => {
    const event = {
      teammateAttack: null,
      luminescenceDamageSharePct: 125,
      records: [{ kind: "normal", T: 3150 }],
    }
    expect(resolveLuminescenceParameters(event)).toEqual({
      teammateAttack: null,
      luminescenceDamageSharePct: 125,
      teammateAttackError: LUMINESCENCE_TEAMMATE_ATTACK_ERROR,
      luminescenceDamageSharePctError: LUMINESCENCE_DAMAGE_SHARE_ERROR,
      errors: [LUMINESCENCE_TEAMMATE_ATTACK_ERROR, LUMINESCENCE_DAMAGE_SHARE_ERROR],
      valid: false,
    })

    const wrapper = mount(LuminescenceParameterFields, { props: { event } })
    const inputs = wrapper.findAllComponents(NInputNumber)
    expect(inputs[0].props("value")).toBeNull()
    expect(inputs[1].props("value")).toBe(125)
    expect(inputs[0].attributes("aria-invalid")).toBe("true")
    expect(inputs[1].attributes("aria-invalid")).toBe("true")
    expect(wrapper.text()).toContain(LUMINESCENCE_TEAMMATE_ATTACK_ERROR)
    expect(wrapper.text()).toContain(LUMINESCENCE_DAMAGE_SHARE_ERROR)
  })

  it("accepts boundary and decimal values while rejecting both sides of the range", () => {
    for (const luminescenceDamageSharePct of [0, 62.5, 100]) {
      expect(resolveLuminescenceParameters({ teammateAttack: 0, luminescenceDamageSharePct })).toMatchObject({
        teammateAttack: 0,
        luminescenceDamageSharePct,
        valid: true,
      })
    }
    expect(resolveLuminescenceParameters({ teammateAttack: -1, luminescenceDamageSharePct: 50 }).valid).toBe(false)
    expect(resolveLuminescenceParameters({ teammateAttack: 2800, luminescenceDamageSharePct: -1 }).valid).toBe(false)
    expect(resolveLuminescenceParameters({ teammateAttack: 2800, luminescenceDamageSharePct: 101 }).valid).toBe(false)
  })

  it("supports legacy attack input and emits minimal event patches", async () => {
    const wrapper = mount(LuminescenceParameterFields, {
      props: {
        event: {
          records: [{ type: "ordinary", teammateAtk: 3150 }],
        },
      },
    })
    const inputs = wrapper.findAllComponents(NInputNumber)
    expect(inputs[0].props("value")).toBe(3150)

    await inputs[0].vm.$emit("update:value", 3200)
    await inputs[1].vm.$emit("update:value", 62.5)
    expect(wrapper.emitted("update")).toEqual([
      [{ teammateAttack: 3200 }],
      [{ luminescenceDamageSharePct: 62.5 }],
    ])
  })

  it("uses an accessible tooltip in compact mode and responsive field tracks", () => {
    const wrapper = mount(LuminescenceParameterFields, {
      props: { event: {}, variant: "compact" },
    })
    expect(wrapper.attributes("data-variant")).toBe("compact")
    expect(wrapper.find('[aria-label="耀变伤害占比说明"]').exists()).toBe(true)
    expect(wrapper.find(".luminescence-parameter-help-text").exists()).toBe(false)

    const componentPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "LuminescenceParameterFields.vue")
    const source = readFileSync(componentPath, "utf8")
    expect(source).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));")
    expect(source).toContain("container: luminescence-parameters / inline-size;")
    expect(source).toContain("@container luminescence-parameters (max-width: 440px)")
    expect(source).toContain("@media (max-width: 390px)")
  })

  it("disables both inputs with the shared disabled state", () => {
    const wrapper = mount(LuminescenceParameterFields, {
      props: { event: {}, disabled: true },
    })
    const inputs = wrapper.findAllComponents(NInputNumber)
    expect(inputs[0].props("disabled")).toBe(true)
    expect(inputs[1].props("disabled")).toBe(true)
  })
})
