# Scanner 1.0.43 / Helper 1.3.1 Integration Evidence

This document records candidate evidence only. It does not authorize a public
release, a public manifest change, or a server deployment.

## Source Revisions

- Scanner integration commit: `38f38a228f03d060644ea7ba4287e71c7857705f`
- Calculator candidate-manifest commit: `4d1a469c6e98b78067fdbc76e7371c11865c32bf`
- Scanner version: `1.0.43`
- Helper version: `1.3.1`
- Helper protocol: `4`

The Drive Disc reservation and visual-loadout work is isolated on
`codex/drive-disc-reservations-ui` and is not part of the scanner integration
diff.

## Windows Candidate Runs

The final reproducibility pair used identical inputs and the same Scanner commit:

- Actions run `29861463758`
- Actions run `29861470116`

Both runs completed successfully. The Scanner ZIPs, Scanner manifest, Helper
EXE, and Helper manifest are byte-for-byte identical across the pair. An
intermediate pair, `29860366007` and `29860372528`, proved that .NET was
embedding the current Scanner repository SHA into the otherwise unchanged
Helper. Commit `38f38a2` freezes the immutable Helper 1.3.1 SourceRevisionId;
the final pair reproduces the previously accepted Helper bytes exactly.

| Artifact | Size | SHA-256 |
| --- | ---: | --- |
| `ZZZ-Scanner.Next-win-x64-fdd.zip` | 21,804,074 | `a8ad3c7f914e843b2763de92c40ba981e6e29431ca6c483ad7177ab9d93b5633` |
| `ZZZ-Scanner.Next-win-x64-self-contained.zip` | 84,822,882 | `03270b1e14c55980a37ee9ad2aad0f4b84a65f0ec5c59e22706c8be3ae18c531` |
| `ZZZ-Scanner-Helper.exe` | 8,267,264 | `01f1b5abbe30ecae7668d6339f82eebe8d1c6f91a6dbbbaa8bba5582948ddd0d` |
| `scanner-manifest-1.0.43.json` | 61,028 | `b7abda3fdf41910402394f0ea61b1ef17b87d9d7115adbd3a254e9b8e810cbf5` |
| `helper-manifest.json` | 477 | `a0d6805f799e68c4c5d8e264d1574aef59451fa40d5a87aacab3e8968c085bc9` |

Calculator `config/` contains the exact two manifest files from run
`29861463758`. Candidate ZIPs remain under the ignored local `downloads/`
directory and are not committed.

The production Pages candidate contains 162 files and 129,553,965 bytes. Its
tree SHA-256 is
`2b8def8a0553b04069142ff304999f054119125a71cb91a8aeb888a47a8f81d2`.
The emitted Scanner and Helper manifests are byte-for-byte identical to their
source files and retain the manifest hashes listed above.

## Release Gates

- Scanner/Helper native regression: `49/49`, failures `0`.
- Scanner Release build: warnings `0`, errors `0`.
- Helper Release build: warnings `0`, errors `0`.
- VC Runtime source: `vc-redist-layout`.
- VC Runtime selected and lowest file version: `14.44.35211.0`.
- The publish script verifies that FDD and self-contained packages receive the
  same eight app-local VC Redistributable files. The self-contained runtime also
  carries its expected `vcruntime140_cor3.dll` alias.
- FDD OCR runtime smoke: `ok=true`.
- Self-contained OCR runtime smoke: `ok=true`.
- Scanner file version: `1.0.43.0`.
- OCR model SHA-256:
  `70ca955eba4729651da42e7cbcc69aaf41a601939ee5ffaa7a90efdfcd13db6d`.
- Six OCR ROI texts are identical. FDD and self-contained confidence values are
  identical within each run; the maximum cross-run delta is below `0.000001`.
- PE dependency closure, package limits, expanded-file sizes, model hashes, and
  per-file hashes passed in both Actions runs.
- Calculator complete test suite: 30 test files and 320 tests passed.
- After importing the final Actions manifest, repository-integrity and Scanner
  Bridge tests passed; the production Pages candidate rebuilt successfully.
- Playwright Helper-upgrade and Scanner-feedback scenarios passed in both
  Chrome and Edge.

## Helper 1.2.1 Upgrade Evidence

The public, unmodified Helper 1.2.1 fixture was downloaded from the existing
release and verified before use:

- Size: `8,137,728`
- SHA-256: `d3c88f1f7556e9bab15f7129e253d2c5527b0f5009a84d52a7a0acd354f326ae`

Automated coverage verifies pending receipt round-trip, wrong-transaction
rejection, idempotent confirmation, pre-replacement recovery, post-replacement
rollback, confirmed cleanup, Calculator diagnostics-before-confirmation, no
Scanner prepare before commit, confirmation failure, one update request, and
automatic continuation after reconnect. The managed replacement is atomic:
the candidate is fully copied and SHA-256 checked as `.next` before one
`File.Replace` operation creates `.previous`.

The updater supervises the new Helper for 90 seconds. Exit, bind failure,
health/token/WebSocket/version/protocol rejection, or absent browser confirmation
therefore ends in either the confirmed 1.3.1 state or restoration of 1.2.1.
Helper downloads use ordered mirrors, three bounded attempts per source, Range
resume, size validation, and SHA-256 validation. No replacement starts before a
complete verified candidate exists.

The final candidate was also exercised end to end with the verified public
1.2.1 binary as the managed old Helper and a loopback-only candidate source.
The Calculator page initiated the update, reconnected, ran diagnostics,
confirmed the transaction, prepared Scanner 1.0.43, and returned to an enabled
scan action in 49.1 seconds without a refresh or a second click. Final health
reported Helper `1.3.1`, protocol `4`, and Scanner `1.0.43`. Exactly one managed
Helper remained; `.previous`, `.next`, the pending receipt, and the one-shot
preservation marker were absent.

The same real-binary run seeded an inactive runtime and three output sessions
before upgrading. Their files and SHA-256 values, plus the log-file count,
remained unchanged after Scanner 1.0.43 became ready. This validates the
post-update one-shot storage-preservation path; ordinary later storage cleanup
remains available.

## Local Hardware Acceptance (2026-07-22)

The available local host was exercised without changing any public manifest or
server state:

- Windows 10 Home China `10.0.19045` x64.
- NVIDIA GeForce RTX 3060, driver `32.0.15.8108`.
- Local client, `1920x1080`, DPI `120` (125% scaling), neutral color transform.
- .NET Windows Desktop Runtime `8.0.22` present.
- FDD Scanner package, DXGI requested and active, strict exact visual profile
  `local-1920x1080-current`.
- Warehouse header and count detected as `752/3000` with a 97-point header
  score; capture, grid, and layout preflight scores were 100.

| Path | Result | Evidence |
| --- | --- | --- |
| Scanner CLI 1-item preflight | Passed | `1/1`, failures 0, 12/12 ROI, Scanner `1.0.43.0` |
| Scanner CLI 30-item fast DXGI | Passed | `30/30`, failures 0, duplicates 0, 12/12 ROI, slot safety pass |
| Scanner CLI 120-item fast DXGI | Passed | `120/120`, failures 0, duplicates 0, 12/12 ROI, slot safety pass, 3.152 items/s |
| Helper v4 30-item stream | Passed | 30 `scan_item`, terminal 30/30/0, duplicates 0, first item correct, 12.972 s |
| Helper v4 120-item stream, run 1 | Passed | 120 `scan_item`, terminal 120/120/0, duplicates 0, first item correct, 34.982 s |
| Helper v4 120-item stream, run 2 | Passed | 120 `scan_item`, terminal 120/120/0, duplicates 0, first item correct, 36.235 s |
| Helper v4 effective full scan | Passed with explicit duplicate waiver | 466 imported; item 467 was `S 12/15`; `partial=true`, `non_level_15_stop`, failures 0, 122.454 s. Benchmark found equal consecutive pairs 337/338 and 404/405; the user explicitly accepted these as plausible real duplicates for this candidate. |
| Calculator partial normalization | Passed | All 466 partial items normalized, warnings 0, `removeMissing=false` |
| Process/crash audit | Passed for controlled scans | One Helper after teardown, no residual Scanner, no Scanner AccessViolation/`0xC0000005`, and no new Scanner crash dump. An operator-started Benchmark against the still-open CLI 120 log produced one expected file-lock IOException event; it was not a scan-process failure. |

The stale-first-item defect is fixed. Every successful run records
`FIRST_CELL_BASELINE_CAPTURED`, `FIRST_CELL_REFRESH_REQUIRED`, and
`FIRST_CELL_REFRESH_READY`; the first accepted `CELL_TIMING` has a positive
panel change after the neighbor round trip. The exported first item is the
known real slot-1 item and is no longer equal to item 10 in any final run.

`SCAN_TERMINAL` now records counters after OCR queue drain. Benchmark prioritizes
that event, reads `export.partial.json`, preserves `partial=true`, and reports
`non_level_15_stop` as an effective full-scan completion. It still reports the
two waived duplicate groups as `no_export_duplicates=fail`; the evidence was
not altered to hide the accepted risk.

## Test Matrix Status

| Gate | Status | Evidence |
| --- | --- | --- |
| Public 1.2.1 to final 1.3.1 to Scanner 1.0.43 | Passed | Real Chromium flow, 49.1 seconds |
| Transaction confirmation and idempotency | Passed | Native regression |
| Interrupted before atomic replacement | Passed | Old target retained |
| Interrupted after atomic replacement | Passed | `.previous` restored |
| Interrupted after confirmation | Passed | Candidate retained, backup removed |
| Browser diagnostics and commit ordering | Passed | Vitest plus Chrome and Edge Playwright protocol simulation |
| Existing runtime, outputs, and logs | Passed | Real-binary sentinel hashes/counts unchanged |
| Partial result safe import | Passed | Vitest |
| Public 1.2.1 binary identity | Passed | Fixed size and SHA-256 above |
| Win10/11, DPI/HDR, local/cloud hardware matrix | Partial | Win10 local 1080p at 125% completed; Win11, HDR, 4K, and cloud remain external |
| Primary-host effective full scan | Passed with waiver | 466 items completed before the real item 467 non-level-15 stop; two consecutive equal-property pairs accepted by explicit user decision |
| 30-item local scan | Passed | CLI and Helper v4 stream both passed with correct first item |
| 120-item local scan | Passed | CLI and two consecutive Helper v4 runs passed with no duplicates |

Win11, HDR, 4K, cloud-client, and a 740-item inventory state remain deferred to
post-publication coverage because they are unavailable on this host. The two
equal-property full-scan pairs are an explicitly accepted candidate risk. This
document still does not create or authorize a tag, GitHub Release, public
manifest change, public download, or server deployment.
