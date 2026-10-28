import { describe, expect, it } from "vitest"
import {
  BUFF_SECTION_STORAGE_KEY,
  readBuffSectionExpanded,
  writeBuffSectionExpanded,
} from "@/utils/workbenchPreferences"

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial }
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => { data[key] = value },
  }
}

describe("workbenchPreferences", () => {
  it("reads only the persisted true value", () => {
    expect(readBuffSectionExpanded(fakeStorage({ [BUFF_SECTION_STORAGE_KEY]: "true" }))).toBe(true)
    expect(readBuffSectionExpanded(fakeStorage({ [BUFF_SECTION_STORAGE_KEY]: "false" }))).toBe(false)
    expect(readBuffSectionExpanded(fakeStorage())).toBe(false)
  })

  it("writes the expanded flag under the versioned key", () => {
    const storage = fakeStorage()
    writeBuffSectionExpanded(true, storage)
    expect(storage.data[BUFF_SECTION_STORAGE_KEY]).toBe("true")
    writeBuffSectionExpanded(false, storage)
    expect(storage.data[BUFF_SECTION_STORAGE_KEY]).toBe("false")
  })

  it("falls back safely when storage throws", () => {
    const broken = {
      getItem: () => { throw new Error("denied") },
      setItem: () => { throw new Error("denied") },
    }
    expect(readBuffSectionExpanded(broken)).toBe(false)
    expect(() => writeBuffSectionExpanded(true, broken)).not.toThrow()
  })
})
