import { describe, expect, it } from "vitest"
import { adaptiveCascaderHorizontalOffset, adaptiveCascaderMenuHeight } from "./useAdaptiveCascaderMenu"

describe("adaptive Cascader menu sizing", () => {
  it("keeps the preferred height when the viewport has enough room", () => {
    expect(adaptiveCascaderMenuHeight(1080)).toBe("288px")
    expect(adaptiveCascaderMenuHeight(768)).toBe("288px")
  })

  it("limits the menu to half of a short viewport while retaining a usable minimum", () => {
    expect(adaptiveCascaderMenuHeight(400)).toBe("192px")
    expect(adaptiveCascaderMenuHeight(100)).toBe("72px")
  })

  it("scales the minimum height with a selector's row size", () => {
    expect(adaptiveCascaderMenuHeight(120, { optionHeight: 44, minRows: 3 })).toBe("132px")
  })

  it("respects the actual space around the anchor in a short viewport", () => {
    expect(adaptiveCascaderMenuHeight(320, {}, 130)).toBe("130px")
    expect(adaptiveCascaderMenuHeight(768, {}, 400)).toBe("288px")
    expect(adaptiveCascaderMenuHeight(100, {}, 40)).toBe("40px")
  })

  it("clamps a wide menu to both viewport edges using its unshifted position", () => {
    expect(adaptiveCascaderHorizontalOffset({
      left: -10,
      menuWidth: 294,
      viewportWidth: 320,
      gutter: 8,
    })).toBe(18)
    expect(adaptiveCascaderHorizontalOffset({
      left: 40,
      menuWidth: 294,
      viewportWidth: 320,
      gutter: 8,
    })).toBe(-22)
    expect(adaptiveCascaderHorizontalOffset({
      left: 20,
      marginLeft: 18,
      menuWidth: 294,
      viewportWidth: 320,
      gutter: 8,
    })).toBe(6)
  })

  it("waits for a measurable menu before applying a horizontal correction", () => {
    expect(adaptiveCascaderHorizontalOffset({
      left: 0,
      menuWidth: 0,
      viewportWidth: 320,
    })).toBeNull()
  })
})
