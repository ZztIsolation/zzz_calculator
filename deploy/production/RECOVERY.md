# Recover a frozen production candidate without restarting the live service

Keep `PRODUCTION_CD_ENABLED=false` throughout diagnosis and control-plane
installation. This switch prevents new promotion; it does not stop Calculator.
Do not rerun an old production job: reruns retain their original workflow code
and therefore do not pick up new timeouts. Keep the existing `deploy` ref frozen.

The October 2 failure does not prove a sandbox hang. On attempt 3 the remote
step began at 17:10:51 UTC, the first manager preflight message arrived at
17:30:43, and the capability probe passed at 17:30:44. The job was cancelled
15 seconds later. Transfer, connection and early preflight were not separately
timed in that workflow. The new checkpoints distinguish those stages.

## Audit before recovery

After the reviewed change is merged and its exact main CI succeeds, dispatch
`Audit deploy baseline` from `main` with `mode=audit`. This uses the protected
production environment while retaining the existing deploy ref. An audit SSH
session has a **60-second total runner budget** (55 seconds plus 5 seconds to
terminate). There is no automatic retry. A timeout, unavailable lock, or missing
evidence is a failed audit, never proof that production is unchanged.

On a host with the updated manager, audit logs contain only fixed diagnostic
metadata: installed deployment file hashes, service PID/start time/restart
counter, manager version/system state/jobs, validation units, deployment lock
identity/holder, transient upload/processing/validation entries, disk bytes and
inodes, memory and a short I/O sample. The existing JSON evidence additionally
verifies current/previous/last release, migration marker, tree hashes, Nginx and
download manifest invariants. Credentials, process arguments and candidate
application logs are not collected.

The old manager can still be audited. `dry-run`, `deploy` and rollback callers
require a successful audit from `supervisor=bounded-v1` before uploading or
changing anything. A legacy manager therefore fails closed with an installation
instruction. No unrestricted SSH shell, timeout command or new sudo grant is
introduced.

## Install only the deployment control plane

Main CI publishes `deployment-control-plane-<full-main-sha>` with a tarball and
an SHA-256 file. Download both through the existing administrator channel and
compare the tarball hash with the reviewed CI artifact. Extract into a **new,
root-only directory**, check `SOURCE_COMMIT` against the reviewed main SHA, and
run `sha256sum --check SHA256SUMS` there. Do not extract over live release files.

Use an already-authorized server administrator session. The restricted CI SSH
key intentionally cannot install the root control plane. If no administrator
session is available, stop with the ready artifact; do not broaden the key or
sudoers policy to work around that boundary.

Before installing, verify that no deployment process owns the deployment lock
or incoming-directory lock. If either is busy, record its PID and start time
and wait for its bounded operation; **never delete the lock file**. `flock` is
released by the kernel when its last holder exits. A stale pathname alone is
not a stale lock.

Run the existing transactional `bootstrap-zzz-calculator-deploy.sh` from this
verified directory as root, with the existing dedicated **public** key in
`ZZZDEPLOY_PUBLIC_KEY`; obtain it on the server through the established key
configuration without logging or copying the private key. Unset the public-key
variable after bootstrap. Do not edit the application service, Nginx, `current`,
release state or download origin. Check installed manager/worker/gateway/sudoers
hashes against the bundle after bootstrap and compare the live service PID,
start timestamp, NRestarts, current commit and both download manifests with the
before snapshot. A bootstrap failure uses its existing transactional rollback.

Only orphan resources positively attributed to a finished failed run may be
cleaned: record the exact unit/path, ownership, PID/start time and cgroup first;
verify neither a deployment nor the application references them. Prefer the
manager's existing per-operation cleanup. Do not stop units by wildcard,
remove all `job.*` directories, delete managed releases or remove a live lock.
Uncertain ownership or a service/systemd/host restart requirement stops recovery
for administrator review. No new general-purpose cleanup command is exposed.

## Validate and resume

1. Repeat the bounded audit from `main` and require complete successful
   before/after evidence, not just a public HTTP 200.
2. Dispatch the same baseline workflow with `mode=dry-run`. It tests the frozen
   deploy SHA using its retained successful main CI artifact. Require
   `current,candidate,rollback,candidate`, `switchState=not-switched`, clean
   validation cleanup, unchanged service PID/start time/NRestarts, current
   target, state tuple, Nginx and Helper/Scanner manifest hashes.
3. The hardening change creates a **new** main SHA and a new immutable artifact.
   After the operator permits the normal release restart, restore the CD gate
   and use owner-dispatched `Promote deploy` for that tested main SHA with
   `confirm_production=true`. Do not reuse the old run for a new SHA. Promote
   fast-forwards deploy with `force:false` and repeats the full validation.
4. Require committed server evidence and public route, app-config, health,
   index hash, old/new assets and both manifest checks. `/.deployed-commit`
   publicly serves SPA fallback on this host and is not commit evidence.

The existing deployment mechanism atomically selects a release and then
**restarts Calculator**; `NRestarts=0` does not mean no explicit restart occurred.
With a no-restart requirement, stop after the audit and dry-run. Zero downtime
would require a separately reviewed multi-instance rollout, not an assertion
that this single-service restart has no impact.

## Fixed deadline contract

| Phase | Runner limit including kill grace | Server deadline and cleanup grace |
| --- | --- | --- |
| Audit / control-plane audit | 60 s | 30 s + 15 s |
| Archive upload | 305 s | Existing bounded incoming upload policy |
| Evidence upload | 35 s | Existing bounded incoming upload policy |
| Dry-run | 755 s | 600 s + 120 s |
| Deploy | 815 s | 600 s + 180 s |
| Rollback / restore | 335 s | 180 s + 120 s |

SSH uses a 10-second connect timeout, one connection attempt and 15-second
keepalives with a limit of three misses. An exit 255 leaves remote completion
unknown; audit before another attempt. A deadline never justifies retrying an
unconfirmed switch or toggling rollback blindly. The 30-minute job cap reserves
time for bounded cleanup, public verification, recovery and evidence upload.

The root manager supervises a private process group using server-side GNU
`timeout`. TERM reaches its existing signal/EXIT handlers and allows the listed
cleanup/rollback grace before KILL. If that grace is exhausted, evidence may be
incomplete and manual audit is required. `systemd-run --no-block` submission is
limited to 10 s plus 2 s kill grace; systemd queries to 5 s plus 2 s; validation
stop to 10 s plus 2 s; transient directory removal to 15 s plus 2 s. A failed
stop retains the unit and private tree for inspection. All sandbox restrictions
and the four-stage gate remain mandatory.
