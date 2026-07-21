# Scanner 1.0.43 / Helper 1.3.1 Integration Evidence

This document records candidate evidence only. It does not authorize a public
release, a public manifest change, or a server deployment.

## Source Revisions

- Scanner integration commit: `7f88ad9c0e8fbcf4baf0f9f39d51af4fa85b13f1`
- Calculator scanner integration commit: `8a15944a2f2d5d356ffbeb4b6a9e85f0c7cc054f`
- Scanner version: `1.0.43`
- Helper version: `1.3.1`
- Helper protocol: `4`

The Drive Disc reservation and visual-loadout work is isolated on
`codex/drive-disc-reservations-ui` and is not part of the scanner integration
diff.

## Windows Candidate Runs

The final reproducibility pair used identical inputs and the same Scanner commit:

- Actions run `29835767610`
- Actions run `29835771740`

Both runs completed successfully. An earlier pair, `29827065933` and
`29827068841`, exposed NativeAOT PE timestamps in the Helper output. Commit
`4cf8f4e` normalized the COFF and debug-directory timestamps. Runs `29830478094`
and `29830481303` proved that correction before the storage-preservation fix;
the final pair above includes both fixes and is byte-for-byte reproducible.

| Artifact | Size | SHA-256 |
| --- | ---: | --- |
| `ZZZ-Scanner.Next-win-x64-fdd.zip` | 21,801,889 | `d2f6ebe3138c763fb5895955a39099cf9a74e92833f489ee56b95e2563d1f038` |
| `ZZZ-Scanner.Next-win-x64-self-contained.zip` | 84,820,697 | `f7918eae3c934af94d0a5bcf14605e8d0b83300ae7a879fa3d25a20122cd2244` |
| `ZZZ-Scanner-Helper.exe` | 8,267,264 | `01f1b5abbe30ecae7668d6339f82eebe8d1c6f91a6dbbbaa8bba5582948ddd0d` |
| `scanner-manifest-1.0.43.json` | 61,028 | `70af703223fabdcbf47c7eef5b7badda1b03b525e761f0a83ba6cd2c28a3b55c` |
| `helper-manifest.json` | 477 | `a0d6805f799e68c4c5d8e264d1574aef59451fa40d5a87aacab3e8968c085bc9` |

Calculator `config/` contains the exact two manifest files from run
`29835767610`. Candidate ZIPs remain under the ignored local `downloads/`
directory and are not committed.

The production Pages candidate contains 162 files and 129,549,595 bytes. Its
tree SHA-256 is
`2728027c3d4905179d756a73db120da73a7d97a3b450fdc49697800fd609ead7`.
The emitted Scanner and Helper manifests are byte-for-byte identical to their
source files and retain the manifest hashes listed above.

## Release Gates

- Scanner/Helper native regression: `47/47`, failures `0`.
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
- Six OCR ROI texts are identical; maximum confidence delta is `0.0`.
- PE dependency closure, package limits, expanded-file sizes, model hashes, and
  per-file hashes passed in both Actions runs.

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

## Test Matrix Status

| Gate | Status | Evidence |
| --- | --- | --- |
| Public 1.2.1 to final 1.3.1 to Scanner 1.0.43 | Passed | Real Chromium flow, 49.1 seconds |
| Transaction confirmation and idempotency | Passed | Native regression |
| Interrupted before atomic replacement | Passed | Old target retained |
| Interrupted after atomic replacement | Passed | `.previous` restored |
| Interrupted after confirmation | Passed | Candidate retained, backup removed |
| Browser diagnostics and commit ordering | Passed | Vitest and Playwright protocol simulation |
| Existing runtime, outputs, and logs | Passed | Real-binary sentinel hashes/counts unchanged |
| Partial result safe import | Passed | Vitest |
| Public 1.2.1 binary identity | Passed | Fixed size and SHA-256 above |
| Win10/11, DPI/HDR, local/cloud hardware matrix | Pending external execution | Must be recorded before release |
| 740-item primary-host scan and 30/120-item secondary scans | Pending external execution | Must be recorded before release |

The two pending hardware rows are release blockers. They do not block retaining
or pushing these candidate integration branches, but they prohibit creating a
tag, GitHub Release, public download, public manifest, or deployment.
