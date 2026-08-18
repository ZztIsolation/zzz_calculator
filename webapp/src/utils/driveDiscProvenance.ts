export type DriveDiscSourceKey = "enkaZzz" | "scanner" | "calculatorJson" | "manual"

export type DriveDiscSourceDescriptor = {
  key: DriveDiscSourceKey
  label: string
  tagType: "default" | "info" | "success" | "warning"
}

const SOURCE_DESCRIPTORS: DriveDiscSourceDescriptor[] = [
  { key: "enkaZzz", label: "Enka", tagType: "info" },
  { key: "scanner", label: "扫描器", tagType: "success" },
  { key: "calculatorJson", label: "JSON", tagType: "default" },
  { key: "manual", label: "手动", tagType: "warning" },
]

function legacySourceKey(source: any): DriveDiscSourceKey | null {
  const type = String(source?.type ?? "").trim().toLowerCase()
  if (!type) return null
  if (type.startsWith("enka")) return "enkaZzz"
  if (type === "zzz-scanner" || type === "scanner") return "scanner"
  if (type === "calculator-json" || type === "zzz-calculator-drive-disc-export" || type === "json") {
    return "calculatorJson"
  }
  if (type === "manual") return "manual"
  return null
}

export function driveDiscSourceDescriptors(disc: any): DriveDiscSourceDescriptor[] {
  const present = new Set<DriveDiscSourceKey>()
  const provenance = disc?.provenance
  if (provenance && typeof provenance === "object") {
    for (const descriptor of SOURCE_DESCRIPTORS) {
      if (provenance[descriptor.key]) present.add(descriptor.key)
    }
  }
  const legacyKey = legacySourceKey(disc?.source)
  if (legacyKey) present.add(legacyKey)
  return SOURCE_DESCRIPTORS.filter(descriptor => present.has(descriptor.key))
}

export function driveDiscScannerSequence(disc: any): string | null {
  const scannerProvenance = disc?.provenance?.scanner
  const legacyScanner = legacySourceKey(disc?.source) === "scanner"
  if (!scannerProvenance && !legacyScanner) return null
  const value = scannerProvenance?.lastSequence ?? disc?.source?.sequence
  if (value === null || value === undefined || String(value).trim() === "") return null
  return String(value)
}

export function driveDiscSourceText(disc: any, { includeScannerSequence = false } = {}): string {
  const sequence = includeScannerSequence ? driveDiscScannerSequence(disc) : null
  return driveDiscSourceDescriptors(disc)
    .map(descriptor => descriptor.key === "scanner" && sequence !== null
      ? `${descriptor.label} #${sequence}`
      : descriptor.label)
    .join("、")
}
