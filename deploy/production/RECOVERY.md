# Recover a frozen production candidate without restarting the live service

Status: current bounded recovery guide. Checked 2026-10-08 against commit `6355fbd310cc5836aff0e78bc3fb46e68a5356f8`. Keep `PRODUCTION_CD_ENABLED=false` during diagnosis and control-plane installation; this gate prevents promotion, not Calculator service execution. Do not rerun an old production job just to obtain new workflow code.

Use [the release runbook](../../docs/production-deployment-runbook.md) for normal promotion and [the manager contract](README.md) for command deadlines and evidence. The 2026-10-02 incident narrative is preserved in [the archive](../../docs/archive/deploy-recovery-2026-10-02.md).

## 1. Identify the state

Classify the report before touching production:

- **Candidate not switched**: promotion eligibility, artifact download, upload or validation failed before `current` changed.
- **Candidate frozen, transaction timed out**: the runner stopped waiting; this is not proof that the manager or public release stopped.
- **Control plane mismatch**: installed manager/worker/gateway/sudoers hashes or account contract differ from the reviewed bundle.
- **Switched but public check failed**: manager must have automatic rollback evidence; confirm current, previous and last release state.
- **Artifact or SHA mismatch**: stop; never substitute a later main commit, a rebuilt local package or a different evidence file.

Preserve run IDs, candidate SHA, CI run, artifact name, promotion run, timestamps and the last evidence summary. Do not paste credentials or candidate stdout into chat or the repository.

## 2. Bounded audit

After the reviewed fix is merged and its exact main CI succeeds, dispatch `Audit deploy baseline` from `main` with `mode=audit`. This is read-only and retains the current `deploy` ref. The audit has a 60-second total runner budget (55 seconds plus 5 seconds termination). A timeout, unavailable lock or missing evidence is a failed audit, never evidence that production is unchanged.

The audit may collect fixed diagnostic metadata: installed control-plane hashes, service PID/start time/restart counter, manager/systemd state, validation units, lock identity, transient upload/validation entries, disk/memory/I/O summary, release tree hashes, Nginx and manifest invariants. It must not collect credentials, process arguments, candidate-controlled logs, screenshots or complete user data.

If the manager is old, the audit should report the installation boundary. Do not remove arguments, disable the sandbox or retry with guessed systemd properties to get past a capability failure.

## 3. Install only the control plane

When the reviewed control-plane bundle is ready, install it through the root bootstrap described in [README.md](README.md#one-time-initialization-and-upgrades). Keep the application service, Nginx, `current`, release state and download origin untouched. Verify installed hashes, account/group/shell/mode/ownership contracts, gateway restrictions and the service PID/restart counter afterward.

A control-plane installation is complete only when the static validator, shell syntax checks, SSH gateway tests, systemd profile tests and installed file hashes agree. It does not make a candidate eligible and does not restart Calculator.

## 4. Resume a frozen candidate

Only after audit/control-plane checks pass, dispatch `Resume deploy` with the exact:

- `candidate_sha` currently pointed to by `deploy`;
- successful `ci_run_id` that owns the immutable artifact;
- original owner-dispatched `promotion_run_id`;
- `confirm_production=true`.

The workflow must recheck owner/triggering actor, original promotion run, frozen SHA, `deploy` ancestry/current SHA, CI/artifact availability, workflow ref and ruleset before production access. If any value changed, stop and create a new reviewed candidate. Do not use `main` HEAD as a substitute.

## 5. Rollback

If the transaction has a committed switch and manager evidence indicates public validation failure, first confirm automatic rollback status and the actual `current` target. If manual rollback is required, the repository owner dispatches `Rollback production` with `confirm=true`; it uses the server-recorded previous release and serializes with the production lock.

After rollback, check `/`, `/api/health`, `/api/catalog`, `.deployed-commit`, service active state, `NRestarts`, Nginx and manifest invariants. Keep new/old release directories, artifacts and evidence for the retention period. Do not delete browser IndexedDB/localStorage, maintenance history or user drafts to make an old release pass.

## 6. Stop conditions

Stop and report when any of these occurs: candidate SHA is not an ancestor of main; `deploy` moved; artifact/evidence hash is missing or mismatched; owner/triggering actor is not authorized; lock cannot be acquired; sandbox profile is unsupported; current release or state files changed unexpectedly; automatic rollback failed; health or static asset checks remain red; or evidence cannot be committed atomically.

The correct next action is a new controlled investigation or a new exact-SHA candidate, not a force push, direct SSH edit, longer unbounded wait or silent retry.
