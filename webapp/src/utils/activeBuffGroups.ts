/*
 * 计算页“局内 Buff”展开后的分组：同一位代理人的 Buff 归到一组，组内只显示“核心被动 / 影画一…”；
 * 音擎、驱动盘、场地等按来源归组。避免把十几条“名字 | 来源”平铺成长列表。
 */
export type ActiveBuffItem = { id: string, label: string }
export type ActiveBuffGroup = { key: string, title: string, items: Array<{ id: string, label: string, title: string }> }

const KIND_GROUPS: ReadonlyArray<{ key: string, title: string, test: (id: string) => boolean }> = [
  { key: "wEngine", title: "音擎", test: id => id.startsWith("wEngine:") },
  { key: "driveDisc", title: "驱动盘", test: id => id.startsWith("driveDisc4pc:") || id.startsWith("teammateDriveDisc4pc:") },
  { key: "field", title: "场地", test: id => id.startsWith("field.") || id.startsWith("field:") },
  { key: "boss", title: "Boss", test: id => id.startsWith("boss.") || id.startsWith("boss:") },
]
const OTHER_GROUP = { key: "other", title: "其他" }

export function groupActiveBuffs(items: ReadonlyArray<ActiveBuffItem>): ActiveBuffGroup[] {
  const ownerGroups = new Map<string, ActiveBuffGroup>()
  const kindGroups = new Map<string, ActiveBuffGroup>()
  for (const item of items) {
    const label = String(item.label ?? item.id)
    const [owner, ...rest] = label.split(" | ")
    if (rest.length && owner) {
      const key = `owner:${owner}`
      const group = ownerGroups.get(key) ?? { key, title: owner, items: [] }
      group.items.push({ id: item.id, label: rest.join(" · "), title: label })
      ownerGroups.set(key, group)
      continue
    }
    const kind = KIND_GROUPS.find(entry => entry.test(String(item.id))) ?? OTHER_GROUP
    const group = kindGroups.get(kind.key) ?? { key: kind.key, title: kind.title, items: [] }
    group.items.push({ id: item.id, label, title: label })
    kindGroups.set(kind.key, group)
  }
  // 代理人组按出现顺序在前，其余按固定顺序在后。
  const orderedKinds = [...KIND_GROUPS, OTHER_GROUP].map(entry => kindGroups.get(entry.key)).filter(Boolean) as ActiveBuffGroup[]
  return [...ownerGroups.values(), ...orderedKinds]
}
