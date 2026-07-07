export const fallbackIcon = "/assets/drive-discs/empty.svg"

export function imageForAgent(agent: any): string {
  return String(agent?.images?.portrait || agent?.images?.icon || fallbackIcon)
}

export function imageForWEngine(wEngine: any): string {
  return String(wEngine?.images?.icon || fallbackIcon)
}

export function imageForBuff(buff: any): string {
  return String(
    buff?.images?.icon
      || buff?.images?.portrait
      || buff?.teammateImages?.icon
      || buff?.teammateImages?.portrait
      || buff?.ownerImages?.icon
      || buff?.ownerImages?.portrait
      || buff?.agentImages?.icon
      || buff?.agentImages?.portrait
      || buff?.sourceImages?.icon
      || buff?.sourceImages?.portrait
      || fallbackIcon,
  )
}

export function imageForDriveDiscSet(set: any): string {
  return String(set?.images?.icon || set?.images?.portrait || fallbackIcon)
}

export function iconForEntity(item: any, kind: "agent" | "wEngine" | "buff" | "driveDiscSet" | "generic"): string {
  if (kind === "agent") {
    return imageForAgent(item)
  }
  if (kind === "wEngine") {
    return imageForWEngine(item)
  }
  if (kind === "buff") {
    return imageForBuff(item)
  }
  if (kind === "driveDiscSet") {
    return imageForDriveDiscSet(item)
  }
  return fallbackIcon
}

export function auditIconCoverage(meta: any) {
  const missing: Array<{ kind: string, id: string, name: string }> = []
  for (const agent of meta?.agents ?? []) {
    if (!agent?.images?.portrait) {
      missing.push({ kind: "agent", id: agent?.id ?? "", name: agent?.name?.zhCN ?? agent?.id ?? "" })
    }
  }
  for (const wEngine of meta?.wEngines ?? []) {
    if (!wEngine?.images?.icon) {
      missing.push({ kind: "wEngine", id: wEngine?.id ?? "", name: wEngine?.name?.zhCN ?? wEngine?.id ?? "" })
    }
  }
  for (const buff of meta?.combatBuffs ?? []) {
    const hasBuffIcon = Boolean(
      buff?.images?.icon
        || buff?.teammateImages?.icon
        || buff?.ownerImages?.icon
        || buff?.agentImages?.icon,
    )
    if (buff?.sourceKind === "teammate" && !hasBuffIcon) {
      missing.push({ kind: "buff", id: buff?.id ?? "", name: buff?.name?.zhCN ?? buff?.id ?? "" })
    }
  }
  return missing
}
