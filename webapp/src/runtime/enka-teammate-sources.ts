import { enkaBindingForOwner, enkaImportHistoryForOwner } from '@core/enka-import/import-plan.js'
import { loadUserDriveDiscStore } from './local-store.js'
import { readBuildSelectionDocument, readLegacySelectionDocument } from './build-storage'
import type { TeammateSources } from '@/utils/enkaTeammates'

export async function readTeammateSources() {
  const store = await loadUserDriveDiscStore()
  const ownerId = String(store.currentOwnerId ?? 'default')
  const build = readBuildSelectionDocument()
  const legacy = readLegacySelectionDocument()
  const history = enkaImportHistoryForOwner(store, ownerId)
  const sources: TeammateSources = {
    ownerId,
    uid: String(enkaBindingForOwner(store, ownerId)?.uid ?? ''),
    history: history?.byAgent ?? {},
    configs: build?.byOwner?.[ownerId]?.byAgent ?? (ownerId === 'default' ? build?.byAgent : null) ?? {},
    loadouts: (store.driveDiscLoadouts ?? []).filter((item: any) => String(item.ownerId ?? 'default') === ownerId),
    discs: (store.driveDiscs ?? []).filter((item: any) => String(item.ownerId ?? 'default') === ownerId),
  }
  return { sources, build, legacy }
}
