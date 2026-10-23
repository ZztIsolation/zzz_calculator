import { describe, expect, it } from "vitest"
import { groupActiveBuffs } from "./activeBuffGroups"

describe("groupActiveBuffs", () => {
  it("groups agent Buffs by owner and other sources by kind", () => {
    const groups = groupActiveBuffs([
      { id: "agent:yixuan.core", label: "仪玄 | 核心被动" },
      { id: "wEngine:qingming.self", label: "云流运转（限佩戴者）" },
      { id: "agent:yixuan.cinema.1", label: "仪玄 | 影画1 | 清灵道心" },
      { id: "buff_lucy", label: "琉音 | 额外能力" },
      { id: "teammateDriveDisc4pc:king", label: "山大王" },
      { id: "wEngine:dream.team", label: "铸梦炉歌（队友携带） · 精 1" },
      { id: "driveDisc4pc:yunkui.self", label: "云岿如我 4 件套（自身）" },
      { id: "mystery", label: "神秘 Buff" },
    ])
    expect(groups.map(group => group.title)).toEqual(["仪玄", "琉音", "音擎", "驱动盘", "其他"])
    expect(groups[0]!.items.map(item => item.label)).toEqual(["核心被动", "影画1 · 清灵道心"])
    expect(groups[0]!.items[1]!.title).toBe("仪玄 | 影画1 | 清灵道心")
    expect(groups[2]!.items.map(item => item.label)).toEqual(["云流运转（限佩戴者）", "铸梦炉歌（队友携带） · 精 1"])
    expect(groups[3]!.items.map(item => item.label)).toEqual(["山大王", "云岿如我 4 件套（自身）"])
  })

  it("returns nothing for no Buffs", () => {
    expect(groupActiveBuffs([])).toEqual([])
  })
})
