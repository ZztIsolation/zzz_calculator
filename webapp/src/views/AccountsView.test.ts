import { defineComponent } from "vue"
import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ accountStore: null as any }))

vi.mock("@/stores/account", async () => {
  const { reactive } = await import("vue")
  mocks.accountStore = reactive({
    loadState: "ready",
    error: "",
    currentOwnerId: "default",
    owners: [
      {
        id: "default",
        label: "myself",
        driveDiscCount: 6,
        loadoutCount: 1,
        importCount: 1,
        enkaUid: "12199509",
      },
      {
        id: "second",
        label: "second",
        driveDiscCount: 0,
        loadoutCount: 0,
        importCount: 0,
        enkaUid: null,
      },
    ],
    ensureLoaded: vi.fn(),
    switchTo: vi.fn(),
    rename: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
  })
  return { useAccountStore: () => mocks.accountStore }
})

import AccountsView from "@/views/AccountsView.vue"

const PassStub = defineComponent({
  inheritAttrs: false,
  template: `<div v-bind="$attrs"><slot/><slot name="icon"/><slot name="action"/></div>`,
})

describe("AccountsView", () => {
  it("labels the public showcase binding as the game UID", () => {
    const wrapper = mount(AccountsView, {
      global: {
        stubs: {
          NAlert: PassStub,
          NButton: PassStub,
          NInput: PassStub,
          NModal: PassStub,
          NTag: PassStub,
          ConfirmDialog: PassStub,
        },
      },
    })

    expect(wrapper.findAll("dt").filter(node => node.text() === "游戏 UID")).toHaveLength(2)
    expect(wrapper.text()).toContain("12199509")
    expect(wrapper.text()).toContain("未绑定")
    expect(wrapper.text()).not.toContain("Enka UID")
  })
})
