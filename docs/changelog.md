所有修改记录应当极致详细，越详细越好。

# Changelog

## 2026-07-20 - Refined Reservations Into Per-Disc Product Controls

Replaced every user-facing whole-loadout reservation action with a prominent
32-pixel per-disc lock control. Workbench manual schemes, loaded presets, and
optimizer results reserve against the active Workbench agent, while saved
loadout previews reserve against the preset agent. Public discs lock directly,
discs already reserved for the target agent release directly, and reservations
owned by another or unknown agent require a single-disc transfer confirmation
that identifies the set, slot, main stat, previous owner, and target owner.
Lock-button interaction is isolated from the surrounding slot-card selection.

Saved-loadout cards retain `专属 N/6` only as live passive progress. Removed
lock-complete, complete-lock, release-complete, and save-and-reserve commands
from product UI, including their batch conflict dialogs. Editors and visual
pickers continue to display reservation ownership without mutating it. The core,
browser store, and development API retain their atomic batch operations for
backward compatibility.

Added `所有角色专属盘` to inventory filters. It matches every non-empty
`reservedForAgentId`, including IDs absent from the current agent catalog, and
continues to compose with slot, main-stat, and text filters. Unknown owners now
use the consistent `未知角色（ID）` fallback. Added shared-card, Workbench,
preset, inventory-filter, responsive-layout, and accessibility regressions for
the per-disc-only workflow.

## 2026-07-20 - Visualized Saved Drive Disc Loadouts

Replaced the compact saved-loadout slot tags with fully expanded six-slot
previews. Each slot now shows the Drive Disc set image and name, main and sub
stats, rarity and level, scan sequence, and whether the physical disc is public,
reserved for the preset agent, reserved for another known agent, or reserved for
an unknown agent ID. Missing references and intentionally empty slots use
different states. Preset headers retain the associated agent, valid-disc count,
derived reservation count, and any stored historical score. Presets use two
columns on wide desktops, one column below 1100 pixels, and one-column slot rows
below 680 pixels.

Rebuilt the loadout editor around the same shared slot card and visual picker
used by the Workbench manual scheme. Clicking a slot opens a slot-scoped list
with set, main-stat, and text filters, complete attributes, current-selection
highlighting, and an explicit clear action. Selections update only the editor
draft; cancel discards them and save preserves the existing loadout write path.
Changing the associated agent or manually choosing a disc reserved for another
agent does not reserve, release, or transfer any disc.

Added component, page-flow, and responsive layout regressions for full and
partial presets, missing references, reservation labels, filtering, selection,
clearing, cancel/save behavior, and the Workbench shared-component wiring. This
change does not modify inventory or loadout schemas, reservation APIs, optimizer
filtering, historical Top 10 records, or score calculation.

## 2026-07-20 - Added Agent-Exclusive Drive Disc Reservations

Added a calculator-owned `reservedForAgentId` field to Drive Disc inventory
records without repurposing the existing imported `locked` or `equippedBy`
metadata. Legacy browser and server stores normalize missing values to `null`.
Scanner refreshes preserve an existing local reservation, while native
`zzz-calculator-drive-disc-export` files retain and restore the field across
accounts without exporting `ownerId` or derived fingerprints.

Added one atomic shared reservation operation for individual and batch changes.
It validates every requested disc against the current account, reports the
original and requested agent for each conflict, and leaves the entire store
unchanged unless transfer is explicitly allowed. Saving a complete loadout can
now reserve its six unique, slot-correct discs in the same store write; a
conflict cannot leave behind a saved-but-unreserved loadout. Production user
data APIs remain retired because the hosted application stores inventory in the
browser. The reservation and loadout endpoints are available only outside
production for self-hosted development and integration verification.

Extended the Drive Disc inventory with a reservation filter, a dedicated
agent column, single-disc lock controls, and readable public/current/unknown
agent states. Saved loadout cards now show their associated agent and derived
reserved count, and complete presets support lock, complete-lock, and release
actions. The save-current-scheme dialog now separates `仅保存` from
`保存并锁定`; both single-disc and whole-loadout conflicts show the affected set,
slot, main stat, previous agent, and target agent before an explicit transfer.
Incomplete presets cannot be batch reserved, and editing or deleting a preset
does not silently release its physical discs.

Applied reservations only to automatic optimization, matching the selected
product scope. A disc remains eligible but not mandatory for its owning agent;
every other agent removes it before dominance filtering, candidate counts,
combination estimates, exact enumeration, and Top 10 ranking. Manual selection
and cross-agent saved-loadout loading remain unchanged. Progress metrics expose
`excludedByReservation` plus per-slot counts, and an emptied slot reports that
matching discs are reserved for other agents instead of using the generic
complete-set shortage message.

Added shared-model, browser-store, component, development-API, import/export,
scanner-refresh, owner-isolation, optimizer, and Worker-payload regressions.
Strict optimizer coverage compares the complete ordered Top 10 IDs and scores
against an explicitly prefiltered inventory, confirms current-agent
reservations preserve the baseline, and verifies other-agent IDs never leak
into a result.

## 2026-07-20 - Added Privacy-Limited Scanner Telemetry And Internal Diagnostics

Added a two-event scanner telemetry lifecycle to the Vue application. Each scan now emits one `started` record and exactly one terminal `completed`, `failed`, `cancelled`, or `import_failed` record after the import outcome is known. The payload is strictly limited to a random browser-local UUID, scan settings, Helper and Scanner versions, duration, aggregate counters, a sanitized error summary, and allowlisted structured diagnostics. Drive Disc arrays, account labels, screenshots, OCR text, local executable/output paths, complete logs, and exception stacks are never included. Collection is enabled by default on the production server, can be disabled or assigned a new anonymous identifier from `/settings`, and silently fails without affecting the scan workflow.

Added `POST /api/scan-telemetry/events` with a 16 KiB body limit, same-origin and content-type enforcement, strict nested field validation, UUID and enum validation, an in-memory per-IP rate limit, and server-owned record IDs, receive timestamps, and deployed commit values. IP addresses are used only for transient rate limiting and are not persisted. Accepted records are serialized through one append queue into UTC-dated NDJSON files outside immutable application releases; closed dates are gzip-compressed and files older than 30 days are deleted on startup and daily maintenance.

Internal aggregation now streams the selected daily files instead of retaining all raw events in memory. Summary counters are updated incrementally, paginated session queries retain only the newest rows needed for the requested page, and the management UI runs summary and list reads sequentially to avoid duplicate 30-day memory peaks. Same-origin validation ignores client-supplied forwarded-host values, and rate limiting keys only the trusted Nginx `X-Real-IP` value or the direct socket address.

Added the Basic-Auth-protected `/internal/scans` operational view and internal summary, paginated session-list, and session-detail APIs. The view exposes success rate, failures, duration percentiles, version/error distributions, date/version/client/error filters, and sanitized per-session diagnostics without linking from public navigation. Nginx injects the internal authorization marker only after Basic Auth succeeds, while the loopback Node service rejects direct unauthenticated production queries. The systemd template now owns `/var/lib/zzz-calculator` through `StateDirectory` and configures the telemetry directory and retention period.

Added Scanner 1.0.39 integration fields for panel-timeout ROI completeness, final acceptance gate, panel/selection change state, stable-frame counts, retry attempts, captured frame count, client dimensions, DPI, active capture backend, and visual profile. Static GitHub Pages output explicitly disables telemetry. Added storage, validation, retention, rate-limit, browser privacy, lifecycle, endpoint-failure, production routing, and load-test coverage; the load harness targets 20 requests per second while checking ingestion/health P95 and process memory growth.

Published the Scanner packages from the required Windows CI VC++ Redistributable layout. The framework-dependent package is `21756850` bytes with SHA-256 `6488a032b22c9cf907ea3637927b3c8df3b9bd7a04162818c3244cec80d57ea0`; the self-contained package is `84775658` bytes with SHA-256 `cc1552a38536b764373c24821af003b7e85adb097f3611653a86783c2a06b037`. Helper remains on the existing 1.2.1 release and was not replaced by the pipeline's same-version rebuild.

## 2026-07-19 - Matched Alice's In-Game Mastery Conversion Rounding

Corrected Alice's Additional Ability to use the game's two-stage downward
rounding. Current in-combat Anomaly Mastery is floored before applying the
140-point threshold, and the resulting `1.6`-per-point Anomaly Proficiency
conversion is floored again. The underlying Anomaly Mastery panel retains full
precision for every other consumer.

Unified the rule across ordinary panel calculation, dense optimization,
fixed-event scoring, mixed-event scoring, and browser-local execution. With
Core Skill F, a 30% slot-6 main stat, Phaethon's Melody, and Modification Level
1 Tenfold Starforge, `255.96` Mastery now converts to `184` Proficiency and the
reported in-combat total matches the observed `336 + 184 = 520` game panel.
Added regression coverage for threshold boundaries, decimal conversion,
compiled parity, browser parity, and the reported Drive Disc configuration.

## 2026-07-19 - Added The Complete Official Attack W-Engine Catalog

Imported all 24 W-Engines currently classified as `Attack` by the official
Zenless Zone Zero wiki: 3 B-rank, 8 A-rank, and 13 S-rank entries. Added 23
previously missing catalog records and retained the stable
`cloudcleave_radiance` ID for Cloudcleave Radiance so saved builds continue to
resolve without migration. Every entry now carries its official Chinese name,
rarity, level-60 Base ATK and advanced stat, exact Modification Level 1-5
values, full Chinese effect text, official detail-page sources, and a locally
served official PNG icon.

Structured all effects that the current maintenance model can represent using
fixed rules, shared or independent stack groups, element-scoped bonuses,
skill-type and skill-tag targets, conditions, durations, cooldown metadata,
and exact per-rank value arrays. Corrected Cloudcleave Radiance so its Physical
RES Ignore remains unconditional while its damage and CRIT DMG bonuses are
separately marked as Ether Veil effects lasting 40 seconds. Only Cloudcleave
Radiance links to a `relatedAgentId`, because Ye Shunguang is currently the
only maintained Attack agent; no dangling IDs were invented for unavailable
agents.

Kept unsupported mechanics conservative instead of translating them into
incorrect generic Buffs. Fixed Energy restoration, flat off-field Energy per
second, independent proc damage, charge consumption, dynamic duration
extension or pausing, and the Pelerine-only activation restriction remain in
the authoritative effect text with explicit partial-model verification states.
The supported numerical portions still participate in calculation, while the
unsupported portions cannot silently inflate optimizer scores.

Added a dedicated Attack W-Engine regression suite covering the complete
official inventory and rarity distribution, level-60 panels, effect names,
official sources and PNG assets, exact Modification materialization, safe
partial-model boundaries, Cloudcleave condition separation, skill targeting,
Brimstone's eight rank-5 ATK stacks, and Deep Sea Visitor's independent CRIT
Rate effects. The new suite is part of the repository-wide `npm test` chain.

## 2026-07-19 - Added Administrator-Controlled Teammate Buff Ordering

Fixed teammate Buff ordering at its actual source of truth. The player Buff
picker already preserved the order of each teammate's `buffs[]` array while
flattening role groups, but the structured maintenance page could only edit and
save one active Buff. It had no operation for reordering the secondary list and
its `{ teammate, buff }` save request could not persist a reordered group. This
made later-added entries appear after Cinema Buffs even when their gameplay
source belonged earlier in the list.

The teammate maintenance editor now adds a dedicated drag handle to every Buff
row, visual before/after drop indicators, and compact up/down controls. Dragging
is optimized for pointer use, while the explicit buttons provide precise and
touch/keyboard-compatible ordering. The first Buff cannot move upward and the
last cannot move downward. Reordering mutates only the selected teammate's
draft array, keeps the currently edited Buff selected, enters the existing
unsaved-draft state, and uses the normal page-level Save action instead of an
independent or automatic write path.

Extended `POST /api/maintenance/teammate-buffs` with the optional request-only
field `buffOrder: string[]`. Existing `{ teammate, buff }` clients remain fully
compatible when they omit it. When present, the backend materializes and
validates the selected Buff, upserts it, then requires the order to contain
every current Buff ID exactly once. Missing, duplicate, empty, or unknown IDs
produce a `400` response asking the administrator to refresh. The upsert and
reorder run inside the existing serialized `combat_buffs.json` mutation, so an
invalid or stale order cannot partially save the current Buff or overwrite a
concurrently added entry.

Kept array order as the only persisted ordering contract. No numeric priority,
semantic source-name sorting, or parallel schema field was added. Catalog
loading, visibility filtering, metadata building, Vue candidate flattening,
text search, and attribute/specialty filters all preserve the authored role and
Buff sequence. After the canonical file is saved and the catalog is refreshed,
the player-facing picker therefore receives the same ordering without a second
frontend synchronization rule or a forced browser-storage migration.

Reordered Qianxia's canonical teammate entries to Core Passive, Additional
Ability, EX Special, Cinema 1, Cinema 2, and Cinema 4. Added Vue maintenance
regressions for button moves, drag/drop, boundary disabling, selected-row
stability, unsaved state, request serialization, and save/reload persistence.
Added temporary-data maintenance API coverage for backward-compatible saves,
valid atomic reorders, incomplete/duplicate/unknown order rejection, and
unchanged files after rejection. Added shared candidate, picker filtering, and
real Qianxia metadata assertions so future catalog changes cannot silently
reintroduce the player-facing ordering regression.

## 2026-07-19 - Migrated Production Delivery To Server-Origin CDN Architecture

Changed the primary production model from an automatically published GitHub
Pages site to the existing Linux host at `121.199.21.10`. The application keeps
the established immutable release layout under
`/opt/zzz_calculator/releases/<release>` and switches
`/opt/zzz_calculator/current` atomically only after a new archive has been
uploaded and extracted. `zzz-calculator.service` continues to run as the
unprivileged `zzzcalc` user with `NODE_ENV=production`, listens on local port
`8787`, and is restarted only after the release and production configuration
have passed their preflight checks.

Separated application releases from downloadable Helper and OCR payloads.
Versioned binaries and their two manifests now live under the persistent root
`/srv/zzz-download-origin/downloads/zzz-scanner`. The active layout contains
`manifest.json`, `helper-manifest.json`, Helper
`1.2.1/ZZZ-Scanner-Helper.exe`, and both Scanner 1.0.38 packages. This directory
is intentionally outside `/opt/zzz_calculator/current`: an application rollback
or a new atomic release can no longer remove a working Scanner package, and
uploading a Scanner release no longer changes application source ownership.
The local repository `downloads/` directory remains ignored and is still a
release staging area rather than tracked source.

Added `deploy/nginx/zzz-calculator.conf` as the canonical edge configuration.
Nginx serves `/downloads/` directly from `/srv/zzz-download-origin` instead of
proxying large files through `backend/server.js`. This matters because the Node
fallback streams a complete file response and does not implement byte-range
selection, while CDN segmented origin fetches depend on valid Range behavior.
Nginx supplies Range-capable static responses, `sendfile`, an explicit
attachment disposition, and one-year immutable caching for versioned `.exe`
and `.zip` payloads. `manifest.json` and `helper-manifest.json` use
`no-cache, no-store, must-revalidate`, so a new release selection is never held
for the lifetime of a binary package. Generated Vite chunks under
`/static/app/` retain one-year immutable caching, while stable catalog assets
use a shorter seven-day cache and HTML continues through Node with `no-store`.

Changed the public package priority without removing disaster recovery.
Scanner 1.0.38 package lists now try the versioned Tencent CDN URL at
`https://download.zzzcaculator.top` first, retry the same persistent server
files through `https://zzzcaculator.top`, then use the relative same-origin
path for compatible self-hosted/Pages builds, and retain the matching GitHub
Release asset as the last fallback. Helper 1.2.1 follows the same CDN, main
server, GitHub order. The Vue download action now opens the versioned CDN Helper
URL rather than a GitHub Release URL. Package size and SHA-256 remain unchanged:
Helper `8137728` bytes / `d3c88f1f7556e9bab15f7129e253d2c5527b0f5009a84d52a7a0acd354f326ae`,
FDD Scanner `21785760` bytes /
`d63b89fbe07fba77fe641daa33b2aa8f5427f4b93fc95003fefe8c9750f7b78d`,
and self-contained Scanner `84835665` bytes /
`39be4d44d2b756db66f36b8308b055495e59ce4174cdb615399ceba293613bf4`.

Kept the main site and download endpoint deliberately separate. The browser
application remains on `https://zzzcaculator.top`, preserving the existing
origin-bound IndexedDB and localStorage data. The future CDN entry is
`https://download.zzzcaculator.top`; Tencent CDN can use
`https://zzzcaculator.top` as the HTTPS origin because the acceleration domain
is different from the source domain. This avoids a CNAME/origin loop while
reusing the production certificate and Nginx download route. The package
manifests keep the main host as an immediate fallback, so Helper-driven Scanner
installation can still complete if the CDN is unavailable.

Added `npm run build:server` and `scripts/package-server-release.js`. The command
builds the Vue application, copies only Git-tracked source into an isolated
staging directory, adds `dist/pages`, writes the full commit to
`.deployed-commit`, and emits
`output/zzz-calculator-server-<commit>.tar.gz`. The packager verifies that its
recursive cleanup target stays under the ignored `output/` root and verifies
both the embedded commit and non-empty archive before reporting success. The
server package never captures local downloads, logs, test artifacts, user data,
or untracked working files.

Converted `.github/workflows/pages.yml` to a manual legacy fallback. A push to
`main` no longer deploys GitHub Pages, and `scripts/build-pages.js` removes
`CNAME` from the fallback artifact so it cannot reclaim the production custom
domain. The Pages builder still verifies its generated SPA, static catalog,
configuration, manifests, and Scanner packages when an operator deliberately
invokes the fallback workflow. Its package source selection now identifies the
GitHub URL explicitly rather than mistaking the new first HTTPS CDN URL for the
release build source.

Extended repository, Scanner bridge, and Vue store tests to lock the new
contracts: CDN must be the first public package URL, the production server and
GitHub must remain fallbacks, the Nginx template must use the persistent
download root and current Vite release root, the Pages workflow must be
manual-only, and the Helper button must target the versioned CDN object.

## 2026-07-19 - Fixed Direct Settings Route On GitHub Pages

Removed the generated `settings.html` self-redirect. GitHub Pages resolves the
extensionless `/settings` URL to `settings.html` when that file exists, so the
redirect back to `/settings` could loop before Vue Router loaded. The Pages
artifact now deliberately omits `settings.html`; direct visits fall through to
the deployed SPA `404.html` while in-app navigation continues to use the normal
history route. The artifact verifier rejects any future `settings.html` output.

## 2026-07-19 - Fixed Legacy Helper Upgrade Dead End

Fixed the legacy Helper dead end in the Drive Disc scanner. The page now records
the Helper version and protocol before requesting any Scanner manifest. Helper
1.1.x never receives the unsupported schema-v3 `ensure_scanner` command, and a
known outdated Helper state takes priority over any stale structured Scanner
diagnostic. The error card now offers **Download and update Helper** and
**Recheck** instead of retry, log, and diagnostic actions that cannot resolve an
outdated Helper.

Added protocol-v3 automatic Helper updates. Helper 1.2.0 downloads and verifies
1.2.1 through `update_helper`; the page keeps the scan drawer open while the
Helper restarts, polls for reconnection, and resumes OCR preparation without
requiring the user to restart the workflow. Failed automatic updates expose
both **Retry automatic update** and **Download the latest version manually**.
The public settings page follows the same protocol-aware rules and never sends
unsupported storage or update commands to Helper 1.1.x.

Released Helper 1.2.1 with a one-time takeover installer for Helper 1.1.x. After
explicit confirmation, it stops an old process only when port 22355 identifies
itself as ZZZ Scanner Helper and exactly one process matches that service version.
It then installs and verifies the fixed managed copy, registers the protocol,
starts the managed Helper, and removes the downloaded bootstrap. Unknown port
owners, ambiguous processes, version mismatches, cancellation, termination
failure, and port-release timeouts leave every process untouched and report a
specific recovery action.

Helper 1.2.1 is `8137728` bytes with SHA-256
`d3c88f1f7556e9bab15f7129e253d2c5527b0f5009a84d52a7a0acd354f326ae`.
Scanner remains 1.0.38: the FDD package is `21785760` bytes with SHA-256
`d63b89fbe07fba77fe641daa33b2aa8f5427f4b93fc95003fefe8c9750f7b78d`,
and the self-contained package is `84835665` bytes with SHA-256
`39be4d44d2b756db66f36b8308b055495e59ce4174cdb615399ceba293613bf4`.
The Scanner packages were not rebuilt or replaced.

## 2026-07-19 - Added Targeted Drive Disc Effects And Move Tags

Added a move-tag layer alongside the existing top-level `skillType`. The first
catalog tags are `dashAttack`, `exSpecial`, and `assistAttack`; every current
Dash Attack, EX Special, and damaging Quick Assist/Assist Follow-Up stores its
tags explicitly. Damage-event resolution carries the tags through the standard
calculator, prepared calculator, compiled/dense scorers, optimizer, and browser
Worker. A Dash Attack remains a `dodge` skill, so tag-targeted bonuses no longer
need to broaden to Dodge Counters or rely on move-name/ID inference.

Extended skill targets with `kind: "skillTag"`. Multiple tags in one rule use OR
matching, while maintenance validation rejects mixed specific-move, skill-type,
and skill-tag modes, unknown/duplicate tags, missing targets, and invalid rule
requirements. The role-specific maintenance forms now expose move tags, a
skill-tag target mode, targeted Drive Disc two-piece rules, and rule-level
condition, duration, cooldown, coverage, stacks, and specialty requirements.

Added targeted Drive Disc two-piece execution. Ordinary two-piece stats still
contribute only to the out-of-combat panel. Skill-targeted two-piece rules are
automatically injected after the candidate/equipped set reaches two pieces,
without a manually active Buff ID, and are evaluated only when the damage event
has a matching skill source. Dawn Blossom now grants `+15%` Basic Attack damage
at two pieces and does not affect Ultimates or manually entered multipliers.

Modeled the requested four-piece effects for Astral Voice, Dawn Blossom, Shadow
Harmony, Chaos Jazz, Proto Punk, Chaotic Metal, Puffer Electro, Inferno Metal,
and Thunder Metal. The data records independent conditions and coverage,
duration/cooldown metadata, shared/default/max stacks, `baseAtk` scaling where
required, and Dawn Blossom's Attack-specialty gate. Conditional rules default
to full coverage and maximum stacks; duration never derives coverage.

Added `exclusiveGroup` handling for team effects. When the current wearer and
an external teammate both provide Proto Punk's same-name team damage bonus, the
current wearer's effect is resolved first, the external copy is ignored, and
the ignored-effect details record the exclusive-group reason. Regression tests
cover tag separation, targeted two-piece thresholds and event matching,
standard/prepared/dense/fixed/top-level optimizer parity, per-rule coverage,
shared stacks, specialty gating, and team-effect deduplication.

## 2026-07-19 - Removed Automatic Optimizer Panel Minimums

Removed the automatic ATK 2500, Anomaly Proficiency 250, CRIT Rate 80%, and
CRIT DMG 160% constraints from every character's optimizer settings. All four
fields now start unrestricted and remain available as optional user-entered
out-of-combat panel constraints.

Existing per-character settings migrate on load. Values that still exactly
match the former automatic defaults are removed, while other user-entered
minimums remain unchanged. This prevents the former four-way constraint from
blocking the Top 10 seed cutoff, disabling the objective-only scalar score
kernel, and forcing a strict-exact search to score most combinations before
upper-bound pruning can begin.

## 2026-07-19 - Added Local Storage Controls And Single-Version Scanner Lifecycle

Added a public `/settings` route and navigation entry. The page reports browser
origin usage separately from Helper-managed Scanner usage and provides two
independent confirmed actions. Browser cleanup closes the active IndexedDB
connection, deletes `zzz-calculator-user-store`, removes calculator and legacy
maintenance local-storage keys, and reloads the application. Scanner cleanup
requires a connected protocol-v3 Helper and reports exact Helper, runtime,
package, output, log, and reclaimable byte counts before removing anything.

Upgraded the distribution contract to ZZZ Scanner Next `1.0.38`, Helper
`1.2.0`, Helper protocol v3, and Scanner manifest schema v3. Every Scanner
package now includes a deterministic file manifest with per-file size and
SHA-256. Helper verifies the ZIP and extracted tree against that remote
manifest, deletes the ZIP after installation, and can continue validating the
installed runtime without retaining a duplicate archive.

Helper now persists the last Scanner version and package that completed the
child WebSocket handshake. Cleanup uses this activation receipt rather than
the latest downloaded manifest, so an unverified update can never cause the
working runtime to be deleted. After a successful replacement, automatic and
manual cleanup remove all inactive runtimes, legacy package ZIPs, partial
downloads, and temporary directories. Existing `runtime/**/Scans` data is
migrated into the version-independent `outputs` directory; only the newest
successful session and newest failed session are retained.

Helper now installs into the fixed current-user path
`%LOCALAPPDATA%\ZZZScannerNext\helper\ZZZ-Scanner-Helper.exe`. The first run
requires explicit confirmation, verifies the copied executable, registers the
protocol to the managed path, and removes the downloaded bootstrap after the
managed process starts. A separate HTTPS/SHA-256-verified Helper manifest and
transactional updater support future self-updates with a temporary backup and
startup rollback. Helper `1.1.0` remains a one-time manual transition because
it predates the update protocol.

Added protocol request correlation for `get_storage_info`, `cleanup_storage`,
and `update_helper` without replacing scan callbacks. Added .NET regressions
for manifest-v3 integrity, activation persistence, legacy-output migration,
single-version cleanup and managed output roots, plus Vue/bridge regressions
for browser clearing, storage reporting, cleanup confirmation and update
progress. Release artifacts remain below the existing 10/25/90 MiB Helper,
FDD, and self-contained gates.

## 2026-07-19 - Clarified Drive Disc Inventory Toolbar Actions

Renamed the Drive Disc inventory toolbar commands to distinguish single-record
editing from whole-inventory transfer: `新增` is now `新增单个`, while `导入` and
`导出` are now `批量导入` and `批量导出`. The underlying editor, import preview,
account-scoped export, disabled state, and scanner behavior are unchanged.

Moved the toolbar's primary blue emphasis from batch import to Scan. Import,
export, add, and refresh now use the standard button treatment, while Scan is
the single primary toolbar command. Existing Plus, Refresh, Upload, Download,
and Radar icons remain unchanged. Added a Vue regression that locks the five
labels, their order, and the single-primary-button contract.

## 2026-07-18 - Added Teammate Attribute And Specialty Filtering

Added role-level `attribute` and `specialty` metadata to the teammate Buff
catalog. The original 23 teammate groups use the official HoYoWiki agent
classification, while the concurrently added Jane Doe group keeps its existing
Physical/Anomaly profile. The catalog remains version 2 because these fields are
backward-compatible additions and no Buff IDs or saved `activeBuffIds` changed.

The teammate Buff picker now provides clearable multi-select controls for
attribute and specialty. Values within one control use OR; the two controls use
AND with each other and with text search. Options are derived from the loaded
teammate groups in catalog enum order, and bulk add/remove only affects the
filtered visible Buffs. Filters survive tab changes within one open dialog and
reset whenever the dialog is reopened. Groups without metadata remain visible
until a teammate filter is active.

The maintenance role editor now requires both fields, shows their Chinese labels
in list summaries and search, and preserves them through catalog cleaning,
storage, `/api/catalog`, and `/api/meta`. Added contract, validation, API,
maintenance-view, picker, bulk-selection, reset, compatibility, and responsive
layout coverage.

## 2026-07-18 - Added Jane Doe Teammate Buffs And Effective Anomaly Duration

Added Jane Doe as a teammate-centered Buff group from the official HoYoWiki
page and official 300x300 PNG asset. Only effects that can benefit teammates are
included: Core Passive F, Cinema 2, and Cinema 4. Self-only Cinema 1/3/5/6 and
the Additional Ability remain excluded. The catalog records the official page
and original image URL alongside the local `jane_doe.png` asset.

Introduced the structured Anomaly effect target
`{ kind: "anomaly", settlementType, anomalyEffects }`. Maintenance can now
choose Attribute Anomaly or Disorder and one or more concrete effects without
storing the retired `appliesTo` shape. Validation, cleaning, readable summaries,
maintenance POST round trips, and the structured Vue editor all preserve this
target. The player custom-Buff whitelist deliberately does not expose raw
duration extension because it has no Anomaly-target selector.

Added `anomalyDurationBonusSeconds` as a raw-seconds event modifier. Disorder
normalization now preserves elapsed values beyond the base duration after
snapping to the source effect's tick interval. Catalog previews remain based on
catalog duration, while final calculation sums matching duration Buffs and then
recomputes effective duration, elapsed time, remaining time, tick count, and
base multiplier. The normal white-box route, fast total, compiled scorer, dense
scorer, fixed-set objective kernel, and optimizer therefore share the same
effective-duration result. Duration extension does not synthesize additional
Attribute-Anomaly proc counts.

Jane's Core extends Flinch from 10 to 15 seconds, making a full-duration Flinch
Disorder `450% + 15 x 7.5% = 562.5%`; the same event entered at 0.5 seconds
normalizes to one elapsed Flinch tick and resolves to 555%. The Core's Assault
Anomaly CRIT Rate uses `clamp(40 + Jane AP x 0.16, 0, 100)%` with a default and
maximum runtime input of 375 AP, and grants 50% Anomaly CRIT DMG. Cinema 2 adds
15% DEF ignore and another 50% Anomaly CRIT DMG to Assault only. Cinema 4 adds
18% Attribute Anomaly DMG to catalog Attribute Anomalies and does not enter the
Disorder DMG bucket. Selecting an entry represents satisfied trigger conditions;
no Buff timeline or uptime simulation was added.

Added regressions for unchanged 525% Flinch, extended 562.5% and 555% results,
elapsed values beyond ten seconds, nonmatching Disorder and Attribute Anomaly
isolation, runtime AP and CRIT caps, Cinema 2 defense targeting, Cinema 4 bucket
isolation, white-box duration disclosure, compiled/dense/fixed parity,
maintenance validation and API persistence, event-editor persistence beyond
base duration, and the maintenance Anomaly-target controls.

## 2026-07-18 - Completed Ye Shunguang Cinema 4/6 And Cinema-6 Default Loop

Compared Ye Shunguang's maintained data with the official HoYoWiki agent page.
The existing Cinema 1 damage bonus and defense ignore were retained, as was the
Cinema 2 skill-specific defense ignore and its separate resource-rich short
axis. Cinema 3 and Cinema 5 remain represented by the explicit skill-level
controls instead of being duplicated as combat Buffs. Added the previously
missing Cinema 4, Common Darkness, and Cinema 6, Light's Wish, descriptions and
calculation data. The official HoYoWiki page was added to the agent's source
list.

Introduced `stunDmgMultiplierBonusCapAlways` as a first-class event modifier for
captured stun vulnerability. A stored value of `110` means the captured
vulnerability bonus is capped at 110%, so the final multiplier cannot exceed
`2.1`; `200` caps it at `3.0`. A matching cap rule deliberately uses the target's
configured stun multiplier even when the event itself is marked as not stunned.
Events without the new rule keep the previous per-event stun behavior exactly.
The cap now flows through direct, sheer, anomaly, Disorder, white-box, compiled,
dense, fixed-set, and optimizer score paths.

Added the 110% curtain cap to Ye Shunguang's Core Passive and targeted it only
to maintained Clarity-state attacks. The entry attack and Chase Cloud, Startled
Thunder are excluded because they open the veil rather than execute inside the
already active veil. Cinema 4 uses the existing cross-Buff
`multiplyResolvedValue` operation with a factor of `20 / 11`, raising that same
rule to 200%. This preserves the dependency on the Core Passive: selecting
Cinema 4 alone does not create curtain vulnerability. The opening 1000 Decibels
remain documented but do not synthesize another Ultimate in a calculation
window that has no duration or Decibel budget.

Modeled both Cinema-6 final-hit additions as move-targeted
`skillMultiplierBonus: 1500` rules. Return to Dust and Cut Delusion, Open Heaven
each receive `+15` internal skill multiplier, while unrelated attacks remain
unchanged. Keeping the addition on the triggering move preserves its CRIT,
damage bonus, defense, resistance, and stun zones; in particular, Cut Delusion's
additional damage continues to receive Cinema 2's 40% defense ignore.

Added the `6影叶12变6大` administrator variant. It reuses the Cinema-2 short
axis twelve times, retains two paid Chase Cloud Ultimates, and models Light's
Wish replacements on the first and every third subsequent Clarity entry. Four
of the former ten Return to Dust finishers become Cut Delusion finishers, for a
final aggregate of six Cut Delusion and six Return to Dust finishers. Variant
resolution is now 0-1 to the base axis, 2-5 to the Cinema-2 axis, and 6 to the
new Cinema-6 axis.

Added regression coverage for 150%, 250%, and 350% configured stun multipliers;
Cinema-4 cap behavior; non-stunned curtain events; non-Clarity isolation; the
Core Passive dependency; Cinema-6 multiplier targeting; Cinema-2 defense-ignore
inheritance; exact loop counts and skill-group expansion; maintenance cleaning;
and dense/compiled score parity. Also aligned an in-progress Jane Doe anomaly
CRIT white-box assertion with the calculator's correct `1 + rate * CRIT DMG`
formula.

## 2026-07-18 - Added Account-Scoped Drive Disc JSON Export And Reimport

Added a local Export command beside Import in the Drive Disc inventory toolbar.
The command serializes every Drive Disc owned by the current account regardless
of the active search, slot, or main-stat filters. Empty inventories disable the
command. Other accounts, import history, and Drive Disc loadouts are excluded.
The browser creates and downloads the UTF-8 JSON Blob directly without calling
a server, then revokes the temporary object URL after the download begins.

Defined the versioned `zzz-calculator-drive-disc-export` format with version 1,
an ISO export time, a human-readable source-account label, and a `driveDiscs`
array. Each exported record keeps its stable ID, set identity, slot, rarity,
level, main and substats, lock and equipped-agent state, source metadata, raw
scanner provenance, and stored timestamps. Account ownership and the derived
content/identity fingerprints are deliberately removed because the target
account is selected at import time and both fingerprints are recomputed.

Extended the shared import planner without changing the existing scanner API.
Objects carrying the native format marker are validated strictly instead of
being passed through the scanner's Chinese-field converter. Unknown formats,
unknown versions, invalid dates, duplicate native IDs, invalid slots, missing
set identity, malformed stats, and non-array substats now fail with explicit
messages. Scanner arrays and scanner wrapper objects retain their previous
normalization and merge behavior.

Native imports always bind records to the currently selected account and never
create or switch accounts from source metadata. A same-account ID match is
updated in place so existing loadout references remain stable; an identical
record is reported as unchanged. When no ID matches, the existing content and
identity reconciliation remains available. Distinct native IDs with identical
stats are retained when restoring into an empty account. Merge remains the
default, while the existing explicit remove-missing confirmation performs an
account-scoped mirror and clears removed IDs from affected loadout slots.

Renamed the import dialog to Drive Disc JSON and clarified that it accepts both
ZZZ Scanner and calculator-native exports. Added shared-model, browser-store,
and Vue regressions for account filtering, metadata stripping, safe Windows
filenames, Blob download lifecycle, round-trip restoration, duplicate-content
records, same-ID updates, repeat imports, remove-missing reconciliation, legacy
scanner compatibility, unsupported versions, and malformed native payloads.

## 2026-07-18 - Made Disorder Timing Granularity Effect-Specific

Corrected Disorder elapsed-time normalization so it no longer assumes every
source anomaly settles in half-second slices. The selected Disorder catalog
entry's `tickIntervalSeconds` is now the single timing source: Burn and
Corruption use `0.5` seconds, while Shock, Flinch, Frozen, and Miyabi's Frost
Frozen use `1` second. The base-multiplier helper resolves the interval before
normalizing elapsed time, then uses that same value for remaining time, tick
count, and `fixedMultiplier + ticks * tickMultiplier`.

Extended the shared elapsed-time normalizer with an optional step argument
while retaining the previous `0.5`-second default for compatibility. Known
events now snap to the nearest selected interval. Existing whole-second events
containing values such as `4.5` are normalized lazily to `5` when loaded or
saved; no persisted schema, field, or bulk migration was added. Unknown or
incomplete legacy effects continue to use the half-second fallback. Stored
elapsed values are not truncated to the catalog base duration, so a later
effective-duration bonus can still evaluate the original timeline position.

Updated both event-management surfaces. The player workbench and administrator
default-loop editor now use a `0.5` step with one decimal place for Burn and
Corruption, and a `1` step with integer display for Shock, Flinch, Frozen, and
Frost Frozen. Switching the source anomaly immediately re-normalizes the
current elapsed value against the new interval. The maintenance API cleaner
consumes the same resolver, preventing browser previews and saved agent defaults
from drifting apart. Base-only previews show zero remaining ticks beyond the
catalog duration; final calculation clamps against the effective duration after
matching duration bonuses are applied.

Revised the live Disorder explanation to state both interval groups and show
the selected formula explicitly. Half-second effects display
`floor(T / 0.5)`, while whole-second effects display `floor(T)`. For Miyabi's
Frost Frozen with a legacy `4.5`-second value, the explanation now derives
`20 - 5 = 15` remaining seconds, `15` ticks, and an unchanged `1725%` base
multiplier. Polarized Disorder and event-ratio steps still build on that shared
base result.

Added core, Vue, administrator-maintenance, and API regressions for the two
interval families, nearest-step rounding, elapsed-time preservation beyond the
base duration, source-effect switching, input step and precision, formula
wording, and the Frost Frozen `4.5 -> 5` compatibility case. Updated the
modeling guide and long-term regression contract to make catalog-driven timing
a cross-platform invariant.

## 2026-07-18 - Moved Stun State From The Target To Individual Events

Removed the global stun-enabled checkbox from the enemy-target panel. The
panel continues to own the initial stun multiplier, but each Direct, Sheer,
attribute Anomaly, Disorder, and skill-group event now stores an explicit
`stunned` boolean. New and previously unannotated events default to `true`.
Non-administrator calculation modes expose a labeled yes/no switch in the
event detail editor and show the resulting stunned or non-stunned state in the
left event summary. Administrator defaults display the same value as readable
static text, while the structured maintenance editor can author it for base
loops, Cinema variants, skill-group references, and group child events.

Defined skill-group precedence at the expansion boundary: the reference
event's `stunned` value overwrites every expanded child, even when a child has
a conflicting catalog value. This makes a skill group behave as one timeline
event and guarantees that the workbench, browser worker, backend calculator,
and optimizer receive the same flattened status.

Reworked the damage target and every calculation kernel so stun activation is
event-local. Direct, Sheer, Anomaly, Disorder, white-box, fast-total, compiled,
dense, fixed-direct, and fixed-non-direct paths now share the same rule. A
stunned event applies the configured target multiplier plus normal and
always-active stun multiplier bonuses. A non-stunned event uses the neutral
multiplier plus only `stunDmgMultiplierBonusAlways`. Mixed-event calculations
therefore preserve their individual stun zones without splitting the request.

Added lazy compatibility for existing saves and raw calculation payloads.
Non-administrator events without the field inherit an old
`damage.target.stunned` value before the target-level field is discarded;
explicit event values win, and otherwise the new default is `true`.
Administrator-default mode ignores the legacy global value and resolves the
latest administrator-authored events. New persistence no longer writes target
`stunned`. Maintenance validation rejects non-boolean event values, and the
maintenance cleaner preserves the normalized field across skill groups and
default-calculation variants.

Added regression coverage for mixed stunned/non-stunned Direct, Sheer,
Anomaly, and Disorder behavior; legacy migration and administrator priority;
skill-group override; maintenance validation and API round trips; workbench
editing and read-only rendering; and exact agreement among normal, compiled,
dense, and specialized scoring paths.

## 2026-07-18 - Added Live Event Multipliers And Half-Second Disorder Timing

Reworked the workbench event manager so every resolvable damage event exposes
its current event multiplier in both the left target list and the right detail
editor. Direct and Sheer events resolve the selected row at the character's
current skill level. Attribute Anomaly events multiply the catalog base value
by their proc count. Disorder events reuse the calculation model's catalog
duration, fixed multiplier, remaining tick count, tick multiplier, and normal
or Polarized scale, so changing the source effect, Disorder type, or elapsed
time immediately changes the visible value. Skill-group wrappers intentionally
have no synthetic mixed multiplier; their read-only child preview now reports
the resolved multiplier for each child event instead.

The multiplier preview folds in stored `damageRatioPct` or legacy
`damageScale`, while leaving the separate event `count` out of the value. This
keeps Alice's `713% * 2.5%` follow-up visible as its actual `17.825%` event
multiplier without presenting `2.5%` as though it were a skill-table value.
CRIT, damage bonus, defense, resistance, stun, Anomaly Proficiency, and other
final-damage zones remain outside the preview. Values use at most three decimal
places with insignificant trailing zeroes removed.

Removed the editable damage-ratio control from the player-facing event manager
only. The persisted `damageRatioPct` and `damageScale` contracts, structured
maintenance field, administrator defaults, existing browser saves, white-box
calculation, fast totals, compiled scoring, and optimizer paths remain intact.

Centralized damage-scale normalization, Disorder base-multiplier resolution,
Polarized scaling, event-preview resolution, and elapsed-time normalization in
a lightweight shared core module. Disorder elapsed time now rounds to the
nearest `0.5` seconds and clamps to the catalog duration in the calculation
core, workbench drafts, structured maintenance controls, and maintenance API
cleaning. Both workbench and maintenance number inputs use a `0.5` step and
one-decimal display, so the UI cannot continue producing the former `0.1`
increments.

Added calculation regressions for half-second rounding, duration clamping,
normal and Polarized Disorder, hidden event scale, direct and Anomaly
multipliers, and the exclusion of event count. Added Vue coverage for exact
skill multipliers, `17.825%` scaled Assault, live `1450%` to `1400%` Burn
Disorder updates, ratio-field hiding, saved half-second values, child-event
previews, and maintenance-only ratio preservation.

Verified the completed behavior with the full root regression suite, all 248
Vue unit tests, the production build (including `vue-tsc --noEmit`), and all 16
responsive Playwright layout cases. A live desktop and 390 px mobile browser
check confirmed that the event list and detail panel agree, Burn Disorder
updates from `1450%` at `0.0` seconds to `1400%` at `0.5` seconds without a
save cycle, the player-facing damage-ratio label is absent, and the modal has
no horizontal overflow or browser-console warnings. The maintenance API
integration additionally verifies that `3.2` seconds persists as `3.0` and a
value beyond the selected Disorder effect's duration persists at the catalog
limit.

## 2026-07-18 - Simplified Player Custom Buff Types Without Restricting Maintenance

Reduced the workbench custom Buff dropdowns to a player-facing whitelist while
leaving the combat model and structured maintenance editor intact. The global
and skill-targeted user lists no longer expose six separate element variants
for Sheer DMG, event CRIT DMG, event DEF ignore, enemy resistance reduction,
or resistance ignore. The Alice-specific "Anomaly Mastery above 140 converts
to Anomaly Proficiency" stat is also no longer selectable as a user-authored
Buff because it is a maintained character mechanic rather than a primitive
manual input.

The simplified lists retain generic Sheer DMG, global CRIT DMG, generic DEF
ignore, current-attribute resistance reduction, current-attribute resistance
ignore, and all-attribute resistance ignore. Physical, Fire, Ice, Electric,
Ether, and Wind damage bonuses remain separate as requested. Independent
advanced mechanics such as Anomaly and Disorder damage, multiplier additions,
Anomaly CRIT, and Stun multiplier additions remain available. Skill-targeted
Buffs deliberately do not gain a new generic CRIT DMG calculation semantic.

Reused the existing canonicalization path instead of changing calculation
fields. Current-attribute resistance ignore resolves to the selected agent's
explicit element resistance-ignore key before saving, while current-attribute
resistance reduction remains `enemyResReduction` and is evaluated against the
damage event's element. The exported option tuple shapes, custom `stats` and
`effects` payloads, local-storage format, maintenance validation, maintenance
option catalog, and every underlying element-specific stat remain unchanged.
Existing custom Buffs that contain a now-hidden element-specific stat continue
to render, persist, and calculate normally; the restriction applies only to
new choices in the workbench.

Added shared-option contract tests for every removed element-stat family and
every retained element damage bonus, component tests for all three target
modes and both current-attribute aliases, a legacy custom-Buff preservation
fixture, maintenance assertions for the complete explicit stat catalog, and
white-box equivalence checks comparing the simplified aliases with explicit
Ice resistance fields for global and skill-targeted damage.

Verification completed with the focused shared-combat, damage-whitebox,
Buff-picker, and maintenance suites; the full `npm test` chain; a standalone
`npm run build:webapp`; and `npm run test:layout`. The full Vue run passed all
26 test files and 237 tests, the optimizer fuzz suite passed 160 seeds, and all
16 Playwright layout cases passed across 1920, 1366, 125% desktop scale, and
390x844 mobile projects. A production server with maintenance enabled was then
inspected in a real browser at 1440x1000 and 390x844. The workbench search
returned current-attribute resistance aliases and Fire damage while returning
no result for Fire Sheer DMG, the Anomaly Mastery threshold, or skill-targeted
generic CRIT DMG. Maintenance still returned the threshold plus explicit
element Sheer DMG, CRIT DMG, DEF ignore, resistance reduction, and resistance
ignore. Both workbench viewports had zero document-width overflow, and the
workbench and maintenance inspections reported zero console errors or warnings.

## 2026-07-18 - Replaced Alice's Physical-Only Disorder Stats With Unified Stacks

Removed the two Alice-only combat stats for remaining physical-anomaly time and
the physical Disorder multiplier cap. Those fields bypassed the calculator's
existing anomaly multiplier contract, appeared as generally selectable Buff
types in maintenance controls, and duplicated the established
`disorderBaseMultiplierBonus` event-modifier bucket.

Alice's Core Passive now contains one stacked `disorderBaseMultiplierBonus`
rule. Each stack adds 18% to the Disorder base multiplier; the rule defaults to
10 stacks and allows at most 10 stacks. The workbench therefore exposes one
ordinary layer control instead of two physical-only coverage controls, while
the default result remains a 180% multiplier addition.

Deleted the obsolete stat registrations and all physical-only branches from
the scalar, compiled, dense, and fixed-set damage paths. Added regression
coverage for the Core Passive data shape, default 10-stack result, manual
5-stack result, unified non-physical Disorder behavior, and the absence of both
obsolete options from the shared and maintenance Buff selectors.

## 2026-07-18 - Fixed Systemic Anomaly Mastery Percentage Loss

Corrected a cross-path stat-model error that treated stored Anomaly Mastery
percentages as flat points. A 30% slot-6 main stat was divided to `0.30` and
then added directly to the panel, so Alice's Core Skill F white stat appeared
as `142.3` instead of `184.6`. The same alias affected W-Engine advanced stats,
in-combat percentage effects, prepared calculations, dense score compilation,
fixed-event objective kernels, and Drive Disc optimization.

Split the internal totals into `anomalyMasteryPct` and
`anomalyMasteryFlat`. Core Skill panel-point additions now form part of the
stable white stat before out-of-combat percentages are applied. The ordinary,
summary, indexed, dense, fixed-direct, mixed-event, browser-local, and strict
optimizer paths all use the same Anomaly Mastery formula. In-combat percentage
effects scale the out-of-combat panel, matching the existing Impact contract,
while fixed effects such as Tenfold Starforge remain additive after percentage
scaling. Existing inventory and maintenance payloads remain compatible because
they continue to store percentage sources as `anomalyMastery` with
`mode: "pct"`.

Restored Phaethon's Melody's missing 2-piece effect as 8% Anomaly Mastery. For
Alice at Core Skill F, the 106 agent base plus three 12-point Core Skill nodes
forms a white stat of 142. A 30% slot-6 main stat and the 8% 2-piece effect now
produce `142 * 1.38 = 195.96`; her additional ability converts the amount above
140 into `89.536` Anomaly Proficiency. Calculation and optimization retain the
full precision, while the Vue panel truncates the displayed total to the
in-game value `195`.

Expanded regression coverage for the no-disc, 30%, and 38% Alice panels; the
Anomaly-Proficiency conversion; Phaethon activation metadata; W-Engine
percentage and flat buckets; prepared map and indexed summaries; dense and
fixed objective scoring; strict-versus-legacy ordered Top 10 optimizer parity;
browser-local optimizer parity; 160-seed optimizer fuzzing; and game-style Vue
panel display. Historical Alice and optimizer changelog entries remain
unchanged.

## 2026-07-18 - Added Container-Aware Layout Protection

Replaced the event-management modal's viewport-dependent 12-column field grid
with shared, container-aware form primitives. The affected numeric and select
controls now receive a real minimum track width, labels wrap instead of being
clipped, and the `已流逝秒数` disorder field remains fully visible beside its
number stepper. The same contract now covers optimizer settings, Buff filters
and custom effects, Drive Disc editors and analysis, target settings, workbench
compact controls, and the structured maintenance forms.

Added explicit layout surfaces and protected-field markers, converted nested
component breakpoints to container queries, and retained viewport media queries
only for page-shell behavior. Dense lists may still use intentional ellipsis,
but their full names and metadata are available through native hover text.

Added a pinned Playwright layout suite and CI Chromium installation. The suite
checks 1920x1080, 1366x768, 1536x864 at 1.25 device scale, and 390x844. It opens
the live event, optimizer, Buff, Drive Disc, analysis, and maintenance flows and
fails on clipped labels, controls escaping their fields, protected surfaces
escaping the viewport, or unintended document/surface horizontal overflow.

Documented the shared CSS contract in `docs/frontend-layout-contract.md` and
added `npm run test:layout` to both README files and the release checklist.

## 2026-07-17 - Completed Alice Damage, Buff, Cinema, And Optimizer Modeling

Replaced Alice's hidden placeholder record with an official Mihoyo-backed role
definition. The role now exposes her core passive, additional ability, Cinema
1/2/4/6 descriptions and rules, 0/2/6-Cinema administrator calculation loops,
and both Anomaly Mastery and ATK% as legal slot-6 optimization candidates. The
default loops deliberately optimize anomaly output: one Polarized Assault, ten
2.5% physical-anomaly follow-ups, and one full-duration physical Disorder at
Cinema 0; the Ultimate-triggered second Polarized Assault at Cinema 2; and six
winning-state follow-ups at Cinema 6.

Added reusable calculation primitives instead of branching on Alice's role ID.
In-combat effect rules can now convert Anomaly Mastery above 140 into Anomaly
Proficiency, add a capped physical-Disorder multiplier from remaining duration,
scale any damage event with `damageRatioPct`, label Assault as Polarized
Assault, and use Anomaly Proficiency as a direct event's base value. Alice's
Cinema 6 row is stored in the skill catalog as `3300%` Anomaly Proficiency and
the default event forces CRIT, matching the official mechanic.

Propagated the new fields through normalization, white-box rows, fast total
damage, compiled score-only evaluation, dense optimizer evaluation, fixed-set
objective kernels, maintenance validation, API cleaning, maintenance controls,
workbench event controls, and readable event labels. The optimizer relevance
metadata now includes Anomaly Mastery whenever an active conversion can feed an
Anomaly Proficiency objective. Descriptive cinema entries with no ordinary
effect rules are valid when their damage is represented by explicit events.

Corrected the workbench runtime mode for role-owned default loops. Catalog
entries still describe their internal objective as `custom`, `single`, `sheer`,
or `anomaly`, but the loaded workbench configuration is now marked
`adminDefault`. This keeps the event editor read-only and lets an in-place
Cinema change refresh Alice from the 0-Cinema loop to the 2- or 6-Cinema
variant instead of retaining stale events.

Added `tests/alice-damage.test.js` to lock the 1.6 conversion, 2.5% follow-up
ratio, 18%-per-second/180%-cap physical Disorder bonus, Cinema 1 defense
reduction, Cinema 2 anomaly bonus, Cinema 4 physical resistance ignore, Cinema
6 Anomaly-Proficiency basis and guaranteed CRIT, non-physical Disorder
exclusion, and compiled-versus-legacy score equivalence.

This changelog is the long-form maintenance log for `zzz_calculator`. Every
future change to the Zenless Zone Zero calculator should be appended here with
the reason, the files touched, the model impact, and the verification performed.

## 2026-07-17 - Added First-Class All-Attribute RES Ignore

Added `allResIgnore` as a stored-percent combat stat with the Chinese display
label `全属性抗性无视%`. The stat is accepted by maintenance validation, normal
and skill-targeted effect rules, workbench custom Buffs, catalog metadata, and
the Drive Disc optimizer's percentage-stat handling. Existing physical, fire,
ice, electric, ether, and wind resistance-ignore fields remain supported.

Damage calculation now adds all-attribute resistance ignore to the matching
element-specific resistance ignore for direct, anomaly, disorder, and sheer
events. This behavior is implemented in the explanatory calculation, compiled
score, dense score, fixed direct kernel, and mixed-event optimizer kernel.
`allResIgnore` remains distinct from `enemyResReduction`; both contribute to
effective resistance without changing each other's stored or displayed
semantics.

Migrated four catalog effects to one `allResIgnore` rule each: Liuyin Cinema 1,
Lucia Elowen Cinema 1, the 3.0 phase-2 Jijing Chefeng field Buff, and the 3.0
phase-3 Yanwang field Buff. Liuyin no longer aliases resistance ignore to enemy
resistance reduction. Jijing now applies to every damage element instead of
materializing only wind and ice rules. Yanwang retains its Chain Attack and
Ultimate skill targets and now renders one concise line instead of six repeated
element lines. Top-level Buff IDs, values, stack behavior, and coverage metadata
remain unchanged.

Added regressions for stored-percent conversion, maintenance save/reload,
default and skill-targeted custom options, cross-element application,
all-plus-element stacking, migrated catalog shape, Yanwang skill gating,
Buff-picker text, and map/dense/fixed-kernel optimizer equivalence. Aligned the
skill-target aggregate counts with the consolidated Yanwang rule and the
already-present `winning_state_followup` catalog move. Also disambiguated the
skill-row and calculation-event damage-basis option exports so the existing
maintenance workspace builds without a duplicate symbol.

Verification completed with `npm test`, `npm run build:webapp`, and the focused
maintenance/calculation suites. The production build was served at
`http://127.0.0.1:8897/` and inspected in Chrome through Playwright at
1440x1000 and 390x844. Yanwang displayed exactly one all-attribute
resistance-ignore line, its mobile card had equal scroll and client widths, and
the browser console reported zero errors and zero warnings.

## 2026-07-16 - Moved Boss Buff Selection Into The Unified Picker

Restored the enemy-target panel to the 1588, 476, 953, and Custom defense
presets. Boss encounters are no longer selected from that panel and no longer
overwrite defense or elemental resistance. Existing Specific Boss saves move
their encounter into normal combat-Buff selection and reset the target to the
953 preset with zero resistance while preserving stun settings.

Added a Boss Buff tab to the unified picker with version, phase, and Boss-name
filters derived from every maintained appearance. Boss Buffs are globally
single-select, retain their runtime stack controls, and remain independent from
field Buffs. Boss cards show profile target metadata, enemy intel, player buffs
and debuffs, and calculation status.

Advanced `data/bosses.json` to schema version 2 and removed standalone
`mechanics` and `scoreRules` collections from data, maintenance forms,
validation, API responses, and flattened meta. Legacy maintenance payloads are
accepted but those removed fields are discarded instead of being persisted.

## 2026-07-16 - Added Versioned Boss Archives And Critical Assault Rules

Introduced `data/bosses.json` as the canonical Boss archive and separated stable
profile data from versioned encounter rules. Boss profiles now own names,
aliases, local WebP images plus their original URLs, defense, weaknesses,
resistances, and exceptional resistance overrides. Encounters own appearances,
full enemy-intel text, recommended specialties, player buffs and debuffs,
non-damage mechanics, score rules, sources, and visibility. The loader flattens
each encounter into the existing `sourceType: "boss"` calculation contract, so
`activeBuffIds` and `runtimeInputs` remain shared with every other combat Buff.

Added the 3.0 Critical Assault phase 3 records for 焚昼余火·法厄同（异变能量体）,
恶名·庞培, and 秽息妖鬼·名可名 at defense 952 with their exact weakness and
resistance sets. Their local portraits live under
`webapp/public/assets/bosses/`. Full-stack defaults model `-125%` CRIT DMG from
five 赴火 layers, `+60%` CRIT DMG from four 不利 layers, and `+48%` anomaly
damage from six anomaly layers. Enemy outgoing damage, 狂咲-only damage,
stagger, shield clearing, and shield-reduction efficiency remain fully visible
as descriptive entries but do not produce calculation rules. All maintained
1250/1500/2000, 350, and 1700 operation-score conditions are retained.

Rebuilt Boss maintenance as a Boss-profile and encounter-version master-detail
editor. Administrators can create a Boss, add or copy an encounter with all
owned IDs regenerated, append return appearances, edit modeled and descriptive
effects, and delete either one version or the complete profile. The API writes
the single archive atomically, validates required image provenance, nonnegative
integer defense, weakness/resistance overlap, duplicate Boss phases, and
calculation-status consistency, then returns `savedItem`, `savedBoss`, and
`savedEncounter`. Existing flat Boss Buff POST and delete requests remain
supported through the previous `combat_buffs.json` adapter.

The workbench target panel now has Specific Boss, Generic Preset, and Custom
modes. Specific Boss selection synchronizes defense and all six resistances,
makes those target values read-only, enables exactly one encounter, exposes
zero/full-stack shortcuts, and displays the complete intel, mechanisms, score
rules, and unmodeled labels. Switching away clears `bossEncounterId`; selected
field Buffs stay untouched. Existing 1588, 476, and 953 defense presets and old
saves without a Boss encounter remain compatible. Added catalog, validation,
atomic maintenance API, Pinia independence, calculation white-box, responsive
UI, and production-build regressions.

## 2026-07-16 - Added Independent Teammate W-Engine Refinement

Added a refinement selector to every selected teammate-carried W-Engine in the
Vue Buff picker. Each selector follows the source W-Engine's catalog range and
defaults to refinement 1. Changing it immediately rematerializes the displayed
effects while preserving that Buff's rule-level runtime inputs. The modal keeps
selection, refinement, and runtime changes in its draft until Apply; individual
or bulk removal clears the associated reference and runtime state, and Cancel
leaves the saved build untouched. The workbench enabled-Buff summary now shows
the selected refinement.

Reused the existing per-agent `combat.addedBuffs` contract with lightweight
`sourceKind: "wEngineTeam"` references instead of copying catalog Buff data. New
saves keep each active team W-Engine ID and refinement reference together, while
older configurations containing only a valid reference are restored as active.
Loading clamps stored UI levels to the referenced W-Engine's supported range,
defaults missing or non-numeric levels to refinement 1, and leaves unrelated
custom Buff records unchanged. The owner-scoped localStorage key and version do
not change. Custom lists and counts now include only `sourceKind: "custom"`
entries.

Build input projects those references into
`combatBuffs.wEngineTeamModificationLevels`, so workbench calculation and Drive
Disc optimization materialize the same team Buff strength. The calculation core
retains its strict direct-input fallback for invalid levels. Added focused
utility, modal, store, calculation, optimizer, persistence, and responsive UI
regressions for refinement 1/3/5, compatibility restoration, draft behavior,
and desktop/mobile layout.

## 2026-07-16 - Added 3.0 Critical Assault Phase 3 Field Buffs

### Catalog And Calculation Modeling

Added the three selectable field Buffs from Critical Assault version 3.0 phase
3 to `data/combat_buffs.json`: 湮亡, 凛息, and 构析. All three records use the
canonical `critical_assault / 3.0 / 3` period metadata, the maintained source
name `危局强袭战`, and `3.0版本第三期` as the compatibility period label. This
allows the existing version, period, and name controls to discover them without
hard-coded UI options and preserves the existing rule that only one field Buff
from the same period can be selected.

湮亡 models 30% all-attribute resistance ignore for Chain Attacks and Ultimates
as six explicit element resistance-ignore rules with canonical `skillType`
targets. Its post-Chain-Attack team ATK and CRIT DMG bonuses use two rules in one
shared stack group: each layer grants 10% of out-of-combat ATK and 15% CRIT DMG,
with three layers selected by default. The literal description retains the 20%
Daze increase, but no structured `impactPct` effect was added because changing
the Impact panel is not semantically equivalent to Daze dealt and the calculator
does not currently settle Daze values.

凛息 adds 20% Wind DMG, 20% Ice DMG, and 20 Anomaly Proficiency as permanent
field effects. Its anomaly-triggered 10% all-attribute resistance reduction and
10% attribute-anomaly damage bonus have separate per-effect coverage controls;
the anomaly bonus intentionally does not affect Disorder. 构析 adds 45 Anomaly
Proficiency and represents its anomaly-state and Disorder triggers as independent
10% and 15% enemy DEF reduction rules. At full coverage they combine to 25%,
while either trigger can be disabled or assigned a different runtime coverage.

### Documentation And Regression Coverage

Updated the Field Buff modeling example from the obsolete
`critical_node / 2.8` values to the maintained `critical_assault / 3.0` contract.
Added a dedicated catalog regression that validates all three records and checks
their actual panel, anomaly, Disorder, defense, resistance, coverage, skill
target, and shared-stack behavior. The stored canonical skill-target count was
updated from 28 to 40 for the twelve new Chain Attack and Ultimate targets. The
Vue Buff-picker regression now verifies that version 3.0 defaults to
`危局强袭战 · 3.0版本 · 第三期`, renders all three names, and replaces the first
selection when another Buff from that period is chosen.

Focused verification passed with `npm run test:field-buffs`,
`npm run test:skill-targets`, `npm run test:maintenance-validation`,
`npm run test:repository-integrity`, and the 14-test Buff-picker Vitest file.
The production Vue build also passed. A headed browser run against the built
application confirmed the default Critical Assault phase label, all three cards,
the shared stack control, independent coverage controls, selection persistence,
successful `/api/catalog` loading, and an empty warning/error console.

## 2026-07-16 - Changed Player Coverage Inputs To 0-1 Decimals

Changed the Buff picker and drive-disc optimizer coverage controls from visible
`0%-100%` percentages to the canonical `0-1` decimal scale requested for player
input. The controls now use bounds `0/1` and step `0.1`, write the entered value
directly, and no longer render a percent suffix. Runtime effect summaries also
show decimal coverage such as `0.5` instead of `50%`. Administrator maintenance
continues to edit default coverage as a percentage, so this change affects only
player-facing runtime controls and does not alter stored values or calculations.

Updated Buff-picker, optimizer, and shared runtime-text regressions to verify
decimal display while retaining canonical per-effect persistence.

## 2026-07-16 - Added Independent Per-Effect Buff Coverage

### Rule-Level Coverage Contract

Moved coverage from the containing Buff to individual `effects[]` rules. A
weapon, agent, drive-disc set, teammate, field, or Boss Buff can now contain
multiple effects with different coverage defaults and runtime overrides. The
canonical catalog shape is `effect.coverage`, and the canonical runtime shape is
`runtimeInputs[buffId].effects[effectId].coverage`. Rules without catalog
coverage remain fixed at 100% and ignore stale or injected runtime coverage.

The maintenance normalizer preserves the administrator's `coverage.default`
while fixing only `min/max/step` to `0/1/0.1`. Legacy parent coverage is copied
to every child rule before validation and removed from the saved parent. Legacy
browser and optimizer top-level runtime coverage receives the same expansion on
read, while newly persisted state contains only rule-level overrides.

### Maintenance And Player Controls

Added an independent coverage switch to every in-combat maintenance rule card.
New rules start with coverage disabled. Enabling it creates a 100% default,
allows the administrator to edit that default from 0% through 100%, and exposes
the same rule in player-facing Buff and optimizer controls. Disabling it removes
the catalog capability. Changing an effect set to out-of-combat also removes its
rule coverage because player runtime coverage applies only to in-combat effects.

The Buff picker now renders each stored effect on its own row. Authorized rows
receive an independent coverage input that stays disabled until the parent
Buff is selected; clearing the parent selection clears its runtime overrides.
Drive-disc optimizer settings use the same per-rule structure. Shared source
values and shared stack arrays remain shared, but coverage never propagates
between sibling effects.

### Data Migration And Regression Coverage

Migrated 26 parent coverage objects across agents, W-Engines, drive-disc sets,
field Buffs, and hidden system Buffs into 44 rule-level objects without changing
IDs, defaults, or effect values. Added core tests for sibling isolation,
unauthorized runtime injection, legacy parent migration, fixed and target-stat
calculation, maintenance normalization/API round trips, Buff-picker persistence,
optimizer persistence, player-control display, and save-preview output.

## 2026-07-16 - Fixed Drive Disc Four-Piece Skill Target Maintenance Saves

### Root Cause And Scope Semantics

Fixed maintenance validation that treated a drive disc four-piece Buff without
an explicit `scope` as an out-of-combat effect. Drive disc storage intentionally
omits both `scope` and `appliesToOutOfCombatPanel`: two-piece effects are always
out-of-combat panel effects, while four-piece `selfBuff` and `teamBuff` entries
are always materialized as in-combat Buffs by the calculator. The generic
validator previously defaulted every missing scope to `outOfCombat`, so choosing
“指定角色招式” or “通用技能大类” in an existing four-piece rule produced
`技能增幅对象只能用于局内 Buff` before the maintenance request could complete.

Maintenance validation now resolves the effective scope from the drive disc
source type. `driveDisc2pc` is fixed to `outOfCombat`; `driveDisc4pc` and
`driveDisc4pcTeam` are fixed to `inCombat`. This same effective scope is used for
effect rules and Buff modifiers. An explicit `scope: "inCombat"` can therefore
no longer make a two-piece rule accept combat-only targets, event stats, or
modifiers, while a canonical scope-less four-piece rule can use them normally.

### Canonical Maintenance Payloads

New four-piece self/team Buff drafts no longer add transient `scope` or
`appliesToOutOfCombatPanel` fields. The backend drive disc cleaner continues to
strip those fields before validation and persistence, preserving the documented
JSON contract and avoiding a catalog-wide data migration. Existing scope-less
drive disc records remain canonical and can be edited without toggling their
Buff sections or recreating their rules.

### Regression Coverage

Core validation tests cover scope-less four-piece self and team skill targets,
four-piece Buff modifiers, two-piece attempts to spoof an in-combat scope, and
two-piece event-stat rejection. The maintenance API test saves a targeted
four-piece rule, reloads it from the persisted catalog, saves it a second time,
and verifies that the skill target survives while `scope` remains absent. The
Vue maintenance test reproduces the administrator workflow with “通用技能大类”
and “终结技”, verifies that saving proceeds, and checks that newly enabled team
Buff drafts also omit the stripped metadata.

## 2026-07-15 - Removed Generic Effect Applies-To Filters

### Administrator Workflow And Data Contract

Removed the maintenance effect editor's generic “适用范围” panel, including
damage-kind, element, anomaly-effect, and nested skill selectors. Administrators
now express skill restrictions only through the existing three target modes and
express element restrictions through explicit stat choices. The workbench custom
Buff picker exposes the same explicit choices, so it cannot create a hidden
filter that the maintenance page cannot explain.

Newly saved effect rules no longer contain `appliesTo`. Added explicit physical,
fire, ice, electric, ether, and wind variants for critical damage and defense
ignore. Multi-element effects are represented as separate rules and share one
stack group when the source effect stacks. Known legacy element filters and
`appliesTo.skillTargets` are normalized while maintenance drafts load and again
before API validation. Unconvertible legacy `damageKinds` and `anomalyEffects`
filters remain runtime-readable but display a blocking replacement message and
cannot be persisted by maintenance.

### Catalog And Calculation Migration

Migrated Lycaon's other-element damage increase into five explicit elemental
damage rules, Xixifu's electric defense ignore into `electricDefIgnore`, removed
the redundant filter from her electric resistance ignore, and split the shared
ice/fire W-Engine critical-damage rule into `iceCritDmg` and `fireCritDmg` rules
with a shared stack group. Buff modifier references are expanded automatically
when one legacy rule becomes several canonical rules.

Direct and Sheer calculations now add the matching elemental critical-damage
stat, while anomaly-specific critical multipliers remain isolated. Defense
calculation adds only the matching elemental defense-ignore stat. The same
mapping is used by scalar damage, compiled scoring, dense optimizer kernels,
fixed-set objective kernels, stored-stat labels, player summaries, and damage
white-box rows.

### Regression Coverage

Added normalization tests for element splitting, shared stack groups, skill
target migration, modifier reference expansion, and blocking unknown filters.
Maintenance API tests verify canonical persistence and rejection behavior;
catalog integrity rejects any exact `appliesTo` key in formal JSON data. Damage
and optimizer tests cover matching-element effects, cross-element isolation,
direct/Sheer behavior, and anomaly isolation. Vue tests iterate representative
event modifiers without rendering the removed panel and verify the new explicit
options in both maintenance and workbench Buff editing.

## 2026-07-15 - Hardened Explicit Skill Types And Clarified Damage Zones

### Semantics And Administrator UI

Renamed targeted `dmgBonus` controls to `技能目标伤害加成%` and multiplier
controls to `技能倍率加算%` across maintenance, workbench custom Buffs, player
summaries, and damage white-box output. The former remains additive with generic
and elemental damage bonuses; the latter is added directly to the selected
skill multiplier. No stored stat keys, Buff values, or damage formulas changed.

The agent-skill editor now includes a collapsed, read-only technical section for
the multiplier-table category ID, move IDs, and row IDs. These identifiers remain
system-generated and cannot be edited.

### Type And Compatibility Safety

Normal skill resolution now accepts only a valid explicit `skillType`; legacy
category and `chain_` / `ultimate_` inference lives in a separate migration
helper. Known legacy prefix targets are normalized before runtime matching, so
they also match future moves whose IDs do not carry historical prefixes. Local
workbench `addedBuffs`, imported Buff state, the Buff picker draft, maintenance
drafts, and maintenance API saves all persist the canonical target union.
Unknown prefixes retain their legacy runtime match but continue to block
maintenance saves.

Maintenance validation now rejects a single skill type split across multiple
multiplier-table categories for the same agent. New moves always receive an
explicit type, preferring a type not yet owned by another category. Catalog
regression coverage scans all 63 moves, 92 multiplier rows, and 28 stored skill
targets for valid types and references. The stale Yixuan `sheer` default-mode
assertion was aligned with the maintained `custom` loop.

## 2026-07-14 - Rebuilt Administrator Default Loops As A Master-Detail Modal

### Maintenance Workflow And Layout

Replaced the role editor's fully expanded administrator-default-loop cards with
a compact summary that reports configured cinema thresholds and event totals.
The summary opens a dedicated `管理员默认循环` modal instead of forcing every
cinema variant and calculation event into the already long role form.
Skill-group definition intentionally keeps its existing expanded event cards;
only default-loop maintenance moved into the new workflow.

The modal follows the workbench event manager's master-detail pattern. Cinema
variants appear as ordered tabs across the top, the left column contains the
scheme name, calculation objective, locked or selectable cinema threshold, and
a scrollable target-event list, and the right column edits only the selected
event. Event rows expose readable summaries plus copy/delete icon actions. The
toolbar still supports skill damage, sheer damage, anomaly, disorder, and skill
group events, while the detail editor retains event type, count, skill/manual
source, category/move/row cascade, element, critical mode, anomaly fields, and
disorder fields. The existing skill-group editor now reuses the extracted
single-event field component without changing its card layout.

The modal is constrained to the viewport. Desktop keeps a `340px + flexible`
two-column workspace with independent event-list and detail scrolling. At
tablet and phone widths it becomes one column, the card content itself scrolls,
and the footer remains visible. This prevents long eight-event loops from
pushing `取消` and `应用` below the viewport.

### Draft And Data Safety

Opening the modal creates a JSON-compatible local clone. Closing or cancelling
discards that clone; only `应用` replaces the role maintenance draft, and the
existing role-level `保存` action remains the only API persistence boundary.
The root entry is always normalized to cinema zero. Additional variants are
limited to unused cinema levels one through six and sorted by level; cinema
zero cannot be reassigned or deleted individually, while clearing the complete
default configuration remains available behind a confirmation dialog.

Adding a cinema variant presents only unused levels and copies the active
scheme. Every copied event receives a new generated ID, and
`selectedEventId` is remapped to the corresponding copied target. Copying an
event inserts it after the source and selects it. Deleting a non-target event
preserves the still-valid target; deleting the target selects the nearest
remaining event, and the final event cannot be deleted. Catalog shapes,
maintenance API payloads, calculator behavior, and default-loop resolution are
unchanged.

### Verification

Added four focused modal tests for cinema copying and ID remapping, base and
unique-level constraints, variant deletion, event target maintenance, and
cancel semantics. The maintenance view suite now covers the compact summary,
modal objective/target editing, cancel isolation, apply-to-draft behavior, and
the unchanged role save payload. `npm run test:webapp` passed all 202 tests in
26 files, `npm run test:maintenance-validation` passed, `npm run
test:maintenance-api` passed all eight resource integration paths, and `npm run
build:webapp` passed TypeScript plus the production bundle.

Playwright verified `/maintenance` against the live local backend and Vite
server at 1440x900 and 390x844. The desktop footer remained visible with two
eight-event variants; the phone view scrolled from the independent target list
to the one-column event editor without covering the fixed footer. A real
dropdown interaction copied the active zero-cinema loop into a new two-cinema
tab, and cancelling restored the original two-variant summary and clean draft
state.

## 2026-07-14 - Replaced Skill ID Prefix Targets With Explicit Skill Types

Introduced the shared `SkillType` catalog and a discriminated `SkillTarget`
model. Every maintained skill move now declares one of the existing top-level
skill types, with Ultimates explicitly separated from Chain Attacks even though
both continue to share the `chain` multiplier-table category. Specific targets
store an agent, category, skill type, and optional move/row; general targets
store only a skill type and therefore apply across all agents.

The calculator now carries `skillType` into normalized damage-event sources and
matches both canonical targets and legacy prefix targets. Known `chain_` and
`ultimate_` inputs are normalized before maintenance persistence, while unknown
legacy prefixes remain readable by the runtime but fail maintenance validation
with a replacement action. Existing agent, teammate, and field Buff data was
migrated without changing values or damage formulas.

Reworked the maintenance effect editor and the workbench custom Buff editor to
offer three explicit amplification modes: ordinary/global effects, a specific
agent's skill, and general skill types. The old skill-series control and its
ambiguous fallback label were removed. Specific targets can cover an entire
agent skill type or narrow to one move and multiplier row; general targets use
a multi-select. Maintenance drafts now use schema v3 and migrate v2/v1 data.

Added focused normalization, validation, API-persistence, calculator, readable
label, maintenance UI, and custom Buff tests. The regression contract and
modeling documentation now define the canonical shape and compatibility rules.

## 2026-07-14 - Added Dual Scanner Packages And Structured Startup Diagnostics

### Distribution Contract

Upgraded `config/scanner-manifest.json` to schema v2 for ZZZ Scanner Next
`1.0.37` and Helper `1.1.0`. The manifest declares Windows x64 support from
Build 17763 and carries two independently locked packages: `win-x64-fdd` for
machines with `Microsoft.WindowsDesktop.App 8.x`, and
`win-x64-self-contained` for machines without that runtime. Package IDs are
part of cache paths so the two deployment modes cannot overwrite each other.
The final FDD package is 21,785,638 bytes with SHA-256
`6ead4f1401ea057c706b4ec94ab41d66499240f95c8d6a9051fe71027d9e5404`;
the self-contained package is 84,835,543 bytes with SHA-256
`bdef1a3d3d0ecf9917b2618fb46cd04cea6443dbd8b399d9793c6f375a993129`.

Reworked `scripts/build-pages.js` so Pages builds validate every schema v2
package rather than a single legacy package. Each package must have a local
Pages URL and HTTPS fallback, and its local or downloaded asset must match both
the declared byte size and SHA-256 before deployment can continue. The ignored
`downloads/zzz-scanner/1.0.37` staging directory contains both verified ZIPs;
scanner binaries remain release/build inputs rather than normal source files.

### Helper Selection And Recovery UX

Extended `webapp/src/runtime/scanner-bridge.js` and the inventory store for
Helper protocol v2. Launcher progress now retains package ID, deployment mode,
selection reason, and required disk bytes. A missing or uncertain .NET 8
Desktop Runtime therefore appears as an automatic compatibility-package choice,
not as a request for the user to install a framework. The bridge also exposes
`repair_scanner`, `restart_scanner_elevated`, `open_log_folder`, and
`get_diagnostics` while retaining the old text-error fallback for older Helpers.

Structured scanner failures now preserve error code, phase, title, message,
remedy, retryability, actions, diagnostic ID, and details. The Drive Disc page
renders the supplied reason and only the applicable actions, including retry,
forced package repair, opening logs, copying diagnostics, or restarting the
scanner with UAC when the game has a higher integrity level. A cancelled UAC
request no longer degrades into a connection timeout. The unsigned-build notice
also states the unavoidable boundary: SmartScreen, antivirus, or enterprise
policy can block the Helper before it starts, when it cannot report diagnostics.

### Verification

Added bridge and Vue coverage for schema v2 package metadata, repair and
elevation commands, structured failures, action rendering, diagnostics, and
legacy compatibility. `npm run test:scanner-bridge` passed. The complete Vue
suite passed all 194 tests across 25 files, `npm --prefix webapp run build`
passed TypeScript and production bundling, and `npm run build:pages` verified
126 generated files totaling 123,846,017 bytes. The Pages artifact SHA-256 was
`33898727e890b6a970ea343aa3ea374ee64b4454bf9408097313f64706f1db0e`.

## 2026-07-14 - Expanded Strict Optimizer Results From Top 5 To Top 10

### Result Contract And Search Behavior

Expanded the fixed Drive Disc optimizer result contract from Top 5 to Top 10.
The core `RESULT_LIMIT` remains the single limit used by strict serial search,
legacy exact search, seed-cutoff preparation, objective-relevant dominance,
result-cutoff pruning, task-local result retention, and Node parallel global
result merging. This is intentionally a fixed product contract rather than a
new user setting: every successful optimization now returns the best ten
stable ranked candidates when at least ten legal candidates exist, or every
legal candidate when fewer than ten exist. Request and response shapes,
objective scoring, tie-breaking, minimum-panel constraints, set matching, and
saved optimizer settings are unchanged.

The Vue workbench now retains and exposes all ten results through the existing
immediate `OptimizerResultSelector`. Its slider and two-sided number input
derive their maximum from the returned ranks, so a complete run spans 1-10,
while a short result list still ends at its actual final rank. Existing saved
ranks 1-5 require no migration. If a saved rank is absent after inventory or
constraint changes, the existing result-list watcher continues to recover to
rank 1. The browser benchmark summary was also expanded to capture all ten
ranked candidates.

### Exactness, Compatibility, And Performance Verification

Expanded the brute-force reference from five to ten candidates and added an
explicit ten-result assertion for the primary exact fixture. A one-candidate
automatic-set fixture locks the complementary behavior that fewer than ten
legal candidates are returned without padding. Browser-local, backend async,
parallel-worker, no-pruning, legacy exact, and worker-unavailable fallback
checks now compare the complete Top 10 ID and score sequence. Workbench source
coverage locks the display limit to ten, and component coverage selects rank 10
through the slider, numeric input, and plus button before checking the upper
boundary.

`npm run test:optimizer` and `npm run test:browser-local-compute` passed. The
complete Vue suite passed all 187 tests across 25 files, including five
`OptimizerResultSelector` tests, and `npm run build:webapp` passed TypeScript
checking plus the Vite production build after transforming 4,470 modules.

Performance stayed inside the 20% acceptance limit. A paired warehouse A/B on
the same machine used one warm-up and five measured runs: the Top 5 median was
205 ms and the Top 10 median was 202 ms, so no measurable slowdown remained
after initialization noise. The strict automatic-two-piece stress fixture used
one warm-up and three measured runs over 297,141,750 legal 4+2/six-piece
combinations. Its median increased from the recorded Top 5 baseline of 7.844
seconds to 8.069 seconds for Top 10, a 2.9% increase; real score evaluations
rose from 31 to 46 while the highest score remained 6,186.

## 2026-07-14 - Restored Maintenance Visibility Controls In The Vue Workbench

### Root Cause And Catalog Contract

Fixed a Vue migration regression where records saved with `hidden: true` by the
maintenance switch labelled `首页/优化器显示` still appeared on the calculation
workbench. The normalized catalog already exposed `displayAgents`,
`displayWEngines`, and `displayDriveDiscSets`, but `buildMeta()` projected only
the complete collections. The Pinia catalog store, build initialization, and
workbench selectors consequently consumed all records. Since Anby is the first
agent in `data/agents.json`, a fresh or invalid saved selection could also make
the hidden Anby record the default agent. Alice was affected by the same role
selector leak, while W-Engines and Drive Disc sets had the same latent defect
whenever an administrator marked one hidden.

`buildMeta()` now publishes additive `displayAgents`, `displayAgentSkills`,
`displayWEngines`, and `displayDriveDiscSets` projections. Only a strict
`hidden: true` removes a record from these arrays. The complete `agents`,
`agentSkills`, `wEngines`, and `driveDiscSets` arrays and their catalog Maps are
unchanged, so maintenance editing, explicit calculator lookup, imported Drive
Disc resolution, and historical data labels retain access to hidden records.
The grouped teammate, field, and Boss Buff meta projections now also consume
their normalized display collections, ensuring group-level and nested Buff
visibility use the same contract as ordinary combat Buffs.

### Workbench Selection And Saved-State Recovery

Added explicit display getters to the catalog store and routed every new-choice
surface on `/` through them: the primary agent selector, W-Engine selector,
agent skill target catalog, optimizer four-piece and two-piece set pickers,
teammate W-Engine Buffs, and teammate Drive Disc Buffs. The `/discs` inventory
and `/maintenance` administrator routes deliberately continue using complete
collections. A hidden set therefore cannot be chosen as a new optimizer
constraint, while an already imported disc that references it can still be
named and edited outside the workbench.

Build restoration now accepts a saved agent or W-Engine only when it remains in
the relevant display collection. A hidden current agent falls back to the first
visible agent, and a hidden saved W-Engine falls back through the existing
related/default visible W-Engine rule. Per-agent saved configurations are not
deleted; the active visible choice is persisted during normal recalculation,
so an administrator may later unhide the old record without having destroyed
its historical configuration. Optimizer restoration similarly rejects hidden
preferred, manual four-piece, and two-piece set IDs and selects the first
visible set. When an entire resource class has no visible records, the stores
retain an empty selection instead of silently reintroducing a hidden item. The
workbench disables optimization in that state and repeats the same guard at the
command entrypoint, so a programmatic call cannot start a run without a visible
agent, W-Engine, and four-piece set.

### Regression And Browser Verification

Added catalog-loader coverage proving hidden entities remain available in raw
arrays and Maps but are absent from every `display*` projection. The same matrix
covers ordinary Buffs, teammate groups, nested teammate Buffs, field Buffs, and
Boss Buffs. Pinia tests cover raw/display getter separation, hidden saved agent
and W-Engine fallback without config deletion, empty visible-agent state,
hidden optimizer set cleanup, and empty visible-set state. Component tests
verify that custom skill targets and teammate W-Engine Buffs exclude hidden
records, while workbench source coverage locks all picker inputs to display
collections.

`npm run test:catalog-loader` passed. The complete Vue suite passed all 188
tests across 25 files, and `npm run build:webapp` passed TypeScript checking and
the Vite production build after transforming 4,470 modules. The full
repository `npm test` chain passed, including all calculator, maintenance API,
optimizer, browser-local, production-server, import, scanner, and account
checks plus 160 optimizer fuzz seeds. A separate production server on
`http://127.0.0.1:8796` returned all five agents through `agents` but only
Ye Shunguang, Hoshimi Miyabi, and Yixuan through `displayAgents`. Real Chromium
verification showed Ye Shunguang as the default and exactly those three options
in the role selector; the maintenance route still listed and opened Anby and
Alice with their visibility switches off. The browser console reported zero
errors and zero warnings.

## 2026-07-14 - Replaced Optimizer Result Dropdown With An Immediate Rank Selector

### Result Selection And Feedback

Replaced the Drive Disc plan's optimized-result rank dropdown, score tag,
separate Apply button, pending-rank state, and confirmation dialog with the
dedicated Vue `OptimizerResultSelector`. The selector keeps the optimizer's
existing Top 5 result contract and exposes each available rank through a
discrete integer slider plus a two-sided `NInputNumber`. Slider changes,
keyboard steps, minus/plus clicks, and committed numeric input now call the
existing `buildStore.selectOptimizedRank` path immediately, so the six selected
Drive Discs, current damage, analysis source, and persisted rank stay aligned
without a second confirmation step.

The selector displays the selected score relative to rank 1 in a full-width
ratio bar using `第 N 套 · 百分比 · 评分` wording. Rank 1 is exactly `100%`;
other ranks use one decimal place and all ratios are clamped to 0-100%. A
single result remains visible with disabled stepping, an invalidated saved rank
returns to rank 1 when the result list changes, and a missing or non-positive
rank-1 score suppresses the selector to avoid `NaN` or infinite percentages.
Desktop layouts keep the slider and number input on one row; screens at or
below 680px stack them while the ratio bar continues to fill the panel width.

### Verification

Added component coverage for `1000 / 978 / 900` score percentages, slider and
number-input emissions, step-button boundaries, decimal normalization,
single-result disabling, result-list shrink repair, and invalid score handling.
Workbench source coverage verifies the new component wiring and removal of the
old dropdown/apply flow. The final Vue suite passed all 176 tests and the Vite
production build completed after transforming 4,469 modules. Real Chromium
verification ran an actual five-result optimization and confirmed immediate
updates through slider keyboard input, numeric entry, and both step buttons;
1130px desktop and 390px mobile measurements had no horizontal overflow, and
the browser console reported no errors.

## 2026-07-13 - Accelerated Strict-Exact Drive Disc Optimization

### Search And Scoring Hot Path

Kept `exact-super-bound` and `exact-super-bound-parallel` strictly exact while
reducing the cost of proving that a branch cannot enter the Top 5. The damage
compiler now publishes the optimizer input stats that can affect the active
event loop and enabled panel minimums. Candidate filtering first preserves the
existing all-stat dominance behavior, then applies an additional Top-5-safe
objective-aware pass: a candidate is removed only when at least five stable
candidates from the same set and slot dominate every relevant dimension.

Fixed 4+2 enumeration plans compile a set-count-specific score target. Static
two-piece bonuses, active four-piece/Buff entries, combat bonus arrays, damage
modifiers, percentage conversion factors, and candidate stat indexes are
prepared once per plan. Direct-only event loops additionally use a scalar
kernel with precomputed defense, resistance, stun, skill and modifier terms.
Every specialized set-count signature is compared with the generic dense
scorer before use; verified kernels are cached across slot masks, while
unsupported event mixes and any mismatch retain the generic strict-exact path.

An empty two-piece restriction now means automatic complete-set matching rather
than unrestricted loose discs. Exact enumeration includes every available 4+2
layout and six pieces of the selected four-piece set, while excluding 4+1+1 and
5+1. Each automatic plan therefore has fixed set counts and can use the same
specialized scorer and suffix frontier as an explicitly selected two-piece set.
If the filtered inventory cannot form any valid plan, preview and execution
return `已有驱动盘太少，无法组成 4+2 或 6 件同套。`; minimum-panel failures retain
their existing distinct error.

Small exact suffixes are generated once per plan/depth and compressed to a
monotone Pareto frontier only when the compiler proves the dependency set.
The exact-suffix threshold was reduced from 192 leaves to 64 after profiling:
larger suffixes are faster when the existing hierarchical group/chunk/disc
bounds continue recursively. On the 5,635,656-combination fixture this reduced
bound-oracle leaf scores from roughly 1.41 million to about 20,459 while still
returning the same stable Top 5. The seed cutoff now uses a potential beam whose
budget is distributed across every eligible 4+2 plan instead of exhausting the
first plan with depth-first variants.

### Browser Single-Worker Runtime

Browser optimization remains off the main thread but now runs exclusively in
one controller Worker. The Vue algorithm picker no longer exposes
`exact-super-bound-parallel`, and the production bundle no longer contains a
nested task Worker or browser task-pool coordinator. Existing browser settings
that saved the removed parallel algorithm are silently migrated to
`exact-super-bound`; the controller also normalizes legacy requests and always
sets `disableParallel` before preview or execution. Progress, cancellation,
errors and stable Top-5 results keep the existing message protocol.

This is intentionally browser-only. The core `exact-super-bound-parallel`
algorithm and the Node adapter's `worker_threads` scheduler remain available to
local and self-hosted callers. Same-Chromium A/B measurements showed that two
browser task Workers were only about 10-20% faster: 5,635,656 combinations took
about 3.0 seconds in the pool versus 3.61 seconds serial, while 137,220,750 took
39.42 seconds versus 44.60 seconds serial. The accepted browser slowdown trades
that modest gain for one initialization path, lower CPU pressure, no repeated
catalog/store cloning and a simpler cancellation lifecycle.

Read-only metrics now expose relevant-stat count, dominance mode, seed plan and
beam coverage, specialized scorer calls/fallbacks, suffix frontier raw/kept
sizes and frontier score calls. Automatic two-piece runs also expose matched set
count, 4+2/six-piece plan counts and their separate combination totals. Node
parallel metrics remain available to the benchmark and Node callers.
The benchmark accepts `OPTIMIZER_BENCHMARK_SCALE` and
`OPTIMIZER_BENCHMARK_RUNS`; repeated runs include one warm-up and report the
median result from the same process.

### Verification And Measured Result

The original local 5,635,656-combination baseline was about 9.27 seconds. With
the same strict-exact fixture, a pre-warmed five-run measurement now has a
1.403-second median, exceeding the 4.6-second serial acceptance gate and
representing about a 6.6x speedup. A new automatic two-piece benchmark processed
297,141,750 legal 4+2/6 combinations in 23.34 seconds in Node strict serial mode;
31 automatic plans reused three compiled set-count kernels through 28 cache
hits and expanded only 31 final combinations. Real Chromium serial verification
against the built Vue application completed the same-size local inventory in
3.16 seconds; the final 137,220,750-combination stress fixture completed in
45.82 seconds. With the screenshot inventory, complete-set filtering reduced the
browser estimate from 307,652,571 unrestricted combinations to 22,077,731 legal
4+2/six-piece combinations (7.2%) and completed at 100% in 72 seconds, below the
90-second acceptance target. Browser results no longer display pool size or task
counts.

Regression coverage compares specialized and generic fixed-set results, keeps
the chunk-bound fixture active, verifies browser serial completion/cancel and
legacy-setting migration, and preserves Node/browser Top 5 parity. Node parallel
coordination remains covered independently. The fixed optimizer
tests, compiled score tests, progress/cancellation tests, browser-local tests,
Vue production build, and all 160 optimizer fuzz seeds passed during the
implementation.

## 2026-07-13 - Rebuilt Vue Maintenance As A Structured Administrator Workspace

### Structured Editing And Navigation

Replaced the Vue maintenance page's generic recursive editor with the legacy
maintenance layout rebuilt in Vue and Naive UI: top resource tabs, a
human-readable record browser on the left, and a dedicated editor on the right.
The eight supported resource types
remain agents, agent skills, W-Engines, Drive Disc sets, anomaly/disorder
effects, teammate Buffs, field Buffs, and Boss Buffs. Generic manual Buffs and
hidden `systemBuffs` remain outside the maintenance navigation.

Eight resource-specific editors restore the legacy section order, controls,
tables, conditionally visible fields, and dependent selections. Shared business
editors handle fixed/derived/formula/stacked effects, coverage, Buff modifiers,
skill targets, calculation events, and structured Core Skill levels. Agent
calculation objectives once again distinguish `custom`, single-skill or sheer,
and anomaly modes. Selecting a skill-targeted effect opens the complete skill
catalog, category, move, row, and readable move-series cascade. Known references
are searchable selectors whose labels use
names, elements, specialties, sources, and descriptions instead of backend
identifiers. Existing unknown fields are retained rather than being dropped by
the resource-specific forms.

The raw JSON textarea was removed. A collapsed read-only save preview remains
for review, but recursively masks `id`, `*Id`, and `*Ids` fields. Search results,
record metadata, forms, and validation messages likewise do not expose IDs.
Validation paths are translated to Chinese field names, while ID-generation
failures are reported as system errors rather than asking an administrator to
repair an identifier.

### Resource Workflows And Draft Compatibility

New records start in a contextual wizard. Agent skills choose their owner,
anomaly entries choose attribute anomaly or disorder, teammate Buffs choose a
new or existing teammate, and field Buffs choose mode, game version, and phase
before opening the full form. Simpler resources begin with a name and safe
defaults. Copying regenerates every owned nested identity and rewrites internal
references while retaining references to external catalog data.

Teammate Buff maintenance again follows the grouped catalog model: the left
record list selects a teammate, a secondary list selects one Buff, and only that
Buff is edited and saved. The role's name and avatar metadata remain editable
without flattening all Buffs into one form. Administrators can delete either the
selected Buff or, after a separate destructive confirmation, the teammate and
all of its Buffs.

Local drafts now use `zzz_maintenance_vue_draft_v2` and store structured data.
Existing `zzz_maintenance_vue_draft_v1` JSON drafts are parsed and migrated on
first load. Unsaved navigation prompts, browser-unload protection, mutation
locking, save acknowledgement, full-catalog refresh, and refresh-only retry
after a successful write remain intact.

### Generated Identity Contract

All maintenance create endpoints now materialize missing IDs before business
validation. Agents, skill catalogs, W-Engines, Drive Disc sets,
anomaly/disorder entries, teammate roles, teammate Buffs, and Boss Buffs use
type-prefixed random IDs. Field Buffs retain their stable mode/version/phase/name
identity. Nested skill categories, moves, rows, effects, modifiers, skill
groups, and calculation events receive IDs as well. Existing IDs are preserved.

`POST /api/maintenance/teammate-buffs` retains its `{ teammate, buff }` payload.
`DELETE /api/maintenance/teammate-buffs/:teammateId/:buffId` still removes one
Buff, while the new `DELETE /api/maintenance/teammate-buffs/:teammateId` form
removes the complete group. Catalog file shapes and calculation behavior did
not change.

### Maintenance Usability Completion

Replaced the remaining dynamic inline grids with dedicated layouts for skill
targets, effect rules, calculation events, Buff modifiers, and Core Skill
enhancements. Skill targets now keep the catalog and category on the first row,
then show move, multiplier row, the complete Chinese move-series range, and a
separate delete action on the second row. Desktop tabs and record lists remain
reachable while the editor scrolls independently; multiplier tables preserve a
sticky header and readable identity columns, and mobile forms collapse to one
business field per row.

Added independent image provenance and multi-row `sources[]` editing, agent
attack types and complete Buff metadata, readable default-calculation target
events, formula result units, and named shared stack arrays. W-Engine and Drive
Disc effects now expose their existing conditions, durations, segmented text,
coverage, and Buff modifiers. W-Engine modification previews can be inspected at
levels 1 through 5 without flattening their stored value tables. Technical
condition values, skill prefixes, stack-group identifiers, and all other
internal identities remain absent from the administrator-facing preview.
Clone reference rewriting now follows explicit owned-reference fields, so an
agent ID that happens to equal an external skill-catalog ID cannot redirect the
external reference while nested events and skill groups are regenerated.

Skill-group count bounds and coverage slider metadata are now system-managed
schema constants. Every skill group is stored with default/min/max/step values
of `1/0/100/1`; every enabled coverage object is stored as `1/0/1/0.1`.
Maintenance drafts, copies, new records, API writes, and cleaned save responses
all normalize these values before validation. The four skill-group number
inputs and all coverage controls were removed from the administrator forms and
from the masked save preview. Coverage is now entirely system-managed; records
without an explicit coverage object retain the same `1/0/1/0.1` runtime defaults.

### Verification

Added model tests for nested ID creation, clone remapping, identity-masked
previews, and readable relation labels. Reworked the Vue maintenance tests
around the dedicated controls and covered all eight resources, ID-free creation,
field selectors, the `custom` calculation objective, the complete skill-target
cascade, teammate grouping, both delete modes, failed-refresh retry, mutation
locking, v1 draft migration, and readable validation failures.

Verified with `npm run test:maintenance-api`,
`npm run test:maintenance-validation`, the complete Vue suite, and the Vue
production build. The real maintenance API integration continues to use an
isolated temporary data directory and now verifies generated IDs and teammate
group deletion in addition to eight-resource save/reload/delete behavior.

## 2026-07-12 - Archived Vue Rewrite And Completed Lossless Repository Cleanup

### Archive And Branch Safety

Before removing legacy code, the complete source snapshot was committed on
`codex/vue-ui-rewrite` as `5c6e1c8` with message
`chore(archive): snapshot Vue UI rewrite before cleanup`. Annotated tag
`archive/vue-ui-rewrite-pre-cleanup-20260712` points to the same commit. Cleanup
continues only on `codex/vue-ui-rewrite-cleanup`; the archived branch and tag
remain unchanged so the pre-cleanup implementation can be restored exactly.

The cleanup branch merged the current `origin/main` scanner 1.0.36 work before
starting migration. It must not be merged into or deployed from `main`
automatically.

### Cleanup Contract

The cleanup replaces the duplicated static frontend with the Vue application,
moves platform-neutral calculations, validation, inventory rules and optimizer
search into `core/`, and keeps browser-only catalog/storage/scanner/Worker
adapters under `webapp/src/runtime/`. Node and browser adapters must continue to
share the same business rules while preserving Node worker-thread parallelism
and browser-local heavy computation.

Feature parity is a hard gate for deletion. The calculator, Buff drafts,
optimizer progress/cancellation, account-scoped IndexedDB/localStorage data,
Drive Disc import and scanner flows, all eight maintenance resource types,
legacy route redirects, Pages catalog/config output, and scanner manifest
hash/size validation must remain covered by regression tests. The complete
behavioral requirements now live in `docs/regression-contract.md`.

### Repository Hygiene And Tooling

The cleanup removes tracked Playwright screenshots, the unreferenced root HTML
calculator, obsolete planning/usability documents, and unused `tailwindcss` and
`katex` dependencies. `output/` and `.claude/` are ignored without deleting
untracked local logs or settings. The optimizer benchmark moved from `tests/`
to `benchmarks/`, keeping `npm run benchmark:optimizer` as its stable entry.

Webapp dependency installation is now explicit: CI and first-time setup run
`npm --prefix webapp ci`, while `npm run test:webapp` only executes tests. A
Node 20 CI workflow installs the locked webapp dependencies, runs the complete
root regression suite and builds the Vue application for branches and pull
requests. The existing Pages workflow is triggered only by updates to `main`;
the cleanup branch cannot deploy Pages by itself.

README files now describe only the current Vue/core/backend architecture,
installation, runtime, routes, tests, Pages deployment and scanner integration.
All earlier release and modeling history remains in this changelog rather than
being repeated in the project landing documentation.

### Shared Core And Runtime Migration

Platform-neutral calculation, skill-group expansion, default event loops,
formula evaluation, combat helpers, maintenance validation, Drive Disc
analysis, inventory rules and optimizer search now live under `core/`. Browser
catalog loading, account selection persistence, IndexedDB/localStorage,
scanner bridging and Worker integration live under `webapp/src/runtime/` or the
Vue stores. No shared-core module accesses browser globals.

The Node and browser inventory adapters now share normalization, account
scoping, scanner import and deduplication, content/identity fingerprints,
loadout remapping and CRUD behavior. The existing database name, object store,
record key, localStorage key and account ownership defaults remain unchanged so
previous local data opens without migration or loss.

Loadout reconciliation is scoped by owner as well as Drive Disc ID. Deleting,
deduplicating or remove-missing synchronization in one account therefore cannot
clear a same-ID slot in another account; changed loadouts recompute their
missing slots and completion status.

Drive Disc analysis has one implementation. The optimizer now uses one search
engine with injected `yieldControl`, `availableParallelism` and optional
`runParallel` capabilities. Node keeps `worker_threads`; the browser keeps its
dedicated Worker, preparation progress, cancellation and event-loop yielding.
Existing algorithms, result structure, progress metrics and cancellation error
contracts remain stable, including wind-stat weighting.

### Vue Maintenance And Route Completion

The Vue maintenance page now loads and edits agents, agent skills, W-Engines,
Drive Disc sets, anomaly/disorder effects, teammate Buffs, field Buffs and Boss
Buffs. It reads the combined `anomalyEffects.effects` shape, preserves anomaly
settlement types and flattens teammate ID plus Buff ID without losing the
parent teammate record. The generic combat-Buff category and hidden system
Buffs are not exposed.

New, copy, edit, business validation, save, delete confirmation, local draft
recovery and unsaved-navigation protection are implemented. Every successful
save or delete reloads the complete maintenance catalog. A real HTTP integration
test copies public data into an isolated temporary directory and verifies that
all eight resource types can be saved, reloaded and deleted without touching
the repository's data or local user inventory.

Write acknowledgement is separate from catalog refresh. Once POST or DELETE
succeeds, a failed follow-up GET is shown as a refresh failure and retrying only
reloads the catalog, so generated Boss or teammate IDs cannot be inserted
twice. Mutation buttons are disabled while a request is active. Server-side
maintenance mutations run through one serialized read-modify-write queue and
replace JSON through a same-directory temporary file plus atomic rename, which
prevents concurrent tabs from losing each other's updates or exposing a
partially written catalog.

The resource selector, record list, common fields and raw JSON editor are also
locked while a mutation or refresh is in flight. Delayed-response tests verify
that an in-flight save cannot be redirected to another resource or overwrite
newly typed content.

When maintenance is disabled, `/maintenance` and `/maintenance.html` return
404, the API returns 403 and navigation hides the entry. When enabled,
`/maintenance` serves the Vue app and `/maintenance.html` redirects with 308.
The calculate, Drive Disc and account legacy HTML paths continue to redirect to
their Vue routes. The server now serves only `dist/pages`; a missing build gives
an explicit 503 instruction instead of falling back to retired source files.

The Node service binds to `127.0.0.1` unless `HOST` is explicitly set.
Maintenance writes accept loopback origins or exact entries from
`MAINTENANCE_ALLOWED_ORIGINS`, reject DNS-rebinding-style Origin/Host matches,
and retain the existing wildcard CORS contract for read-only routes. Malformed
URL percent encoding returns 400 and leaves the process healthy; decoded route
segments are never decoded a second time.

The scanner manifest now has one tracked source at
`config/scanner-manifest.json`, while every `downloads/` directory and scanner
ZIP remains ignored. The Vite build copies that manifest only into the ignored
runtime artifact, so a plain `npm start` serves scanner metadata from a clean
checkout and falls back to the GitHub Release when the same-site ZIP is absent.
The Pages builder reads the same config as its canonical version, size, hash and
URL source before embedding and re-verifying the package.

### Legacy Removal And Asset Consolidation

After parity tests passed, the entire `frontend/` tree, standalone root
calculator, duplicate analysis implementation, pass-through maintenance stats,
obsolete optimizer UI test, old maintenance page, old Worker, CSS and UI helper
modules were removed. Still-useful optimizer UI assertions moved into Vue
component, store and Worker tests. The benchmark now lives under `benchmarks/`.

All public images moved to `webapp/public/assets/`. Eleven Drive Disc catalog
entries now use the smaller higher-resolution WebP files, including the two
scanner-hash set IDs, and their superseded PNG files were deleted. Repository
integrity tests validate every catalog `/assets/...` reference and reject
tracked legacy, build, download, output or local-tool directories.

Ignored scanner archives 1.0.26, 1.0.28, 1.0.33, 1.0.34 and 1.0.35 plus the
old Helper backup were removed only after the 1.0.36 GitHub Release size and
SHA-256 matched the local package and manifest. Scanner 1.0.36, the current
Helper, manifest and `data/user_drive_discs.json` were explicitly retained.

### Verification

The cleanup passed the complete Node and Vue regression suite, including 160
optimizer fuzz seeds, fixed optimizer fixtures, Node parallel execution,
browser Worker progress/cancellation, account and historical storage
compatibility, real maintenance API persistence and production route behavior.
The final Vue run passed 21 files and 146 tests, and the production build emitted
no invalid HTML warnings. The Pages builder
verified SPA and compatibility routes, catalog/config, scanner manifest,
package size and SHA-256, and absence of maintenance code in the default
artifact.

The final main-workspace Pages artifact contains 121 files totaling 64,376,889
bytes, with whole-artifact SHA-256
`f7414763906a6f9e584b23ff6579485265d2667c8f2f06ed200db7ea1439829c`. The
independent clean-checkout build downloaded the Release package itself and
produced 121 files totaling 64,376,930 bytes, with whole-artifact SHA-256
`65108803660750eecc8a11ac0a7dc6ab3720482e38e8b9827e32f872192c6d79`.
Vite chunk names can differ with the absolute checkout path, so the aggregate
artifact hash is build-instance evidence rather than a cross-path reproducible
identifier. The embedded scanner ZIP remains invariant at SHA-256
`d885c0aef6da61cfcbf994ad2b4e712a31efe8bd87631260fe4f87ea8711c63d`.

Desktop and 390-pixel mobile browser smoke tests covered calculation, Buff draft
cancellation, optimizer cancellation, Drive Disc import, scanner fallback,
account switching and maintenance save/delete against a temporary data copy.
Both layouts rendered without horizontal overflow, overlapping controls or
visible broken images.

## 2026-07-09 - Published Scanner 1.0.36

### Request Context

The web-launched OCR scanner needed to move from the deployed `1.0.35` runtime
to the latest local ZZZ Scanner Next `1.0.36` package and remain runnable for
both the legacy static scanner page and the current Vue workbench scanner flow.

### Package Changes

Repacked `E:\yan1\zzz\ZZZ-Scanner.Next\publish 1.0.36` into
`downloads/zzz-scanner/1.0.36/ZZZ-Scanner.Next-win-x64.zip`. The package
excludes generated `Scans`, includes the bundled
`Data/ocr_fast_templates.json`, and contains `ZZZ-Scanner.Next.exe` with file
version `1.0.36.0`.

The new OCR package metadata is:

- SHA-256: `d885c0aef6da61cfcbf994ad2b4e712a31efe8bd87631260fe4f87ea8711c63d`
- size: `47231570`
- entry: `ZZZ-Scanner.Next.exe`
- bundled template SHA-256: `814e28114378756e7c541c0efe6cfa2469e1e723d0498ba8e73edea58266a076`

Updated `scripts/build-pages.js`, the local scanner manifest,
`tests/scanner-bridge.test.js`, legacy `frontend/drive-discs.html`, and Vue
`webapp/src/stores/inventory.ts`/test expectations to use GitHub Release tag
`scanner-1.0.36`.

After deployment, local download probes reproduced the user's stuck download:
the GitHub Release zip connection reset or timed out before any response body
arrived, leaving progress at `0 B / 45.04 MB`. To avoid making the Helper depend
on that fragile large-file path, `scripts/build-pages.js` now copies the
verified OCR zip into the Pages artifact at
`downloads/zzz-scanner/1.0.36/ZZZ-Scanner.Next-win-x64.zip`, verifies its size
and SHA-256 during the build, and writes the scanner manifest with the same-site
relative URL first. The GitHub Release URL remains in `packageUrls` as fallback.

### Runtime Verification

Ran `dotnet build ZZZ-Scanner.Next.csproj -c Release` successfully before
packaging.

The local 120-item smoke benchmark
`publish 1.0.36\Scans\2026-07-09-16-07-11-507-p2784-e284` reported
`Completed=120`, `Failed=0`, duplicate exports 0, `IncompleteRoi=0`,
`slot_safety=pass`, `profile_route=exact:7`, and
`acceptance.no_incomplete_roi/no_error_files/export_consistency/no_export_duplicates/slot_safety/backlog_not_saturated/overlap_rows_complete/overlap_no_hard_stop` all pass.

The longer scan
`publish 1.0.36\Scans\2026-07-09-16-08-54-977-p3e2c-ddf0` reached
`Completed=466`, `Failed=0`, duplicate exports 0, and `IncompleteRoi=0`, but
its stop reason was `Scan canceled`, so it is recorded as a runtime sanity
signal rather than a full-scan completion gate.
## 2026-07-02 - Published Scanner 1.0.35 With Cloud Client Selection

### Request Context

The Drive Disc scanner page needed a visible "本地绝区零 / 云绝区零" selector
because the 1.0.34 runtime already contained cloud Fast OCR templates, but the
web request still targeted the default local `ZenlessZoneZero` process. Users
who opened Cloud Zenless Zone Zero therefore failed before OCR started with
`未找到游戏窗口进程：ZenlessZoneZero`.

### UI And Payload Changes

Added a segmented client selector to `frontend/drive-discs.html`. It defaults
to "本地绝区零" and disables while a scan is running. `frontend/drive-discs.js`
maps the selected client to the exact process/profile pair:

- local: `processName="ZenlessZoneZero"`, `visualProfileClient="local"`
- cloud: `processName="Zenless Zone Zero Cloud"`, `visualProfileClient="cloud"`

`frontend/scanner-bridge.js` now includes `processName`,
`visualProfileClient`, and `visualProfileQuality="current"` in every
`scan_req`, while preserving the stable strict DXGI route:
`fastMode=true`, `captureMode=dxgi`, `profileRouting=strict`,
`overlapConflictMode=recover`, `panelAcceptMode=adaptive-early-full-roi`,
`scrollAcceptMode=early-one-row`, `postScrollPanelAcceptMode=safe`, and
`panelMinAcceptFloorMs=120`.

### Scanner Runtime Package

Updated ZZZ Scanner Next WebSocket handling so `scan_req.processName` overrides
the default `ScanOptions.ProcessName`. Without this runtime change, the page
could send the cloud process name but an already cached 1.0.34 scanner would
still look for `ZenlessZoneZero`.

Repacked `E:\yan1\zzz\ZZZ-Scanner.Next\publish 1.0.35` into
`downloads/zzz-scanner/1.0.35/ZZZ-Scanner.Next-win-x64.zip`. The package
excludes `Scans`, includes `Data/ocr_fast_templates.json`, and contains
`ZZZ-Scanner.Next.exe` with file version `1.0.35.0`.

The new OCR package metadata is:

- SHA-256: `2a10aa3dc92e50c7ea930d75eda82fef741eff16e8c39f2839240b6fc36b0255`
- size: `47228425`
- entry: `ZZZ-Scanner.Next.exe`

Updated `scripts/build-pages.js`, the local ignored scanner manifest, scanner
helper download links, README files, and `tests/scanner-bridge.test.js` to use
the GitHub Release tag `scanner-1.0.35`.

### Verification

Ran:

- `npm run test:scanner-bridge`
- `dotnet build ZZZ-Scanner.Next.csproj -c Release`
- `dotnet publish ZZZ-Scanner.Next.csproj -c Release -r win-x64 --self-contained false -p:DebugType=none -p:DebugSymbols=false -o "publish 1.0.35"`
- `npm run build:pages`

## 2026-07-02 - Published Scanner 1.0.34

### Request Context

The web-launched scanner needed to move from the current `1.0.33` package to
the new local `publish 1.0.34` runtime and be uploaded to GitHub Releases plus
deployed through GitHub Pages.

### Package Changes

Repacked `E:\yan1\zzz\ZZZ-Scanner.Next\publish 1.0.34` into
`downloads/zzz-scanner/1.0.34/ZZZ-Scanner.Next-win-x64.zip`. The package
excludes `Scans`, includes `Data/ocr_fast_templates.json`, and contains
`ZZZ-Scanner.Next.exe` with file version `1.0.34.0`.

The new OCR package metadata is:

- SHA-256: `d87a993e15a0f9103942b0284d8d5fc552bed348147180682ef42f7b0fc51c30`
- size: `47228531`
- entry: `ZZZ-Scanner.Next.exe`

Updated `scripts/build-pages.js`, the local ignored scanner manifest, the
scanner helper download links, and `tests/scanner-bridge.test.js` to use the
GitHub Release tag `scanner-1.0.34`. Helper `1.0.2` is now required for the
download link so users get the fixed progress/resume behavior.

### Runtime Behavior

The web `scan_req` payload remains on the stable 1.0.33/1.0.34 route:
`fastMode=true`, `captureMode=dxgi`, `profileRouting=strict`,
`overlapConflictMode=recover`, `panelAcceptMode=adaptive-early-full-roi`,
`scrollAcceptMode=early-one-row`, `postScrollPanelAcceptMode=safe`, and
`panelMinAcceptFloorMs=120`. The page still does not send `ocrFastIndex` or
`includeNon15`.

### Helper Resume Fix

Helper `1.0.1` could report `45.04 MB / 45.04 MB, 100.0%` and then retry with a
Range request starting at the file end. GitHub correctly answered `416 Range
Not Satisfiable`, which surfaced as a failed scanner preparation even though
the bytes were already present. Helper `1.0.2` treats an exact-size `.download`
file as complete and moves it into the package cache so the normal size/SHA-256
verification can decide whether it is valid.

### Verification

Ran:

- `npm run build:pages`
- `npm run test:scanner-bridge`
- `node --check frontend\drive-discs.js`
- `node --check frontend\scanner-bridge.js`

## 2026-07-02 - Published Scanner 1.0.33 and Batched Modal Updates

### Request Context

The public Drive Disc scanner needed to move from the prior 1.0.28 web package
to the locally fixed ZZZ Scanner Next 1.0.33 runtime. The web page also needed
to stop carrying older aggressive OCR tuning knobs and instead send the stable
1.0.33 scan request shape. At the same time, the current working tree already
contained pending optimizer, analysis, maintenance, and modal UX changes, so
this release commits them together and documents them in the README.

### Scanner Package And Payload Changes

Repacked the OCR runtime from `E:\yan1\zzz\ZZZ-Scanner.Next\publish 1.0.33`
into `downloads/zzz-scanner/1.0.33/ZZZ-Scanner.Next-win-x64.zip`, excluding the
generated `Scans` directory. The package contains the built-in
`Data/ocr_fast_templates.json`, so the browser no longer needs to pass any
`ocrFastIndex` override. The new package checksum is
`4abae2da99e3afbbd76a1ab59a3666e9cec1f09f96ca414e795a69d4cea6fe73`, and the
package size is `46947741` bytes.

Updated both the local ignored scanner manifest and the generated Pages
manifest source to publish scanner version `1.0.33` under the GitHub Release tag
`scanner-1.0.33`. The Drive Disc scanner helper download links now point to the
same release tag.

The browser `scan_req` payload now uses:

- `fastMode: true`
- `captureMode: "dxgi"`
- `profileRouting: "strict"`
- `overlapConflictMode: "recover"`
- `panelAcceptMode: "adaptive-early-full-roi"`
- `scrollAcceptMode: "early-one-row"`
- `postScrollPanelAcceptMode: "safe"`
- `panelMinAcceptFloorMs: 120`
- `stopAtNonLevel15: true` by default from the checked UI option

The page does not send `includeNon15`, `ocrFastIndex`,
`sameRowPanelMinAcceptFloorMs`, or `postScrollPanelMinAcceptFloorMs`, leaving
1.0.33 to use its bundled strict profile routing and fast-template data.

### Modal Workflow Changes

The Combat Buff modal on both the homepage and calculation page now edits a
draft list and applies it only when the user clicks "应用选择". Candidate clicks,
checkbox changes, teammate group add/remove actions, and custom Buff creation
update the pending draft instead of immediately recalculating and closing the
modal. The footer shows the current selected count plus pending add/remove
counts.

The optimizer two-piece and four-piece restriction modals also edit drafts and
apply them explicitly. The calculation config modal keeps a snapshot so closing
or cancelling restores the prior event/objective state. Combat Buff,
two-piece/four-piece, calculation config, Drive Disc edit, and loadout edit
modals now share sticky footer styling with clear cancel/apply or cancel/save
actions, and Escape closes the active modal without applying pending changes.

### Shared Stack Controls

Stacked W-Engine effects can now declare `stackGroup` and `stackLabel`. Runtime
UI reads these groups through shared combat helpers and renders one stack input
that writes the same selected stack count to every rule in the group. The
maintenance form can edit the group id and display label, and validation ensures
rules in the same group have matching `maxStacks` and `defaultStacks`.

The Qingming Cage W-Engine uses this for its two Qingming Companion stacked
effects, so Ether DMG and Ether Sheer DMG share the same layer count in previews
and in-combat calculations.

### Files Touched

- `downloads/zzz-scanner/manifest.json`
- `downloads/zzz-scanner/1.0.33/ZZZ-Scanner.Next-win-x64.zip`
- `scripts/build-pages.js`
- `frontend/scanner-bridge.js`
- `frontend/drive-discs.html`
- `frontend/drive-discs.js`
- `frontend/app.js`
- `frontend/calculate.js`
- `frontend/index.html`
- `frontend/styles.css`
- `frontend/shared-combat.js`
- `frontend/maintenance.js`
- `frontend/maintenanceValidation.js`
- `backend/server.js`
- `backend/driveDiscAnalysis.js`
- `frontend/driveDiscAnalysis-core.js`
- `frontend/drive-disc-analysis.js`
- `data/w_engines.json`
- `data/drive_disc_sets.json`
- `README.md`
- `README.zh-CN.md`
- scanner, optimizer, maintenance, shared combat, analysis, production, import,
  and account regression tests under `tests/`

### Verification

Generated the static Pages artifact:

- `npm run build:pages`

Ran scanner and directly related feature tests:

- `npm run test:scanner-bridge`
- `npm run test:drive-disc-analysis`
- `npm run test:browser-local-compute`
- `npm run test:optimizer-ui`
- `npm run test:server-production`
- `npm run test:maintenance-validation`
- `npm run test:shared-combat`
- `npm run test:w-engine-modification`

Ran the remaining npm regression scripts:

- `npm run test:atk-basis`
- `npm run test:percent-sanity`
- `npm run test:formula`
- `npm run test:damage-whitebox`
- `npm run test:anomaly-damage`
- `npm run test:maintenance-stats`
- `npm run test:compiled-score`
- `npm run test:compiled-panel-score`
- `npm run test:optimizer`
- `npm run test:optimizer-progress`
- `npm run test:optimizer-api`
- `npm run test:optimizer-fuzz`
- `npm run test:drive-disc-import`
- `npm run test:accounts`

## 2026-07-02 - Added Helper Download Progress Reporting

### Request Context

The Drive Disc scan modal could sit on "正在下载 OCR 扫描器" for a long time
without telling the user whether bytes were still moving. This made slow or
blocked GitHub Release downloads indistinguishable from a frozen page.

### Helper Changes

Updated `Launcher/Program.cs` in ZZZ Scanner Next so Helper `1.0.1` downloads
the OCR package in explicit chunks instead of using a single `CopyToAsync`.
During the download it emits `launcher_progress` messages containing:

- `bytesDownloaded`
- `totalBytes`
- `percent`
- `bytesPerSecond`
- `attempt`
- `maxAttempts`
- `url`

The helper now keeps a temporary `.download` file during a package attempt and
reports connection interruptions before retrying. If the download still fails
after the configured retries, the thrown error names the retry exhaustion
instead of leaving the browser with a generic preparation timeout.

### Web Changes

The Drive Disc page formats Helper progress as downloaded size, total size,
percentage, speed, and retry count. The Helper download link includes a
`v=1.0.1` cache buster, and the scan modal warns when a connected Helper is
older than `1.0.1` because older Helpers do not send byte-level download
progress.

### Diagnosis

The `scanner-1.0.33` GitHub Release assets were reachable by HEAD and reported
the expected sizes, but full zip download probes from this machine failed with
connection reset/empty reply/connection timeout errors. The ECS mirror at
`121.199.21.10` still serves the old `1.0.26` manifest and returns 404 for the
`1.0.33` zip. That means the observed "stuck" state is very likely a flaky or
blocked GitHub download path, not merely the browser failing to repaint.

### Verification

Ran:

- `dotnet build Launcher\ZZZ-Scanner.Helper.csproj -c Release`
- `dotnet publish Launcher\ZZZ-Scanner.Helper.csproj -c Release -r win-x64 --self-contained true -o dist\publish-helper`
- `node --check frontend\drive-discs.js`
- `node --check frontend\scanner-bridge.js`
- `npm run test:scanner-bridge`

## 2026-07-01 - Added Role-Aware Drive Disc Stat Difference Analysis

### Request Context

The Drive Disc analysis modal already showed the current substat distribution
and stat gain curves, but it did not answer the more direct optimizer question:
"if I replace one meaningful stat on this exact six-disc build, how much does
the current damage target move?" The requested behavior was modeled after the
bottom tables in external character cards, while avoiding a blind full-pool
enumeration. Main-stat candidates needed to reuse the same role preference data
that the optimizer already consumes, especially `agent.preferredDriveDiscs.
mainStatLimits`, so the analysis would not suggest irrelevant slot-4/5/6
main-stat swaps for a character.

### Model Changes

Added `analyzeDriveDiscStatDiffs` to both `backend/driveDiscAnalysis.js` and
`frontend/driveDiscAnalysis-core.js`. The function returns a unified difference
result with `baseline`, `substatDiffs`, `substatReplacements`, and
`mainStatDiffsBySlot`.

The baseline is the current six equipped Drive Discs, current set counts, the
current agent, W-Engine, runtime Buff settings, and selected damage objective.
Each candidate is evaluated by rebuilding the Drive Disc stat totals and running
the same in-combat panel calculator used by the existing damage analysis, rather
than using a static weight table.

Substat differences add one current S-rank substat step at a time and discard
zero-impact entries, so the table follows the real marginal value for the
current damage event. Main-stat differences are limited to slots 4, 5, and 6.
For each slot, the candidate list first reads the agent's
`preferredDriveDiscs.mainStatLimits`; if the agent has no role preference for
that slot, the function falls back to `statRules.driveDisc.mainStatPools`. The
current main stat is filtered out before scoring, which prevents fake reverse
rows such as a physical-damage disc showing a meaningless `-30 physicalDmg`
entry.

The backend and browser implementations were kept isomorphic so static Pages
local computation and the Node API produce the same difference table.

### API Changes

Added `POST /api/analysis/drive-disc-stat-diffs` beside the existing Drive Disc
analysis endpoints. It uses the same production guard as the other heavy
compute endpoints because all `/api/analysis/` routes are disabled on the public
production server.

### UI Changes

The existing homepage "词条分析" button now opens a combined "驱动盘分析" modal
instead of adding another entry point. The modal has three sibling views:

- "差异计算" for role-aware substat and slot-4/5/6 main-stat replacement tables.
- "当前副词条" for the previous substat distribution view.
- "收益曲线" for the previous stat gain curve view.

The difference tables show the current value or current main stat, replacement
candidate, absolute damage delta, and relative damage delta. Main-stat sections
also label whether candidates came from the agent's preferred Drive Disc config
or the generic slot pool fallback.

### Files Touched

- `backend/driveDiscAnalysis.js`
- `frontend/driveDiscAnalysis-core.js`
- `frontend/drive-disc-analysis.js`
- `frontend/styles.css`
- `backend/server.js`
- `tests/drive-disc-analysis.test.js`
- `tests/browser-local-compute.test.js`
- `tests/server-production.test.js`

### Verification

Ran `node --check` for the changed backend/frontend JavaScript entry points:

- `frontend/drive-disc-analysis.js`
- `frontend/driveDiscAnalysis-core.js`
- `backend/driveDiscAnalysis.js`
- `backend/server.js`

Ran targeted regression tests:

- `npm run test:drive-disc-analysis`
- `npm run test:browser-local-compute`
- `npm run test:optimizer-ui`
- `npm run test:server-production`

The new regression coverage checks that slot-5 physical-damage discs do not
generate a fake negative physical-damage row, that main-stat candidates come
only from the role's preferred Drive Disc config when present, that a scored
main-stat replacement matches a full damage recomputation, and that browser and
backend difference-analysis results stay identical.

## 2026-05-28 - Removed Homepage Effect Record Card

### Request Context

The homepage "效果记录" card mixed out-of-combat effect records with in-combat
Buff diagnostics. After W-Engine and Drive Disc 4-piece Buffs moved into the
in-combat layer, that card showed normal in-combat-only rules as "已忽略",
which was misleading for users.

### UI Changes

Removed the homepage "效果记录" card and removed the related "效果" sidebar
links from the homepage, maintenance page, and Drive Disc inventory page. The
in-combat panel still shows "已启用 Buff", and the raw debug JSON still exposes
`appliedEffects` and `ignoredEffects`.

### Model Changes

Stopped adding Drive Disc 4-piece rules and W-Engine self Buffs to
`outOfCombat.ignoredEffects`. Those rules belong to the in-combat Buff layer;
the backend keeps `ignoredEffects` for real diagnostics such as missing sets,
not-equipped 4-piece Buffs, specialty mismatches, and missing ATK% basis.

## 2026-05-28 - Added Formula Buff Rule

### Request Context

The existing `derived` Buff rule only supported proportional conversion:
`sourceValue * ratio / 100`, optionally capped. That cannot accurately model
rules such as "base 10% damage bonus, then every 400 HP above 15000 adds 1%,
up to 40% total." A dedicated threshold-step template was too narrow for future
Buffs, so the model now uses a safe single-variable function rule instead.

### Model Changes

Added a new structured Buff rule type:

```json
{
  "type": "formula",
  "stat": "dmgBonus",
  "mode": "flat",
  "source": {
    "variable": "x",
    "label": { "zhCN": "照的初始最大生命值" },
    "defaultValue": 27000,
    "min": 15000,
    "max": 27000
  },
  "formula": {
    "expression": "clamp(floor((x - 15000) / 400) + 10, 10, 40)",
    "valueUnit": "storedPercent"
  }
}
```

The backend evaluates formula rules with a whitelist parser, not `eval` or
`new Function`. Only the variable `x`, numbers, arithmetic operators,
parentheses, and `floor/ceil/round/min/max/clamp` are allowed. The computed
value then goes through the same stored-percent conversion as all other Buff
stats, so `dmgBonus: 40` becomes `0.4` in the in-combat panel.

### UI Changes

Updated the homepage Buff runtime controls so `formula` reuses the existing
source-value input and shows the expression used. Updated the maintenance page
rule editor with a new "受限函数换算" type and fields for source label, default
source value, source min/max, and expression.

### Data Changes

Updated `data/combat_buffs.json` so 照's teammate Buff includes the actual
formula-based damage bonus from the supplied screenshot.

### Verification

Added `tests/formula.test.js` for source values 15000, 15399, 15400, 27000, and
31000, plus a regression check that 千夏's existing `derived` rule is unchanged.
Updated maintenance validation tests to accept valid `formula` rules and reject
unsafe expressions such as `window.x`.

## 2026-05-27 - Fixed Stored Percent Display in Core Skill Summary

### Request Context

After the stricter percent modeling work, the homepage character card displayed
Ye Shunguang's Core Skill as `暴击率 +1440%`. The underlying data was correct:
the Core Skill grants `4.8%` CRIT Rate at each of A, C, and E, for `14.4%`
total. The bug was a display-layer mismatch between stored percent values and
calculated panel fractions.

### Frontend Changes

Updated:

```text
frontend/app.js
```

`coreSkillSummary()` now formats Core Skill stat totals with the stored-percent
formatter. Core Skill JSON uses human percent numbers, such as `4.8` for
`4.8%`, while panel output uses calculated fractions, such as `0.048`. The
summary previously sent the stored number into the panel formatter, which
multiplied it by 100 again.

### Test Changes

Added:

```text
tests/percent-sanity.test.js
```

The new test scans stored percent data for implausible outliers and verifies
example calculated panels keep percent-like values in calculated-fraction
space. This does not replace source verification, but it catches common
conversion mistakes such as `14.4` being treated as `1440%` in the calculation
layer.

Updated `package.json` with:

```text
npm run test:percent-sanity
```

### Verification

Ran:

```text
node --check frontend/app.js
node --check backend/calculator.js
npm run test:percent-sanity
npm run test:atk-basis
```

All checks passed.

## 2026-05-27 - Hardened ATK Basis Modeling and Added Attack Breakdown UI

### Request Context

The calculator needed a clearer and safer separation between three attack
concepts: Base ATK from agent, W-Engine, and Core Skill; out-of-combat panel ATK
from equipment percentages and flats; and in-combat ATK from teammate, field,
enemy, W-Engine, Drive Disc, or manual Buffs.

### Backend Changes

Updated `backend/calculator.js` so in-combat ATK% effects no longer silently
fall back to the wrong basis. Teammate, boss/enemy, field, and manual Buffs now
default missing in-combat `atkPct` basis to `outOfCombatAtk`. Self, W-Engine,
and Drive Disc 4-piece in-combat `atkPct` effects must explicitly declare
`basis`; otherwise the effect is ignored with `missingAtkPctBasis`.

The calculation response now includes attack breakdowns:

- `outOfCombat.breakdown.baseAtk`
- `outOfCombat.breakdown.atkPanel`
- `inCombat.breakdown.atkPanel`

These make the Base ATK, out-of-combat ATK, and in-combat ATK stages inspectable
without reverse-engineering the formula from totals.

### Data Changes

Updated existing in-combat Drive Disc 4-piece ATK% entries in
`data/drive_disc_sets.json` to declare `basis: "baseAtk"` explicitly.

### Frontend Changes

Added a homepage "攻击力计算明细" card with a collapsed details control. It
shows Base ATK composition, out-of-combat ATK calculation, and in-combat ATK
calculation. Buff records and ignored-effect records now surface the basis or
the missing-basis reason.

### Model Guardrail

Documented the ATK basis rules in `docs/modeling.md`. Future data additions
should never add an in-combat `atkPct` without either an explicit `basis` or a
source type that intentionally defaults to `outOfCombatAtk`.

Added catalog-load validation in `backend/calculator.js` for the strict source
types. Self Buffs, W-Engine effects, and Drive Disc 4-piece effects now fail
data loading if they contain in-combat `atkPct` without `basis`, so the mistake
is caught while editing data instead of only after a user clicks the checkbox.

Added `tests/atk-basis.test.js` and the `npm run test:atk-basis` script. The
test locks the important attack stages:

- Base ATK includes agent Base ATK, W-Engine Base ATK, and Core Skill Base ATK.
- Out-of-combat ATK% including a simulated W-Engine advanced ATK% stat scales
  from Base ATK.
- `basis: "baseAtk"` and `basis: "outOfCombatAtk"` produce different
  in-combat flat attack contributions.
- Teammate ATK% without basis defaults to `outOfCombatAtk`.
- Self ATK% without basis is ignored with `missingAtkPctBasis`.
- Equipped 4-piece ATK% uses its explicit `baseAtk` basis.

## 2026-05-27 - Simplified Out-of-Combat Panel Display and Added Ye Shunguang Highlights

### Request Context

The homepage out-of-combat panel still showed the old simple-score block and
top stat summary. The requested display should remove that block, remove the
generic damage bonus row from the out-of-combat module, and visually emphasize
Ye Shunguang's priority panel stats.

### Frontend Changes

Updated:

```text
frontend/index.html
frontend/app.js
frontend/styles.css
```

Removed the out-of-combat panel's top `panel-band` block, including the visible
simple-score card and compact summary tiles. The raw calculation still keeps
`simpleTargetScore`, but it is no longer displayed inside the out-of-combat
panel card.

Split the out-of-combat panel display order from the shared panel order. The
out-of-combat panel now omits `dmgBonus`, while the in-combat panel continues
to show `dmgBonus` because it is needed for Buff inspection.

Removed `dmgBonus` from the out-of-combat "加成汇总" display as well, so the
entire out-of-combat module no longer shows the generic damage bonus row.

Added a first character-specific highlight map:

```text
ye_shunguang: atk, critRate, critDmg, physicalDmg
```

These rows now get a stronger dark font weight and a yellow-accent highlighted
row style when Ye Shunguang is selected. The data model is intentionally shaped
so later characters can receive their own highlight sets without changing the
table renderer again.

## 2026-05-27 - Split W-Engine Effect Text From In-Combat Buff Data

### Request Context

The homepage W-Engine card showed Base ATK and advanced stat but did not show
the W-Engine's weapon effect text. The required model shape is now explicitly
split into two layers:

1. Human-readable W-Engine effect text for the UI.
2. Structured Buff data used by the in-combat panel.

### Data Changes

Updated:

```text
data/w_engines.json
```

Each current W-Engine now uses:

```json
{
  "effect": {
    "name": {},
    "requirement": {},
    "description": {},
    "buff": {}
  }
}
```

`effect.description` is display-only. `effect.buff` is the structured
calculation payload that can be enabled from the homepage's in-combat settings.
This prevents future W-Engine descriptions from being conflated with formulas.

### Backend Changes

Updated:

```text
backend/calculator.js
```

The calculator now reads W-Engine in-combat effects from `effect.buff`. A small
compatibility helper still understands old `passive` records if they ever appear
in imported or transitional data, but the canonical static model is `effect`.

`GET /api/meta` now exposes the full `effect` object for each W-Engine and keeps
a derived `passive` field only as a compatibility alias for existing frontend
logic.

### Frontend Changes

Updated:

```text
frontend/index.html
frontend/app.js
frontend/styles.css
```

The homepage W-Engine settings card now renders an "音擎效果" block containing:

- The effect name.
- The specialty requirement text.
- The display description.
- A compact "局内 Buff" line generated from the structured Buff stats.

The in-combat Buff selector continues to use the same W-Engine effect, but now
it pulls from `effect.buff` instead of relying on a top-level `passive`.

## 2026-05-27 - Added In-Combat Panel Stage

### Request Context

The homepage needed a second panel stage after the existing out-of-combat
panel. The target was not final damage calculation. The target was an
inspectable in-combat panel that starts from the already-correct
out-of-combat panel and then adds selected Buff effects from self, teammate,
Drive Disc 4-piece sets, boss/enemy effects, field effects, and manual
corrections.

### Data Model

Added:

```text
data/combat_buffs.json
```

The new catalog is the generic place for verified self, teammate, boss, field,
and manual-style Buff entries. For this pass, only hidden validation Buffs were
seeded because unverified values from the reference HTML should not become
default truth. Verified W-Engine passives remain in `data/w_engines.json`, and
verified Drive Disc 4-piece effects remain in `data/drive_disc_sets.json`.

The Buff model now supports a `basis` field for percentage HP/ATK/DEF effects.
This matters because an attack percentage can mean either:

```text
baseAtk basis:          flat attack = base.atk * value
outOfCombatAtk basis:   flat attack = outOfCombat.panel.atk * value
```

The first visible user-facing source for unverified or situational values is
the homepage's manual correction area.

### Backend

Updated:

```text
backend/calculator.js
backend/server.js
```

Added `POST /api/calculate/in-combat`. The endpoint preserves the old
`POST /api/calculate/out-of-combat` behavior and returns:

```json
{
  "outOfCombat": {},
  "inCombat": {
    "panel": {},
    "buffTotals": {},
    "activeEffects": [],
    "ignoredEffects": [],
    "breakdown": {}
  }
}
```

The in-combat calculation now runs in two phases:

1. Compute the existing out-of-combat panel exactly as before.
2. Apply only selected in-combat Buff candidates on top of that panel.

Added runtime candidates for:

- Current W-Engine passive, gated by specialty match.
- Current character's equipped Drive Disc 4-piece effects, available only when
  the current equipment has at least four pieces from that set.
- Teammate Drive Disc 4-piece effects selected manually.
- Manual corrections posted by the frontend.
- Generic static Buffs from `data/combat_buffs.json`.

The in-combat panel keeps `dmgBonus` and elemental damage bonuses separate for
display. Later damage calculation can merge them into the same multiplier
bucket when that model exists.

### Frontend

Updated:

```text
frontend/index.html
frontend/app.js
frontend/styles.css
```

Added a homepage "局内设置" card with groups for:

- 自身 Buff
- 队友 Buff
- 驱动盘 4 件套
- Boss / 敌方效果
- 场地 Buff
- 手动修正

Added a homepage "局内面板" result card that shows:

- In-combat panel values using the same stat order as the out-of-combat panel.
- In-combat Buff totals.
- Enabled Buff records.

The homepage now calls `/api/calculate/in-combat` so switching character,
W-Engine, Core Skill, or Drive Discs recalculates both panel stages together.
Checking or unchecking a Buff recalculates only the in-combat layer while the
out-of-combat layer remains the visible baseline.

### Model Impact

The existing out-of-combat model remains the source of truth for bag-style
comparison and should not include in-combat passives or conditional effects.
The new in-combat model is additive on top of `outOfCombat.panel`.

Percentage HP/ATK/DEF in-combat Buffs are split into separate internal totals:

```text
hpPctBase / hpPctOutOfCombat
atkPctBase / atkPctOutOfCombat
defPctBase / defPctOutOfCombat
```

This prevents "10% base attack" from being accidentally treated the same as
"10% current out-of-combat panel attack".

### Verification Notes

The intended verification for this change is:

- `node --check backend/calculator.js`
- `node --check backend/server.js`
- `node --check frontend/app.js`
- API calculation where no Buff is enabled and `inCombat.panel` equals
  `outOfCombat.panel`.
- API calculation where Cloudcleave Radiance passive adds CRIT DMG, damage
  bonus, and physical resistance ignore only to the in-combat panel.
- API calculation showing hidden validation Buffs for `10% baseAtk` and
  `10% outOfCombatAtk` produce different attack contributions.
- API calculation showing an equipped in-combat Drive Disc 4-piece effect only
  enters the in-combat panel after its checkbox ID is active.

## 2026-05-26 - Created Independent ZZZ Calculator Maintenance Area

### Request Context

The work started from a requirement to study the existing `genshin_artifact`
project, especially its modeling style, and then create an independent Zenless
Zone Zero Drive Disc calculator without modifying the existing Genshin Impact
modules such as `mona_*`, `src`, or `src-tauri`.

### Directory Boundary

Created the independent directory:

```text
E:\yan1\genshin_artifact\zzz_calculator
```

The directory became the explicit maintenance boundary for all ZZZ calculator
work. The rule is: unless a later integration step explicitly asks to connect
this work into the main frontend or WASM packages, all ZZZ data models,
examples, backend code, frontend code, and documentation should stay under
`zzz_calculator`.

### Initial Files

Created the initial maintenance layout:

```text
zzz_calculator/
  README.md
  docs/
    modeling.md
  data/
    agents.json
    w_engines.json
    drive_disc_sets.json
    stat_rules.json
  examples/
    out_of_combat_panel.example.json
```

### Initial Modeling Scope

Documented the first model as a deliberately narrow out-of-combat panel model.
The v1 calculation target was:

1. Agent base stats are fixed at level 60.
2. Agent Base ATK plus W-Engine Base ATK produces total Base ATK.
3. Agent base HP and DEF do not receive W-Engine base values.
4. W-Engine advanced stats, Drive Disc main stats, Drive Disc sub-stats, and
   unconditional out-of-combat 2-piece set effects contribute to the panel.
5. In-combat effects, teammate buffs, field buffs, enemy data, stun windows,
   anomaly, disorder, rotations, and real damage formula details are deferred.

### Static Data Seeded

Seeded `data/agents.json` with an initial level 60 agent record for Anby Demara.
The record included id, localized names, rarity, attribute, specialty, faction,
attack type, level 60 HP/ATK/DEF, and deterministic default panel stats.

Seeded `data/w_engines.json` with Demara Battery Mark II. The model included
level 60 Base ATK, advanced stat, passive metadata, source links, and a flag
that prevents the passive from entering the v1 out-of-combat panel.

Seeded `data/drive_disc_sets.json` with a small set of Drive Disc sets needed
for formula calibration: Woodpecker Electro, Swing Jazz, and Hormone Punk. Their
2-piece effects were modeled as out-of-combat where appropriate and their
4-piece effects were stored but excluded from the v1 panel.

Seeded `data/stat_rules.json` with stat display rules, Drive Disc partition
main stat pools, S-rank max main stat values, sub-stat pools, sub-stat step
values, and the base attack rule.

Created `examples/out_of_combat_panel.example.json` as the first deterministic
snapshot for validating the Anby + Demara Battery Mark II + six sample Drive
Disc calculation.

## 2026-05-26 - Added Frontend/Backend Split

### Backend

Added:

```text
backend/
  calculator.js
  server.js
```

`backend/calculator.js` became responsible for loading static JSON data,
building lookup maps, applying out-of-combat equipment bonuses, applying only
eligible effects, and returning a rounded calculation payload.

`backend/server.js` became a dependency-free Node.js HTTP server. It serves the
frontend files and exposes calculator API endpoints.

### API Endpoints Added

Added:

- `GET /api/health`
- `GET /api/meta`
- `GET /api/example/out-of-combat`
- `POST /api/calculate/out-of-combat`

### Calculation Behavior

Implemented the attack special case:

```text
base.atk = agent.level60.atkBase + wEngine.level60.atkBase
```

Implemented HP and DEF as pure agent base values:

```text
base.hp = agent.level60.hpBase
base.def = agent.level60.defBase
```

Implemented out-of-combat panel formulas:

```text
hpPanel  = base.hp  * (1 + hpPct)  + hpFlat
atkPanel = base.atk * (1 + atkPct) + atkFlat
defPanel = base.def * (1 + defPct) + defFlat
```

Implemented additive handling for CRIT Rate, CRIT DMG, Impact, Anomaly
Proficiency, Anomaly Mastery, Energy Regen, PEN, PEN Ratio, elemental damage
bonuses, and generic damage bonuses as the first-pass model.

Implemented a simple target score:

```text
score = atkPanel * (1 + min(critRate, 1) * critDmg) * (1 + selectedDmgBonus)
```

### Frontend

Added:

```text
frontend/
  index.html
  app.js
  styles.css
  zzz-mark.svg
```

The first frontend could load metadata, load the example, submit calculation
requests, render base stats, bonus totals, panel stats, applied effects,
ignored effects, simple score, and raw JSON results.

### Package

Added `package.json` with a local start script for the Node backend.

## 2026-05-26 - Redesigned Frontend Into ZZZ-Style Calculator Workspace

### Motivation

The first frontend was functionally useful but visually rough. The target was
to make it resemble the workbench style of the referenced Mona/Genshin
calculator while not copying Genshin visuals directly. The new direction was a
Chinese, Zenless Zone Zero flavored tool surface.

### Layout Changes

Reworked `frontend/index.html` into:

- A dark left sidebar.
- A brand area.
- Chinese navigation items.
- A top title/action area.
- A current-character hero strip.
- A left configuration column.
- A right result/panel column.

The main page sections became:

- 角色设置
- 音擎设置
- 驱动盘
- 输入数据
- 局外面板
- 原始结果

### Visual Style

Rewrote `frontend/styles.css` to use:

- Dark sidebar.
- Yellow ZZZ accent.
- Blue action accent.
- Light calculation workspace.
- Card radius capped at 8px.
- Compact stat chips.
- Stable Drive Disc slot cards.
- Responsive one-column layout for smaller screens.

### Chinese Labels

Updated `frontend/app.js` so stat labels prefer local Chinese labels instead of
English labels from `stat_rules.json`.

Added Chinese enum display for:

- Attributes, including physical, fire, ice, electric, ether, and later honed
  edge.
- Specialties such as 强攻, 击破, 异常, 支援, 防护, 命破.
- Factions such as 狡兔屋 and later 云岿山.

Added Chinese display for set effects so records can show text such as
`啄木鸟电音 2件套` instead of raw ids.

### Verification

Verified:

- `node --check frontend/app.js`
- Static page returned HTTP 200.
- CSS returned HTTP 200.
- JS returned HTTP 200.
- The out-of-combat calculation API still returned the expected Anby score.
- A headless Edge screenshot was used to visually inspect the first viewport.

## 2026-05-26 - Added Media Asset Support

### Data Changes

Extended agent and W-Engine data records with optional `images` fields. These
fields are not calculation inputs; they are frontend display metadata.

Agent images now support:

```json
{
  "portrait": "/assets/agents/...",
  "source": "..."
}
```

W-Engine images now support:

```json
{
  "icon": "/assets/w-engines/...",
  "source": "..."
}
```

### Frontend Changes

Updated the frontend so the hero strip, agent card, and W-Engine card can show
the configured media assets. The fallback remains `zzz-mark.svg`.

### Asset Files Present

The current frontend asset tree includes:

```text
frontend/assets/agents/anby_demara.webp
frontend/assets/agents/ye_shunguang.png
frontend/assets/w-engines/cloudcleave_radiance.webp
frontend/assets/w-engines/demara_battery_mark_ii.webp
```

## 2026-05-26 - Added Ye Shunguang And Cloudcleave Radiance

### Source Pages

Used Biligame Wiki pages as the data source:

- `https://wiki.biligame.com/zzz/%E5%8F%B6%E7%9E%AC%E5%85%89`
- `https://wiki.biligame.com/zzz/%E4%BA%91%E9%9C%93%E5%AD%A4%E5%85%89`

### Agent Added

Added `ye_shunguang` to `data/agents.json`.

Modeled fields:

- Chinese name: 叶瞬光
- English id/name field: Ye Shunguang
- Rarity: S
- Attribute: `honed_edge`
- Damage element: `physical`
- Specialty: `attack`
- Faction: `yunkui_summit`
- Level 60 HP: 7673
- Level 60 ATK: 863
- Level 60 DEF: 606
- CRIT Rate default: 5%
- CRIT DMG default: 50%
- Impact: 83
- Anomaly Proficiency: 93
- Anomaly Mastery: 94
- Energy Regen: 1.2
- PEN Ratio: 0

### Special Attribute Modeling Decision

叶瞬光 uses a special displayed attribute, modeled as `honed_edge`. Because the
weapon text references physical resistance ignore, the model also adds
`damageElement: "physical"`. This allows the current score helper and future
damage formula to use physical damage bonus and physical resistance rules while
still preserving the displayed special attribute.

### W-Engine Added

Added `cloudcleave_radiance` to `data/w_engines.json`.

Modeled fields:

- Chinese name: 云霓孤光
- Rarity: S
- Specialty: attack
- Related agent: ye_shunguang
- Level 60 Base ATK: 743
- Advanced stat: CRIT DMG +48%

### W-Engine Passive Modeling

Modeled phase 1 passive values only:

- `physicalResIgnore +20%`
- `dmgBonus +25%`
- `critDmg +25%`

The passive is stored as `scope: "inCombat"` and
`appliesToOutOfCombatPanel: false`, so it is intentionally ignored by the
current out-of-combat panel calculation.

### New Stat Added

Added `physicalResIgnore` to `data/stat_rules.json` and backend stat handling.
This stat is not a normal out-of-combat panel stat like ATK or CRIT. It is a
future enemy resistance/damage-calculation input.

### Example Added

Added `examples/ye_shunguang_panel.example.json`.

With Ye Shunguang and a level 60 Cloudcleave Radiance but no Drive Discs, the
expected out-of-combat output is:

```text
base.hp = 7673
base.atk = 863 + 743 = 1606
base.def = 606
panel.critRate = 0.05
panel.critDmg = 0.50 + 0.48 = 0.98
simpleTargetScore = 1684.694
ignoredEffects = []
```

### API Added

Added:

- `GET /api/example/ye-shunguang`

### Frontend Added

Added a `叶瞬光模板` button that loads the Ye Shunguang example into the current
calculator form.

### Verification

Verified:

- JSON parsing for agents, W-Engines, stat rules, and the Ye Shunguang example.
- `node --check backend/calculator.js`
- `node --check backend/server.js`
- `node --check frontend/app.js`
- Local calculation for Ye Shunguang returned HP 7673, ATK 1606, CRIT DMG 0.98,
  simple score 1684.694, and ignored the Cloudcleave Radiance passive.
- The backend service was restarted on port 8787 and `/api/meta` showed both
  `ye_shunguang` and `cloudcleave_radiance`.

## 2026-05-26 - Added User Drive Disc Inventory Model And ZZZ Scanner Import

### Request Context

The user provided a ZZZ Scanner export file:

```text
E:\yan1\ZZZ-Scanner-master\ZZZ-Scanner.Next\publish-dpi-fix\Scans\2026-05-26-19-12-09\export.json
```

The requirement was to adapt the data model so the project can read this export
and record one user's full Drive Disc inventory. A future page should display
all user Drive Discs and support import, create, read, update, and delete.

### Export Shape Observed

The export is a top-level JSON array with 200 items.

Each item has these fields:

- `序号`
- `名称`
- `槽位`
- `品质`
- `等级`
- `最大等级`
- `主属性`
- `副属性`

The observed set names were:

- 流光咏叹
- 沧浪行歌
- 月光骑士颂
- 山大王
- 云岿如我
- 法厄同之歌
- 如影相随
- 折枝剑歌

The observed main stat labels were:

- 生命值
- 攻击力
- 防御力
- 暴击率
- 暴击伤害
- 异常精通
- 异常掌控
- 冲击力
- 能量自动回复
- 穿透率
- 物理伤害加成
- 火属性伤害加成
- 冰属性伤害加成
- 电属性伤害加成
- 以太伤害加成

The observed sub-stat labels were:

- 生命值
- 攻击力
- 防御力
- 暴击率
- 暴击伤害
- 异常精通
- 穿透值

### Model Added

Added `DriveDiscInventoryItem` and `DriveDiscInventoryStore` to
`docs/modeling.md`.

The user inventory is separate from canonical static game data. Static data
describes the game. The inventory describes one user's scanned or manually
edited Drive Discs.

### Data File Added

Generated:

```text
data/user_drive_discs.json
```

This file currently stores:

- `version`
- `updatedAt`
- `owners`
- `imports`
- `driveDiscs`

The current import record is:

- id: `zzz-scanner-20260526-191209`
- type: `zzz-scanner`
- ownerId: `default`
- sourcePath: the provided scanner export path
- importedAt: `2026-05-26T19:12:09+08:00`
- itemCount: 200
- warnings: none

### Import Normalization Rules

Added `backend/driveDiscInventory.js`.

The importer converts scanner fields into normalized inventory fields:

- `序号` -> `source.sequence`
- `名称` -> `setName`
- `槽位` -> `partition`
- `品质` -> `rarity`
- `等级` -> `level`
- `最大等级` -> `maxLevel`
- `主属性` -> `mainStat`
- `副属性` -> `subStats`

The generated inventory id is stable for the same owner, sequence, set name,
partition, rarity, level, main stat, and sub stats.

The generated set id is currently based on the Chinese set name hash:

```text
scanner-set-${sha1(setName).slice(0, 12)}
```

This is intentionally temporary. Once `data/drive_disc_sets.json` contains
canonical records for all these sets, imported set names should be resolved to
canonical set ids.

### Stat Normalization Rules

The importer normalizes Chinese labels and percentage strings:

- `"攻击力": "6%"` -> `atkPct: 0.06`
- `"攻击力": 38` -> `atkFlat: 38`
- `"生命值": "3%"` -> `hpPct: 0.03`
- `"生命值": 2200` -> `hpFlat: 2200`
- `"防御力": "4.8%"` -> `defPct: 0.048`
- `"防御力": 184` -> `defFlat: 184`
- `"暴击率": "4.8%"` -> `critRate: 0.048`
- `"暴击伤害": "14.4%"` -> `critDmg: 0.144`
- `"异常精通": 18` -> `anomalyProficiency: 18`
- `"异常掌控": "30%"` -> `anomalyMastery: 0.3`
- `"冲击力": "18%"` -> `impact: 0.18`
- `"能量自动回复": "60%"` -> `energyRegen: 0.6`
- `"穿透值": 9` -> `penFlat: 9`
- `"穿透率": "24%"` -> `penRatio: 0.24`
- `"物理伤害加成": "30%"` -> `physicalDmg: 0.3`
- `"火属性伤害加成": "30%"` -> `fireDmg: 0.3`
- `"冰属性伤害加成": "30%"` -> `iceDmg: 0.3`
- `"电属性伤害加成": "30%"` -> `electricDmg: 0.3`
- `"以太伤害加成": "30%"` -> `etherDmg: 0.3`

### Raw Data Preservation

Every imported item preserves the original scanner item in `raw`. This matters
because future UI will need to compare normalized data against scanner output,
and because scanner/OCR issues should be inspectable without re-reading the
original export file.

### Backend API Added

Added endpoints:

- `GET /api/user-drive-discs`
- `POST /api/user-drive-discs/import/zzz-scanner`
- `POST /api/user-drive-discs`
- `PUT /api/user-drive-discs/:id`
- `DELETE /api/user-drive-discs/:id`

The future inventory page can use these endpoints for import and CRUD.

### Documentation Added And Updated

Created this file:

```text
docs/changelog.md
```

The first line records the maintenance rule that every modification should be
logged in extreme detail.

Created:

```text
docs/goal.md
```

This file now tracks future goals with explicit statuses such as `Done`,
`Iterating`, `Planned`, and `Blocked`.

Updated:

```text
docs/modeling.md
README.md
```

`docs/modeling.md` now describes the user Drive Disc inventory model, the ZZZ
Scanner export shape, the Chinese stat normalization rules, and the new user
Drive Disc API surface.

`README.md` now lists the new backend inventory module, the new documentation
files, the generated user inventory data file, the Ye Shunguang example file,
and the user Drive Disc API endpoints.

### Verification

Verified that the provided export imports exactly 200 discs.

Verified that the first imported disc becomes:

```text
setName = 流光咏叹
partition = 1
mainStat = hpFlat 2200
subStats = atkPct 0.06, critRate 0.048, critDmg 0.144, atkFlat 38
```

Verified no warnings were produced by the scanner import for the provided file.

Verified syntax for:

- `backend/driveDiscInventory.js`
- `backend/server.js`
- `backend/calculator.js`
- `frontend/app.js`

Verified JSON parsing for the newly generated inventory file.

## 2026-05-26 - Added Dedicated Drive Disc Inventory Page

### Request Context

The user asked to start developing the `驱动盘` interface. The requirements were:

1. The interface should support create, delete, search/read, update, import,
   and viewing Drive Discs.
2. Clicking `驱动盘` from the homepage should no longer scroll within the
   homepage; it should navigate to the new page.
3. The new page should keep the same overall visual style and UI language as
   the existing homepage.

### Navigation Change

Updated:

```text
frontend/index.html
```

The sidebar `驱动盘` link changed from:

```html
href="#disc-section"
```

to:

```html
href="/drive-discs.html"
```

This makes the sidebar navigate to the dedicated inventory page instead of
moving to the Drive Disc JSON section inside the calculator homepage.

The homepage `首页` sidebar link was also changed to point to `/`, keeping it
consistent with the new multi-page navigation style.

### New Page Added

Created:

```text
frontend/drive-discs.html
frontend/drive-discs.js
```

The page follows the same shell as the homepage:

- dark left sidebar;
- yellow active navigation state;
- ZZZ brand block;
- light patterned work surface;
- top title/action area;
- hero summary strip;
- white cards with 8px radius;
- blue primary buttons and white secondary buttons.

### Page Structure

The new `驱动盘仓库` page contains:

- a header with `新增驱动盘` and `刷新仓库`;
- a hero summary showing current owner, total Drive Disc count, set count, and
  import count;
- an import card;
- a filterable/sortable Drive Disc table;
- a sticky detail/edit card on desktop;
- a raw scanner data preview.

### Import UI

The import card supports three workflows:

1. Use a local export path. The default path is the scanner file previously
   provided by the user:

   ```text
   E:\yan1\ZZZ-Scanner-master\ZZZ-Scanner.Next\publish-dpi-fix\Scans\2026-05-26-19-12-09\export.json
   ```

2. Choose a JSON file in the browser. The frontend reads it and submits its JSON
   content to the backend.
3. Paste the JSON export directly into a textarea.

All import modes call:

```text
POST /api/user-drive-discs/import/zzz-scanner
```

### Backend Import Improvement

Updated:

```text
backend/server.js
```

The scanner import endpoint now supports a payload with only `sourcePath`. When
the request includes a path but no embedded items, the backend reads the local
file and parses it as JSON.

This was needed because browser file inputs cannot safely expose a full local
path, but this project is a local tool and the backend can read the path when
the user explicitly provides it.

### Search And View UI

The table supports:

- keyword search across id, set name, slot, main stat, raw stat labels, and
  sub-stat labels;
- slot filtering;
- set filtering;
- main-stat filtering;
- sorting by import sequence, slot, set name, or level.

Each row displays:

- source sequence;
- set name;
- slot;
- rarity and level;
- main stat;
- sub stats;
- a `查看` action.

Selecting a row fills the detail/editor panel.

### Create UI

The `新增驱动盘` button creates a local manual draft in the frontend state with:

- generated id beginning with `manual-`;
- owner `default`;
- set name `未命名套装`;
- slot 1;
- S rarity;
- level 15;
- default HP main stat.

Saving the form persists the manual item through the backend upsert endpoint.

### Update UI

The detail form supports editing:

- id display;
- set name;
- partition;
- rarity;
- level;
- max level;
- equipped character;
- lock state;
- main stat type;
- main stat value;
- four sub-stat rows.

Percentage stats are edited as visible percentages. For example, `6` in the UI
is saved as `0.06` internally when the selected stat is a percentage stat.

### Delete UI

The detail form has a `删除` button. It asks for browser confirmation and then
calls:

```text
DELETE /api/user-drive-discs/:id
```

### CSS Added

Updated:

```text
frontend/styles.css
```

Added styles for:

- `danger-btn`;
- compact table buttons;
- inventory layout;
- import grid;
- filter toolbar;
- scrollable Drive Disc table;
- selected table rows;
- detail editor form;
- checkbox rows;
- main/sub stat editors;
- responsive inventory layout.

The mobile sidebar navigation was adjusted from three columns to two columns at
small width because the three-column layout was visually cramped at 390px.

### CRUD Verification

Used a temporary test Drive Disc id beginning with `codex-crud-test-`.

Verification flow:

1. Read initial count from `GET /api/user-drive-discs`: 201.
2. Created a temporary disc through `POST /api/user-drive-discs`.
3. Count increased to 202.
4. Updated the temporary disc level to 15 through `PUT /api/user-drive-discs/:id`.
5. Confirmed the returned record had level 15.
6. Deleted the temporary disc through `DELETE /api/user-drive-discs/:id`.
7. Count returned to 201.

The final store count was therefore restored after the test.

### Current Inventory Note

At the time of this change, the inventory contained 201 records:

- 199 records with source type `zzz-scanner`;
- 2 records with source type `screenshot`.

No cleanup was performed, because the extra screenshot records appear to be
intentional user data or prior generated data. The implementation preserves
existing user inventory records.

### Page Verification

Verified:

- `node --check frontend/drive-discs.js`
- `node --check backend/server.js`
- `GET /drive-discs.html` returns 200 and contains the inventory page markup.
- `GET /drive-discs.js` returns 200 and contains the user Drive Disc API logic.
- `GET /` returns 200 and no longer contains `href="#disc-section"`.
- `GET /` does contain `/drive-discs.html`.
- `GET /api/user-drive-discs` returns the inventory store.
- The server was restarted so backend source-path import support is active.

### Visual Verification

The in-app browser bridge was attempted but was unavailable in this environment.
The fallback was a headless Edge screenshot of:

```text
http://localhost:8787/drive-discs.html
```

The desktop screenshot confirmed:

- sidebar navigation matches the homepage style;
- `驱动盘` nav item is active;
- import card is visible;
- Drive Disc table is visible;
- detail/editor card is visible;
- hero summary shows 201 Drive Discs, 8 sets, and 1 import record.

A 390px-wide mobile screenshot was also taken. It confirmed the page stacks into
a single-column flow and led to the mobile sidebar adjustment from three columns
to two columns.

## 2026-05-27 - Added Core Skill Level Modeling To Out-Of-Combat Panel

### Request Context

The user reported that Ye Shunguang's Base ATK and displayed CRIT Rate were
wrong. The previous model used only the agent's level 60 base panel and did not
account for Core Skill enhancements. In Zenless Zone Zero, each agent has Core
Skill enhancement levels A-F, and those levels can increase stable
out-of-combat stats such as Base ATK and CRIT Rate.

The user provided a screenshot for Ye Shunguang's Core Skill enhancement table.
The table shows:

- Core Skill A: CRIT Rate +4.8%, Core Passive skill level +1.
- Core Skill B: Base ATK +25, Core Passive skill level +1.
- Core Skill C: CRIT Rate +4.8%, Core Passive skill level +1.
- Core Skill D: Base ATK +25, Core Passive skill level +1.
- Core Skill E: CRIT Rate +4.8%, Core Passive skill level +1.
- Core Skill F: Base ATK +25, Core Passive skill level +1.

### Data Model Added

Updated:

```text
data/agents.json
```

Added `coreSkill` to Ye Shunguang.

The structure records:

- localized Core Skill name;
- default level;
- max level;
- an ordered list of A-F enhancement records;
- each enhancement's stat changes;
- each enhancement's Core Passive skill level increment;
- source/verification metadata.

The current Ye Shunguang Core Skill model is:

```text
A: critRate +0.048, target panel
B: atkBase +25, target base
C: critRate +0.048, target panel
D: atkBase +25, target base
E: critRate +0.048, target panel
F: atkBase +25, target base
```

The Core Passive skill level increments are stored but not used by the current
panel calculator because skill multipliers and Core Passive damage scaling are
still deferred.

### Calculation Model Changed

Updated:

```text
backend/calculator.js
```

Before this change, total Base ATK was:

```text
base.atk = agent.level60.atkBase + wEngine.level60.atkBase
```

After this change, total Base ATK is:

```text
base.atk = agent.level60.atkBase + wEngine.level60.atkBase + coreSkill.atkBase
```

For Ye Shunguang at Core Skill F:

```text
base.atk = 863 + 743 + 75 = 1681
```

Core Skill Base HP and Base DEF are also supported in the model, even though Ye
Shunguang's current Core Skill data only adds Base ATK.

### Core Skill Selection

The calculation input now supports:

```json
{
  "coreSkillLevel": "F"
}
```

If `coreSkillLevel` is omitted, the backend uses the agent's modeled default
Core Skill level. For Ye Shunguang this is `F`.

If a character has no modeled Core Skill data yet, the backend uses `none` and
applies no Core Skill bonuses. This preserves the current Anby snapshot until
her Core Skill table is added.

### Core Skill Application Rules

Core Skill levels are cumulative. Selecting `F` applies A, B, C, D, E, and F.
Selecting `C` applies A, B, and C.

Stats with `target: "base"` are added to the `base` object before percentage
bonuses are applied. This matters for Base ATK because Drive Disc ATK% should
scale the Core Skill Base ATK addition.

Stats with `target: "panel"` are added through the existing `bonusTotals`
accumulator. For Ye Shunguang, Core Skill A/C/E add a total of:

```text
critRate = 0.048 + 0.048 + 0.048 = 0.144
```

### Calculation Output Added

The calculator response now includes:

```text
baseBreakdown
coreSkill
```

`baseBreakdown` records:

- agent base HP/ATK/DEF;
- W-Engine base contribution;
- Core Skill base contribution;
- total base values.

`coreSkill` records:

- selected level;
- applied levels;
- base additions;
- panel bonuses;
- Core Skill applied effect records.

### Applied Effects Added

Core Skill enhancement records are emitted into `appliedEffects` with keys such
as:

```text
ye_shunguang.coreSkill.A
ye_shunguang.coreSkill.B
ye_shunguang.coreSkill.C
ye_shunguang.coreSkill.D
ye_shunguang.coreSkill.E
ye_shunguang.coreSkill.F
```

The frontend renders these as Ye Shunguang Core Skill effects.

### Frontend Changes

Updated:

```text
frontend/index.html
frontend/app.js
```

Added a `核心技` select control to the role settings card.

Frontend behavior:

- If the selected agent has Core Skill data, the selector shows `未强化` plus
  each modeled enhancement level.
- The default selected level is the agent's modeled default level.
- Ye Shunguang defaults to `强化F`.
- If the selected agent has no Core Skill data, the selector shows `未建模` and
  is disabled.
- Changing the Core Skill level recalculates the panel.
- Loading an example applies that example's `coreSkillLevel` when present.
- The agent metadata strip now includes a Core Skill summary chip.

### Ye Shunguang Example Updated

Updated:

```text
examples/ye_shunguang_panel.example.json
```

The Ye Shunguang example now includes:

```json
"coreSkillLevel": "F"
```

The expected base attack changed from:

```text
1606 = 863 + 743
```

to:

```text
1681 = 863 + 743 + 75
```

The expected panel CRIT Rate changed from:

```text
36.2%
```

to:

```text
50.6%
```

The expected panel ATK changed from:

```text
3453.58
```

to:

```text
3598.33
```

The expected simple score changed from:

```text
6818.911360976
```

to:

```text
8356.378729688
```

### Documentation Updated

Updated:

```text
docs/modeling.md
docs/goal.md
```

`docs/modeling.md` now states that total Base ATK includes agent Base ATK,
W-Engine Base ATK, and Core Skill Base ATK. It also documents the Core Skill
data shape and explains that Core Skill panel bonuses are stable
out-of-combat progression.

`docs/goal.md` now marks Core Skill level modeling for out-of-combat panel
stats as done, while tracking Core Skill data for every agent as an iterative
future goal.

### Verification

Verified:

- `node --check backend/calculator.js`
- `node --check frontend/app.js`
- The Ye Shunguang example with `coreSkillLevel: "F"` returns Base ATK 1681,
  Core Skill Base ATK contribution 75, bonus CRIT Rate 45.6%, final CRIT Rate
  50.6%, final ATK 3598.33, and simple score 8356.378729688.
- The Anby example remains unchanged because Anby does not yet have modeled
  Core Skill data.

## 2026-05-27 - Fixed Core Skill Default On Agent Switching

### Request Context

The user observed that after refreshing the calculator page and selecting Ye
Shunguang again, the Core Skill level was not defaulting to the highest modeled
level. Since Ye Shunguang's Core Skill A-F contributes both Base ATK and CRIT
Rate, an accidental `none` selection makes the visible panel look wrong:

- Base ATK misses the Core Skill +75 contribution from B/D/F.
- CRIT Rate misses the Core Skill +14.4% contribution from A/C/E.
- The resulting out-of-combat panel no longer matches the intended full-Core
  default.

### Root Cause

The frontend reused the current `<select id="coreSkillSelect">` value when
rendering a newly selected agent. This is correct while the user is editing the
same agent, but wrong during an agent switch.

The problematic flow was:

1. The page loads or is currently showing a character without modeled Core Skill
   data, such as Anby.
2. That character's Core Skill select contains `none`.
3. The user changes the agent select to Ye Shunguang.
4. `renderCurrentSelection()` calls `populateCoreSkillSelect(agent,
   els.coreSkillSelect.value)`.
5. Because `none` is technically a valid option for Ye Shunguang, the function
   preserves `none` instead of using Ye Shunguang's `defaultLevel: "F"`.

This meant `none` was incorrectly treated as an explicit Ye Shunguang choice,
even though it was only inherited from the previously selected agent.

### Frontend Change

Updated:

```text
frontend/app.js
```

Added a dedicated helper:

```text
resetCoreSkillSelectToAgentDefault(agentId)
```

The helper resolves the newly selected agent and calls
`populateCoreSkillSelect()` with `coreSkillDefaultLevel(agent)`, ensuring the
select is repopulated with that agent's own default Core Skill level.

The agent change listener now performs this reset before loading the selected
agent's equipped Drive Discs and before recalculating:

```text
resetCoreSkillSelectToAgentDefault(els.agentSelect.value)
loadEquippedDriveDiscsForSelectedAgent()
await calculate()
```

### Behavior After Change

When the user switches from Anby or any no-Core-Skill-modeled agent to Ye
Shunguang:

- The Core Skill select now defaults to `强化F`.
- The next calculation sends `coreSkillLevel: "F"`.
- Ye Shunguang's Base ATK includes the Core Skill +75 contribution.
- Ye Shunguang's out-of-combat CRIT Rate includes the Core Skill +14.4%
  contribution.

The existing manual Core Skill select behavior remains intact while the user is
editing the current agent. If the user explicitly changes Ye Shunguang's Core
Skill level after selecting her, subsequent calculations use that selected
level.

### Verification

Verified:

- `node --check frontend/app.js`
- The change is scoped to the agent-switch entry point and does not alter the
  backend calculation formula.
- The full Ye Shunguang example still calculates through the same
  `coreSkillLevel: "F"` path used by the previous Core Skill modeling update.

## 2026-05-27 - Added Grouped Teammate Buff Model And Qianxia Buffs

### Request Context

The user asked for the homepage's teammate Buff model to be made explicit before
more teammate support is added. The requested shape is teammate-centered:

```text
teammate name
  -> Buff source
  -> literal Buff description
  -> structured calculation effect
```

The important modeling requirement is that one teammate name must be able to own
multiple Buff entries. The Buff entries must preserve their literal in-game text
for inspection, while also storing normalized stat effects for actual in-combat
panel calculation.

The first teammate requested was 千夏, with two Buffs:

1. Source: `核心被动`
2. Source: `强化特殊技`

Both Buffs are treated as in-combat Buffs. Duration and trigger logic are not
modeled yet; the homepage exposes them as user-selected checkboxes.

### Data Model Change

Updated:

```text
data/combat_buffs.json
```

Added a new top-level `teammates` array. It is separate from the existing flat
`buffs` array so teammate data can stay naturally grouped for maintenance and
frontend display.

The shape is:

```json
{
  "teammates": [
    {
      "id": "qianxia",
      "name": {
        "zhCN": "千夏",
        "en": "Qianxia"
      },
      "buffs": [
        {
          "id": "qianxia.core_passive.angelic_chord_atk_flat_1050",
          "source": {
            "zhCN": "核心被动",
            "en": "Core Passive"
          },
          "description": {
            "zhCN": "literal display text"
          },
          "scope": "inCombat",
          "stats": [
            {
              "stat": "atkFlat",
              "value": 1050,
              "mode": "flat"
            }
          ]
        }
      ]
    }
  ]
}
```

This gives each teammate a stable id, localized name, and a list of Buff
entries. Each Buff entry has:

- `id`: stable calculation id used in `activeBuffIds`;
- `source`: where the Buff comes from, such as `核心被动`, `影画1`,
  `额外能力`, or `强化特殊技`;
- `description`: literal text for UI inspection;
- `scope`: currently `inCombat`;
- `stats`: normalized calculation payload.

### Qianxia Data Added

Added teammate:

```text
千夏 / qianxia
```

Added Buff 1:

```text
id: qianxia.core_passive.angelic_chord_atk_flat_1050
source: 核心被动
description:
  处于「天使协律」状态下的角色的攻击力提升，提升数值等同于千夏30%初始攻击力，最高不超过1050点；当千夏的初始攻击力达到3500点时，为全队角色提供的攻击力增益效果达到最大值
stats:
  atkFlat +1050
```

Added Buff 2:

```text
id: qianxia.ex_special.ethereal_curtain_reverie_atk_flat_50
source: 强化特殊技
description:
  「以太帷幕·妄想重奏」生效期间，全队角色攻击力额外提升50点，持续40秒，千夏重复开启「以太帷幕·妄想重奏」前，将关闭已有的「以太帷幕·妄想重奏」
stats:
  atkFlat +50
```

### Backend Change

Updated:

```text
backend/calculator.js
```

Added helper:

```text
flattenTeammateCombatBuffs(teammates)
```

The backend keeps the grouped teammate structure for `/api/meta`, but flattens
each teammate Buff into the existing combat Buff calculation path. This avoids
creating a second calculation mechanism while still preserving the grouped
maintenance model.

For calculation, each teammate Buff is normalized with:

- `sourceType: "teammate"`;
- `teammateId`;
- `teammateName`;
- `sourceLabel`;
- `description`;
- `conditionLabel`, derived from description unless an explicit condition label
  is provided;
- `name`, defaulting to `队友名｜Buff来源`.

The existing in-combat request can now activate 千夏 Buffs through:

```json
{
  "combatBuffs": {
    "activeBuffIds": [
      "qianxia.core_passive.angelic_chord_atk_flat_1050",
      "qianxia.ex_special.ethereal_curtain_reverie_atk_flat_50"
    ]
  }
}
```

When both are active, the in-combat panel receives:

```text
atkFlat +1100
```

### Frontend Change

Updated:

```text
frontend/app.js
frontend/styles.css
```

The homepage teammate Buff section now renders grouped teammate Buffs through:

```text
teammateCombatBuffGroups()
renderTeammateCombatBuffGroups(...)
```

The visible structure is:

```text
千夏
  [ ] 核心被动
      literal description
      实际效果：攻击力 +1050
  [ ] 强化特殊技
      literal description
      实际效果：攻击力 +50
```

The checkbox still uses the same `data-combat-buff-id` mechanism as other
combat Buffs, so selecting either row immediately feeds its id into
`activeBuffIds` and recalculates the in-combat panel.

Added styles for:

- `.combat-team-group`;
- `.teammate-buff-row`;
- `.combat-check-description`;
- `.combat-check-stats`.

The goal was to make teammate Buffs readable without turning them into raw JSON.

### Documentation Updated

Updated:

```text
docs/modeling.md
docs/goal.md
```

`docs/modeling.md` now documents the teammate Buff group shape and explains the
backend flattening step.

`docs/goal.md` now marks the grouped teammate Buff model and the first 千夏
Buff entries as done. The in-combat panel layer is now marked as iterating
instead of merely planned, because the calculator already has a working
selection and panel-composition path, while damage and timing semantics remain
future work.

### Verification

Verified:

- `node --check backend/calculator.js`
- `node --check frontend/app.js`
- `data/combat_buffs.json` parses successfully as JSON.

The next verification step after restarting the local server is to call
`POST /api/calculate/in-combat` with both 千夏 Buff ids enabled and confirm that
the returned `inCombat.buffTotals.atkFlat` increases by `1100`.

## 2026-05-27 - Polished Buff Selection Modal And Limited Custom Buffs To One Stat

### Request Context

The user reported that the Buff selection modal opened by the `+` button looked
too rough, with the custom Buff page being especially poor. The user also asked
that custom Buff creation should no longer allow adding multiple entries inside
one modal. One modal submission should create one custom Buff only.

### UI Problems Addressed

The previous modal inherited too much from the Drive Disc modal:

- It stretched very wide across the viewport.
- The header was a plain white form header.
- The search box, tabs, and content had little visual hierarchy.
- The custom Buff pane rendered as a raw row of select + input + delete button.
- The `添加属性` button encouraged bundling several unrelated stat effects into
  one custom Buff, making later inspection harder.

### HTML Changes

Updated:

```text
frontend/index.html
```

Changed the Buff modal search label to use:

```text
combat-buff-search-field
```

This gives the search row a modal-specific layout and avoids relying only on the
generic `.field` styling.

Added a custom Buff intro block:

```text
custom-buff-intro
```

The intro states that one modal submission adds one custom Buff and that the
saved Buff will appear in the homepage `其他 Buff` list.

Removed the old custom Buff button:

```text
addCustomBuffStatBtn
```

Removed visible text:

```text
添加属性
```

Renamed the save action text from:

```text
保存自定义 Buff
```

to:

```text
保存并添加
```

This better matches the action: the Buff is saved and immediately added to the
current in-combat panel configuration.

### Frontend Logic Changes

Updated:

```text
frontend/app.js
```

Removed `addCustomBuffStatBtn` from the element lookup table and removed its
event listener.

Removed the custom stat row delete handler. Since there is now only one custom
stat row, deleting rows is no longer part of the interaction.

Changed:

```text
renderCustomBuffStatRows(...)
```

The function now renders exactly one custom stat editor:

- one stat select;
- one numeric value input;
- no remove button;
- no dynamic row append.

The rendered row uses real `.field` labels for `属性` and `数值`, so the layout
looks consistent with the rest of the application.

Changed custom Buff sanitization:

```text
sanitizeAddedCombatBuffs(...)
```

When loading saved custom Buffs, the code now keeps only the first valid stat:

```text
stats: stats.slice(0, 1)
```

This ensures older multi-stat custom Buff records do not keep behaving like
multi-effect custom Buffs after the UI has moved to a one-stat model.

### Styling Changes

Updated:

```text
frontend/styles.css
```

The Buff modal is now styled through:

```text
.disc-modal.combat-buff-modal
```

The selector intentionally has higher specificity than the generic
`.disc-modal` rule, so the modal no longer expands to the Drive Disc modal's
wide layout.

Changed modal width to:

```text
min(920px, calc(100vw - 32px))
```

The modal now has:

- a dark ZZZ-like header;
- a yellow bottom accent line;
- a card-like white/soft-gray body;
- a segmented tab control;
- more deliberate candidate Buff cards;
- a polished custom Buff panel;
- a compact single-row custom stat editor.

Added or updated styles for:

```text
.combat-buff-search-field
.combat-buff-tabs
.combat-buff-candidate-list
.combat-candidate-row
.combat-custom-pane
.custom-buff-intro
.custom-buff-stat-row
```

### Behavior After Change

Opening the Buff modal with `+` now shows a narrower, more focused modal.

Switching to `自定义` now shows:

```text
自定义 Buff
名称
属性
数值
保存并添加
```

There is no `添加属性` button. There are no per-row delete buttons. Saving can
only create a custom Buff with one normalized stat effect.

### Documentation Updated

Updated:

```text
docs/modeling.md
docs/goal.md
docs/changelog.md
```

`docs/modeling.md` now documents that homepage custom Buffs are one-Buff,
one-stat manual corrections converted into `combatBuffs.manualStats`.

`docs/goal.md` now marks Buff modal polishing and single-stat custom Buff input
as done.

### Verification

Verified:

- `node --check frontend/app.js`
- Search confirmed that `addCustomBuffStatBtn`, `data-remove-custom-stat`, and
  visible `添加属性` are no longer present in the active frontend files.
- Loaded `http://localhost:8787/` in headless Edge, clicked the homepage `+`
  Buff button, switched to `自定义`, and inspected the live DOM.
- Saved a live custom Buff named `测试攻击 Buff` with `固定攻击力 = 123` and
  confirmed the homepage stored exactly one normalized stat object:
  `atkFlat +123`.

Live DOM verification returned:

```json
{
  "modalHidden": false,
  "modalWidth": 920,
  "addButtonExists": false,
  "customRowCount": 1,
  "customSelectCount": 1,
  "customValueCount": 1,
  "removeButtonCount": 0
}
```

A screenshot was inspected locally to confirm the custom Buff panel has no
obvious text overlap or raw row controls. The temporary screenshot file was
deleted after verification.
