# Calculator production deploy manager

This document describes the installed deployment control plane. It is not the normal release checklist; use [the repository release runbook](../../docs/production-deployment-runbook.md) for candidate freezing, CI/artifact checks and owner-dispatched promotion. Use [RECOVERY.md](RECOVERY.md) for bounded recovery. Current-source check: 2026-10-08, commit `6355fbd310cc5836aff0e78bc3fb46e68a5356f8`.

## Control-plane responsibilities

The manager is separate from the Calculator service, Nginx, download origin and `current` symlink. It owns the locked deployment transaction, candidate validation, sandbox execution, evidence and bounded automatic rollback. It must not expose a shell, run arbitrary candidate commands or accept credentials in application logs.

The dedicated `zzzdeploy` account uses a root-owned forced-command SSH gateway. The gateway accepts only the documented manager actions and bounded uploads under the allow-listed incoming directory. Candidate application validation runs as the separate locked `zzzvalidate` account. The installer and sudoers policy are part of the same reviewed control-plane bundle.

## One-time initialization and upgrades

Run the bootstrap as root on the production host only when the control plane is being installed or upgraded. Keep the public key out of the repository and unset it after the command:

```sh
export ZZZDEPLOY_PUBLIC_KEY='ssh-ed25519 AAAA...'
./bootstrap-zzz-calculator-deploy.sh
unset ZZZDEPLOY_PUBLIC_KEY
```

The bootstrap validates account/group identity, locked-password state, shells, ownership, modes, SSH gateway, manager, validation worker, sudoers, required commands and host compatibility before mutation. It installs files transactionally and restores prior inodes/metadata on failure. Re-run it from the pinned reviewed `main` commit that produced the control-plane bundle, then compare installed file hashes.

It may update only dedicated deployment accounts, gateway, manager, validation worker, sudoers and their managed directories. It must leave Calculator `current`, release contents, Nginx, systemd service and download manifests unchanged. A control-plane upgrade is not an application release and does not imply service restart.

## Manager command contract

The installed manager is invoked through the forced gateway or the protected production workflow:

```text
zzz-calculator-deploy audit
zzz-calculator-deploy dry-run [--artifact <incoming-part>] [--evidence <incoming-part>] [--expected-sha <sha256>] [--expected-commit <40-char-sha>]
zzz-calculator-deploy deploy  [--artifact <incoming-part>] [--evidence <incoming-part>] --expected-sha <sha256> --expected-commit <40-char-sha>
zzz-calculator-deploy rollback --previous
```

Artifacts resolve only below `/var/lib/zzz-calculator-deploy/incoming` and must match the expected SHA. `deploy` requires both artifact and evidence, an exact 40-character candidate commit, the frozen `deploy` ref check from the caller, and the protected production environment. `audit` is read-only; `dry-run` validates and isolates a candidate without changing the public current release; `deploy` performs the one approved atomic switch; `rollback --previous` uses the server-recorded previous release.

The manager applies bounded server deadlines: audit 30 seconds plus 15 seconds cleanup, dry-run 600 plus 120, deploy 600 plus 180, rollback 180 plus 120. Timeout is failure; it never proves that the previous state is unchanged. The supervisor owns the process group and terminates child processes before evidence handling.

## Invariants and evidence

Every operation serializes on `/run/lock/zzz-calculator-deploy.lock`. It snapshots state files, release trees, service identity, Nginx, manifests and migration marker before work; validates candidate/current/rollback in the isolated unit; and writes a schema-checked evidence record atomically. Evidence records action, candidate/artifact hashes, deployed commit, release paths, switch state, validation sequence, service and manifest results, and rollback state. It must not include credentials, process environments, arbitrary candidate output or full user data.

A successful deploy evidence must show validation sequence `current,candidate,rollback,candidate`, a committed switch, exact candidate `.deployed-commit`, healthy service and generated `rollback-<short-sha>` release. A successful audit has no deploy switch; a successful dry-run uses a validation rollback and leaves public current unchanged. Automatic rollback is mandatory when a switched transaction fails its final invariant or public health gate.

The manager must preserve the browser origin and local data contract: production remains `https://zzzcaculator.top`, no server-side inventory import is introduced, and deployment never changes IndexedDB/localStorage names, stores or record keys.

## Host and security boundary

The manager accepts only supported systemd versions after parsing both client and PID1 versions; it selects the fixed v239/v242/v248 sandbox profile and does not retry unknown properties on an older host. Candidate code runs in the validation sandbox with a read-only deployment root, bounded tmpfs and no access to production secrets. The forced gateway disables PTY, agent/X11/port forwarding and arbitrary shell execution.

The production service, Nginx, download origin and release directories are inspected by the manager but are not templates for blind overwrite. Preserveon-site copies and apply only explicitly reviewed control-plane changes. Never put private keys, passwords, cookies or Basic Auth values in this document, commands, evidence or logs.

## Workflow ownership

- `.github/workflows/ci.yml`: integration and immutable artifact; never writes `deploy` or production.
- `.github/workflows/promote-deploy.yml`: owner-only frozen-SHA promotion and non-forced `deploy` update.
- `.github/workflows/deploy-production.yml`: reusable candidate validation and protected production transaction; manual dispatch is audit/dry-run only.
- `.github/workflows/resume-deploy.yml`: retries the original frozen promotion after rechecking SHA/CI/artifact.
- `.github/workflows/rollback-production.yml`: owner-only previous-release rollback.
- `.github/workflows/audit-deploy-baseline.yml`: read-only baseline/audit while the production enable gate is disabled.

Validate the workflow/control-plane contract with `node scripts/validate-deployment-config.js`; it performs static checks and does not contact production or deploy.
