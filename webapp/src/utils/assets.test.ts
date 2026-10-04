import { describe, expect, it } from "vitest"
import {
  auditIconCoverage,
  fallbackIcon,
  imageForAgent,
  imageForBuff,
  imageForDriveDiscSet,
  imageForWEngine,
  thumbnailForAgent,
  thumbnailForBuff,
  thumbnailForDriveDiscSet,
  thumbnailForEntity,
  thumbnailForImage,
  thumbnailForWEngine,
} from "@/utils/assets"

describe("asset adapters", () => {
  it("keeps catalog image paths for agents, w-engines, and buffs", () => {
    expect(imageForAgent({ images: { portrait: "/assets/agents/a.png" } })).toBe("/assets/agents/a.png")
    expect(imageForWEngine({ images: { icon: "/assets/w-engines/w.png" } })).toBe("/assets/w-engines/w.png")
    expect(imageForBuff({ teammateImages: { icon: "/assets/agents/t.png" } })).toBe("/assets/agents/t.png")
    expect(imageForBuff({ ownerImages: { icon: "/assets/w-engines/team.png" } })).toBe("/assets/w-engines/team.png")
    expect(imageForBuff({ agentImages: { portrait: "/assets/agents/self.png" } })).toBe("/assets/agents/self.png")
    expect(imageForDriveDiscSet({ images: { icon: "/assets/drive-discs/woodpecker_electro.webp" } })).toBe("/assets/drive-discs/woodpecker_electro.webp")
  })

  it("uses the shared placeholder only when image paths are absent", () => {
    expect(imageForAgent({})).toBe(fallbackIcon)
    expect(imageForWEngine({})).toBe(fallbackIcon)
    expect(imageForBuff({})).toBe(fallbackIcon)
  })

  it("uses generated content-versioned thumbnails only for bundled list images", () => {
    const agent = { images: { portrait: "/assets/agents/ye_shunguang.webp" } }
    const engine = { images: { icon: "/assets/w-engines/zzz_wiki_93.png" } }
    const set = { images: { icon: "/assets/drive-discs/woodpecker_electro.webp" } }

    expect(thumbnailForAgent(agent)).toMatch(/^\/assets\/thumbs\/agents\/ye_shunguang\.[a-f0-9]{16}\.webp$/)
    expect(thumbnailForWEngine(engine)).toMatch(/^\/assets\/thumbs\/w-engines\/zzz_wiki_93\.[a-f0-9]{16}\.webp$/)
    expect(thumbnailForDriveDiscSet(set)).toMatch(/^\/assets\/thumbs\/drive-discs\/woodpecker_electro\.[a-f0-9]{16}\.webp$/)
    expect(thumbnailForBuff({ ownerImages: engine.images })).toBe(thumbnailForWEngine(engine))
    expect(thumbnailForEntity(agent, "agent")).toBe(thumbnailForAgent(agent))
    expect(thumbnailForEntity(set, "driveDiscSet")).toBe(thumbnailForDriveDiscSet(set))
    // Maintenance editors and original-image previews keep using the raw helpers.
    expect(imageForAgent(agent)).toBe(agent.images.portrait)
    expect(imageForWEngine(engine)).toBe(engine.images.icon)
  })

  it("preserves fallback, custom, remote, Boss, and SVG image URLs", () => {
    for (const src of [
      fallbackIcon,
      "/assets/agents/custom.png",
      "/assets/bosses/girtablullu.webp",
      "https://example.com/assets/agents/ye_shunguang.webp",
      "data:image/png;base64,example",
    ]) {
      expect(thumbnailForImage(src)).toBe(src)
    }
    expect(thumbnailForImage()).toBe(fallbackIcon)
    expect(thumbnailForAgent({})).toBe(fallbackIcon)
    expect(thumbnailForWEngine({})).toBe(fallbackIcon)
    expect(thumbnailForDriveDiscSet({})).toBe(fallbackIcon)
    expect(thumbnailForBuff({})).toBe(fallbackIcon)
  })

  it("preserves explicitly versioned original URLs and existing thumbnails", () => {
    const src = "/assets/agents/ye_shunguang.webp"
    const thumbnail = thumbnailForImage(src)
    expect(thumbnailForImage(`${src}?v=2#preview`)).toBe(`${src}?v=2#preview`)
    expect(thumbnailForImage(thumbnail)).toBe(thumbnail)
  })

  it("audits missing icon-bearing catalog entries", () => {
    const missing = auditIconCoverage({
      agents: [{ id: "agent_without_icon", name: { zhCN: "无图角色" }, images: {} }],
      wEngines: [{ id: "engine_without_icon", name: { zhCN: "无图音擎" }, images: {} }],
      combatBuffs: [{ id: "buff_without_icon", sourceKind: "teammate", name: { zhCN: "无图 Buff" } }],
    })
    expect(missing.map(item => item.kind)).toEqual(["agent", "wEngine", "buff"])
  })
})
