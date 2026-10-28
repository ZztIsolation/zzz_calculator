/*
 * 工作台本地偏好：目前只有“局内 Buff 是否展开”。
 * 存储不可用（隐私模式、禁用 localStorage）时读写都静默回退，不阻塞页面。
 */
export const BUFF_SECTION_STORAGE_KEY = "zzz-calculator.workbench.buff-expanded.v1"

type ReadableStorage = Pick<Storage, "getItem">
type WritableStorage = Pick<Storage, "setItem">

function defaultStorage(): ReadableStorage & WritableStorage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null
  } catch {
    return null
  }
}

export function readBuffSectionExpanded(storage?: ReadableStorage | null): boolean {
  try {
    const target = storage ?? defaultStorage()
    return target?.getItem(BUFF_SECTION_STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

export function writeBuffSectionExpanded(expanded: boolean, storage?: WritableStorage | null): void {
  try {
    const target = storage ?? defaultStorage()
    target?.setItem(BUFF_SECTION_STORAGE_KEY, String(Boolean(expanded)))
  } catch {
    // 隐私模式或禁用存储时保持当前会话状态即可。
  }
}
