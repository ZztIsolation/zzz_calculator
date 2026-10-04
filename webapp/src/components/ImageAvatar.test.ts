import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import ImageAvatar from "@/components/ImageAvatar.vue"
import { fallbackIcon } from "@/utils/assets"

describe("ImageAvatar", () => {
  it("preserves original preview sources and lazy loading with asynchronous decoding", () => {
    const src = "/assets/agents/ye_shunguang.webp"
    const wrapper = mount(ImageAvatar, { props: { src, name: "叶瞬光" } })
    expect(wrapper.find("img").attributes()).toMatchObject({
      src, alt: "叶瞬光", loading: "lazy", decoding: "async",
    })
  })

  it("keeps the shared fallback and recovers when the image selection changes", async () => {
    const wrapper = mount(ImageAvatar, { props: { src: "/missing.webp" } })
    await wrapper.find("img").trigger("error")
    expect(wrapper.find("img").attributes("src")).toBe(fallbackIcon)
    await wrapper.setProps({ src: "/assets/agents/ye_shunguang.webp" })
    expect(wrapper.find("img").attributes("src")).toBe("/assets/agents/ye_shunguang.webp")
  })
})
