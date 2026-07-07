import { describe, expect, it } from "vitest"
import { auditIconCoverage, fallbackIcon, imageForAgent, imageForBuff, imageForWEngine } from "@/utils/assets"

describe("asset adapters", () => {
  it("keeps catalog image paths for agents, w-engines, and buffs", () => {
    expect(imageForAgent({ images: { portrait: "/assets/agents/a.png" } })).toBe("/assets/agents/a.png")
    expect(imageForWEngine({ images: { icon: "/assets/w-engines/w.png" } })).toBe("/assets/w-engines/w.png")
    expect(imageForBuff({ teammateImages: { icon: "/assets/agents/t.png" } })).toBe("/assets/agents/t.png")
    expect(imageForBuff({ ownerImages: { icon: "/assets/w-engines/team.png" } })).toBe("/assets/w-engines/team.png")
    expect(imageForBuff({ agentImages: { portrait: "/assets/agents/self.png" } })).toBe("/assets/agents/self.png")
  })

  it("uses the shared placeholder only when image paths are absent", () => {
    expect(imageForAgent({})).toBe(fallbackIcon)
    expect(imageForWEngine({})).toBe(fallbackIcon)
    expect(imageForBuff({})).toBe(fallbackIcon)
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
