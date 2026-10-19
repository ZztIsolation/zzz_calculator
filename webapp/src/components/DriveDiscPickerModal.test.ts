import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"
import DriveDiscPickerModal from "@/components/DriveDiscPickerModal.vue"

vi.mock("naive-ui", () => ({
  NButton: {
    props: ["disabled"],
    emits: ["click"],
    template: "<button v-bind=\"$attrs\" :disabled=\"disabled\" @click=\"$emit('click', $event)\"><slot /></button>",
  },
  NInput: {
    inheritAttrs: false,
    props: ["value"],
    emits: ["update:value"],
    template: "<input v-bind=\"$attrs\" :value=\"value\" @input=\"$emit('update:value', $event.target.value)\">",
  },
  NModal: {
    props: ["show", "title"],
    emits: ["update:show"],
    template: "<section v-if=\"show\"><h2>{{ title }}</h2><slot /><slot name=\"footer\" /></section>",
  },
  NSelect: {
    props: ["value", "options"],
    template: "<select><option v-for=\"option in options\" :key=\"option.value\" :value=\"option.value\">{{ option.label }}</option></select>",
  },
  NTag: {
    props: ["type"],
    template: "<span v-bind=\"$attrs\" :data-type=\"type\"><slot /></span>",
  },
}))

const driveDiscSets = [{
  id: "woodpecker_electro",
  name: { zhCN: "啄木鸟电音" },
  images: {},
}]

const mixedDisc = {
  id: "canonical-disc",
  setId: "woodpecker_electro",
  setName: "啄木鸟电音",
  partition: 1,
  rarity: "S",
  level: 15,
  mainStat: { stat: "hpFlat", value: 2200 },
  subStats: [{ stat: "critRate", value: 4.8 }],
  source: { type: "enka-zzz-showcase" },
  provenance: {
    version: 1,
    calculatorJson: { sourceRecordId: "json-record" },
    scanner: { lastSequence: 33 },
    enkaZzz: { uid: "1302309616", equipmentUid: "equipment-1" },
  },
}

describe("DriveDiscPickerModal provenance", () => {
  it("pages the visible rows but searches the complete inventory and resets the page", async () => {
    const discs = Array.from({ length: 123 }, (_, index) => ({ ...mixedDisc, id: `disc-${String(index).padStart(3, '0')}`, source: null, provenance: null }))
    const wrapper = mount(DriveDiscPickerModal, { props: { show: true, slot: 1, discs, driveDiscSets } })
    expect(wrapper.findAll('.manual-disc-option')).toHaveLength(10)
    await wrapper.findAll('button').find(button => button.text() === '下一页')!.trigger('click')
    expect(wrapper.text()).toContain('第 2 / 13 页')
    await wrapper.get('input[aria-label="搜索驱动盘"]').setValue('disc-122')
    expect(wrapper.findAll('.manual-disc-option')).toHaveLength(1)
    expect(wrapper.text()).toContain('第 1 / 1 页')
    await wrapper.get('.manual-disc-option').trigger('click')
    expect(wrapper.emitted('select')?.[0]?.[0]).toMatchObject({ id: 'disc-122' })
  })
  it("shows all sources and uses provenance Scanner sequence for display, search, and aria", async () => {
    const wrapper = mount(DriveDiscPickerModal, {
      props: {
        show: true,
        slot: 1,
        discs: [mixedDisc],
        driveDiscSets,
        meta: { statRules: { driveDisc: { sRankSubStatBaseStep: { critRate: 2.4 } } } },
      },
    })

    const option = wrapper.get(".manual-disc-option")
    expect(option.find(".manual-disc-option-stat span").text()).toContain("暴击率% +1")
    expect(option.attributes("aria-label"))
      .toBe("选择 1号位 啄木鸟电音 来源 Enka、扫描器、JSON 扫描序号 33")
    expect(option.findAll(".drive-disc-source-tag").map(tag => tag.text().trim())).toEqual([
      "Enka",
      "扫描器 #33",
      "JSON",
    ])

    await wrapper.get('input[aria-label="搜索驱动盘"]').setValue("#33")
    expect(wrapper.findAll(".manual-disc-option")).toHaveLength(1)
    await wrapper.get('input[aria-label="搜索驱动盘"]').setValue("扫描器")
    expect(wrapper.findAll(".manual-disc-option")).toHaveLength(1)
    await wrapper.get('input[aria-label="搜索驱动盘"]').setValue("不存在")
    expect(wrapper.findAll(".manual-disc-option")).toHaveLength(0)
  })
})
