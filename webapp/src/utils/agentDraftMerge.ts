export interface DraftValue { present: boolean, value?: any }
export interface AgentDraftConflict {
  path: string[]
  base: DraftValue
  local: DraftValue
  remote: DraftValue
  choice?: "local" | "remote"
}

function object(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export function comparableAgent(value: any): any {
  if (Array.isArray(value)) return value.map(comparableAgent)
  if (object(value)) return Object.fromEntries(Object.keys(value).filter(key => !key.startsWith("__")).sort()
    .map(key => [key, comparableAgent(value[key])]))
  return value
}

export function agentValuesEqual(a: any, b: any) {
  return JSON.stringify(comparableAgent(a)) === JSON.stringify(comparableAgent(b))
}

const copy = (value: any) => value === undefined ? undefined : JSON.parse(JSON.stringify(value))
const slot = (parent: any, key: string): DraftValue => {
  const present = Object.prototype.hasOwnProperty.call(parent, key)
  return { present, ...(present ? { value: parent[key] } : {}) }
}
const equal = (a: DraftValue, b: DraftValue) => a.present === b.present && agentValuesEqual(a.value, b.value)

export function mergeAgentDraft(base: any, local: any, remote: any) {
  const conflicts: AgentDraftConflict[] = []
  function merge(b: DraftValue, l: DraftValue, r: DraftValue, path: string[]): DraftValue {
    if (equal(l, b)) return copy(r)
    if (equal(r, b) || equal(l, r)) return copy(l)
    if (b.present && l.present && r.present && object(b.value) && object(l.value) && object(r.value)) {
      const keys = [...new Set([...Object.keys(b.value), ...Object.keys(l.value), ...Object.keys(r.value)])]
        .filter(key => !key.startsWith("__"))
      const entries: [string, any][] = []
      for (const key of keys) {
        const merged = merge(slot(b.value, key), slot(l.value, key), slot(r.value, key), [...path, key])
        if (merged.present) entries.push([key, merged.value])
      }
      return { present: true, value: Object.fromEntries(entries) }
    }
    conflicts.push({ path, base: copy(b), local: copy(l), remote: copy(r) })
    return copy(l)
  }
  const merged = merge({ present: true, value: base }, { present: true, value: local }, { present: true, value: remote }, [])
  return { merged: merged.value, conflicts }
}

export function applyDraftValue(draft: any, path: string[], value: DraftValue) {
  if (!path.length) return value.present ? copy(value.value) : null
  const next = copy(draft)
  let parent = next
  for (const key of path.slice(0, -1)) {
    if (!object(parent[key])) parent[key] = {}
    parent = parent[key]
  }
  const key = path[path.length - 1]
  if (value.present) Object.defineProperty(parent, key, { value: copy(value.value), enumerable: true, writable: true, configurable: true })
  else delete parent[key]
  return next
}

export function parseAgentBaseline(text: unknown, agentId: string) {
  try {
    const value = JSON.parse(String(text))
    return object(value) && value.id === agentId ? value : null
  } catch { return null }
}
