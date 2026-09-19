import { describe, expect, it } from "vitest"
import catalog from "../../../data/combat_buffs.json"
import {
  inferBuffPickerState,
  isTeammatePotentialBuff,
  normalizeBuffPickerState,
  selectedTeammateOwnerIds,
  teammateCinemaLevel,
  teammateOwnerId,
} from "@/utils/teammateBuffPicker"

const catalogBuffs = catalog.teammates.flatMap(group => group.buffs
  .filter((buff: any) => buff.hidden !== true)
  .map(buff => ({ ...buff, ownerId: group.id })))

describe("teammate Buff picker helpers", () => {
  it("uses owner identity rather than the Buff ID prefix, with legacy owner fallback", () => {
    expect(teammateOwnerId({ id: "yanagi.cinema_4.insight_pen_ratio", ownerId: "tsukishiro_yanagi" }))
      .toBe("tsukishiro_yanagi")
    expect(teammateOwnerId({ ownerId: " ", teammateId: " legacy_owner " })).toBe("legacy_owner")
    expect(teammateOwnerId({ id: "owner.core" })).toBe("")
  })

  it("resolves opaque IDs and Chinese or Arabic labels before ID fallbacks", () => {
    expect(teammateCinemaLevel({ id: "buff_a9ab2c0d63", source: { zhCN: "影画一" } })).toBe(1)
    expect(teammateCinemaLevel({ sourceLabel: { zhCN: "影画二：倾落喧嚣" } })).toBe(2)
    expect(teammateCinemaLevel({ source: "影画 6" })).toBe(6)
    expect(teammateCinemaLevel({ source: { en: "Cinema 4: Afterglow" } })).toBe(4)
    expect(teammateCinemaLevel({ id: "owner.cinema_6.buff", sourceLabel: "影画一" })).toBe(1)
    expect(teammateCinemaLevel({ id: "owner.cinema_6.buff", source: "影画一", cinemaLevel: 2 })).toBe(2)
    expect(teammateCinemaLevel({ id: "owner.cinema_4_buff" })).toBe(4)
    expect(teammateCinemaLevel({ id: "owner.cinema.3" })).toBe(3)
    for (const buff of [{}, { source: "核心被动" }, { source: "影画十二" }, { source: "影画10" }, { id: "owner.cinema_12" }]) {
      expect(teammateCinemaLevel(buff)).toBeNull()
    }
  })

  it("keeps potential awakening distinct from ordinary and cinema Buffs", () => {
    expect(isTeammatePotentialBuff({ runtimeParameters: [{ id: "potentialLevel" }] })).toBe(true)
    expect(isTeammatePotentialBuff({ source: { zhCN: "潜能觉醒：爆破作业" } })).toBe(true)
    expect(isTeammatePotentialBuff({ id: "rina.potential.perfect_service" })).toBe(true)
    expect(isTeammatePotentialBuff({ sourceLabel: { en: "Potential Awakening" } })).toBe(true)
    expect(isTeammatePotentialBuff({ source: "影画六", runtimeParameters: [{ id: "anomalyAgentCount" }] })).toBe(false)
    expect(teammateCinemaLevel({ id: "rina.potential.perfect_service", source: "潜能觉醒" })).toBeNull()
  })

  it("distinguishes missing or malformed state from intentionally empty slots", () => {
    for (const value of [undefined, null, [], 1, "", {}, { teammateSlots: null }, { teammateSlots: {} }]) {
      expect(normalizeBuffPickerState(value)).toBeNull()
    }
    expect(normalizeBuffPickerState({ teammateSlots: [] })).toEqual({ teammateSlots: [null, null] })
    expect(normalizeBuffPickerState({ teammateSlots: [null, null] })).toEqual({ teammateSlots: [null, null] })
    expect(normalizeBuffPickerState({ teammateSlots: [null, { teammateId: "rina", cinemaLevel: 1 }] }))
      .toEqual({ teammateSlots: [null, { teammateId: "rina", cinemaLevel: 1 }] })
  })

  it("normalizes two distinct slots and finite whole cinema levels without moving slots", () => {
    expect(normalizeBuffPickerState({ teammateSlots: [
      { teammateId: " rina ", cinemaLevel: 9 },
      { teammateId: "rina", cinemaLevel: 2 },
      { teammateId: "qianxia", cinemaLevel: 2 },
    ] })).toEqual({ teammateSlots: [{ teammateId: "rina", cinemaLevel: 6 }, null] })
    expect(normalizeBuffPickerState({ teammateSlots: [
      { teammateId: "rina", cinemaLevel: "2.9" },
      { teammateId: "qianxia", cinemaLevel: -1 },
    ] })).toEqual({ teammateSlots: [{ teammateId: "rina", cinemaLevel: 2 }, { teammateId: "qianxia", cinemaLevel: 0 }] })
    expect(normalizeBuffPickerState({ teammateSlots: [
      { teammateId: " ", cinemaLevel: 6 },
      { teammateId: "qianxia", cinemaLevel: Infinity },
    ] })).toEqual({ teammateSlots: [null, { teammateId: "qianxia", cinemaLevel: 0 }] })
    expect(normalizeBuffPickerState({ teammateSlots: [false, { teammateId: 2, cinemaLevel: 1 }] }))
      .toEqual({ teammateSlots: [null, null] })
  })

  it("infers selected owners in authored order without rewriting existing selections", () => {
    const buffs = [
      { id: "a.core", ownerId: "a" },
      { id: "b.core", ownerId: "b" },
      { id: "a.cinema_2", ownerId: "a" },
      { id: "b.cinema_6", ownerId: "b" },
      { id: "c.cinema_1", ownerId: "c" },
    ]
    const selected = Object.freeze(["c.cinema_1", "b.core", "a.cinema_2", "missing"])
    expect([...selectedTeammateOwnerIds(buffs, selected)]).toEqual(["a", "b", "c"])
    expect(inferBuffPickerState(buffs, selected.values())).toEqual({ teammateSlots: [
      { teammateId: "a", cinemaLevel: 2 },
      { teammateId: "b", cinemaLevel: 0 },
    ] })
    expect(selected).toEqual(["c.cinema_1", "b.core", "a.cinema_2", "missing"])
    expect(inferBuffPickerState(buffs, new Set())).toEqual({ teammateSlots: [null, null] })
  })

  it("identifies every visible catalog cinema while preserving effects, modifiers and potential runtime", () => {
    const original = JSON.stringify(catalogBuffs)
    const cinemaBuffs = catalogBuffs.filter(buff => buff.source?.zhCN.startsWith("影画"))
    expect(cinemaBuffs.length).toBeGreaterThan(40)
    for (const buff of cinemaBuffs) expect(teammateCinemaLevel(buff)).toBeGreaterThan(0)
    expect(catalogBuffs.some(buff => buff.id === "lighter.cinema_4_front_energy_regen")).toBe(false)
    const potentialBuffs = catalogBuffs.filter(isTeammatePotentialBuff)
    expect(potentialBuffs.map(buff => buff.id)).toEqual([
      "rina.potential.perfect_service",
      "koleda.potential.demolition_operation",
    ])
    for (const buff of potentialBuffs) expect(teammateCinemaLevel(buff)).toBeNull()
    const selected = ["buff_a9ab2c0d63", "buff_2c59dfda5b", "rina.cinema_1.core_pen_ratio_amplify"]
    expect(inferBuffPickerState(catalogBuffs, selected)).toEqual({ teammateSlots: [
      { teammateId: "nangongyu", cinemaLevel: 2 },
      { teammateId: "rina", cinemaLevel: 1 },
    ] })
    expect(JSON.stringify(catalogBuffs)).toBe(original)
  })
})
