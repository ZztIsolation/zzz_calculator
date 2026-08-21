import {
  HOME_SELECTION_STORAGE_KEY,
  loadHomeSelection,
} from "@runtime/selection-storage.js"

export const WEBAPP_BUILD_STORAGE_KEY = "zzz-calculator.webapp.build.v1"

function readJson(key: string): any {
  try {
    return JSON.parse(localStorage.getItem(key) || "null")
  } catch {
    return null
  }
}

function sameDocument(left: any, right: any): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

export function readBuildSelectionDocument(): any {
  return readJson(WEBAPP_BUILD_STORAGE_KEY) ?? { version: 2, currentOwnerId: "default", byOwner: {} }
}

export function writeBuildSelectionDocument(document: any): void {
  if (sameDocument(readBuildSelectionDocument(), document)) return
  localStorage.setItem(WEBAPP_BUILD_STORAGE_KEY, JSON.stringify(document))
}

export function readLegacySelectionDocument(): any {
  return loadHomeSelection()
}

export function writeLegacySelectionDocument(document: any): void {
  if (sameDocument(readLegacySelectionDocument(), document)) return
  localStorage.setItem(HOME_SELECTION_STORAGE_KEY, JSON.stringify(document))
}

export function writeSelectionDocuments(buildSelection: any, legacySelection: any): void {
  writeBuildSelectionDocument(buildSelection)
  writeLegacySelectionDocument(legacySelection)
}

export function writeEnkaSelectionDocuments(buildSelection: any, legacySelection: any): void {
  writeSelectionDocuments(buildSelection, legacySelection)
}
