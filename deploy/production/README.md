# Calculator production deploy manager

This directory contains the one-time server initializer and the root-owned
deployment program used by the Calculator CD workflow. It is deliberately
separate from the application service, Nginx configuration, Helper/Scanner
download origin, and the `current` symlink.

## One-time initialization

Run the bootstrap as `root` on the production host. Every run needs the public
half of the dedicated CI deploy key in `ZZZDEPLOY_PUBLIC_KEY`; the key
is written only to the server's `zzzdeploy` account and is never part of the
repository:

```sh
export ZZZDEPLOY_PUBLIC_KEY='ssh-ed25519 AAAA...'
./bootstrap-zzz-calculator-deploy.sh
unset ZZZDEPLOY_PUBLIC_KEY
```

The initializer creates a password-locked `zzzdeploy` account and installs a
root-owned forced-command SSH gateway. The dedicated key disables PTY,
agent/X11/port forwarding and cannot open a shell or invoke arbitrary SCP:
the gateway accepts only exact deployment-manager commands and bounded legacy
SCP uploads to allow-listed `.part` names in the fixed `incoming` directory.
The CD workflow therefore uses `scp -O`. The initializer also creates a
separate password-locked `zzzvalidate` account with
`/usr/sbin/nologin`, no supplementary groups, no home directory and no SSH
configuration. Candidate code can run only as that second account.

An existing deployment or validation account is accepted only when its
account/group, UID/GID, home, shell, supplementary groups and locked-password
state match the complete contract. A mismatch stops before mutation. The SSH
directory, deployment manager (mode `0755`), validation worker and SSH gateway
(mode `0555`) and sudoers policy are installed as one locked transaction; a
late failure restores every prior inode and file. An exact rerun preserves
installed inodes. A clean failed first install removes newly created
accounts/groups, empty managed directories and its new lock file when safe.

Before any account or managed-path mutation, the initializer validates the SSH
key, aggregate and candidate sudo policy, both deployment shell programs, GNU
tar/cp, `/usr/bin/node`, `/usr/bin/timeout`, systemd tooling, `jq`, `sudo` and
every other external command used by the manager or worker. It replaces
`authorized_keys` with a new root-owned inode and installs the root-owned
manager, validation worker and forced-command gateway. Existing shared `/run/lock`,
`/opt/zzz_calculator/releases` and `/usr/local/libexec` metadata is verified
and left unchanged. A legacy `/opt/zzz_calculator` parent owned by
`zzzcalc:zzzcalc` with mode `0755` is hardened to `root:root` inside the same
rollback transaction; a later failure restores its original owner and mode.
The deployment account's Bash startup files are replaced with empty root-owned
files in that transaction so no account-controlled command can run before the
forced SSH gateway. The directory inode, `current`, release contents, Nginx,
the production service and its restart counter are not changed.

`PROD_URL` is a repository-level GitHub Actions variable. Production host,
user, private key and pinned `known_hosts` remain secrets in the protected
`production` Environment; the secretless preflight job exports the normalized
repository URL to later jobs.

## Command contract

The installed program must be invoked through the exact sudo rule. Artifact
names are resolved below `/var/lib/zzz-calculator-deploy/incoming`; arbitrary
paths are rejected. The program writes one JSON evidence record per operation
to `history` and never includes credentials.

```text
sudo -n /usr/local/sbin/zzz-calculator-deploy audit
sudo -n /usr/local/sbin/zzz-calculator-deploy dry-run \
  --artifact zzz-calculator-server-<artifact-sha-prefix>.tar.gz \
  --expected-sha <artifact-sha256> --expected-commit <40-char-main-sha>
sudo -n /usr/local/sbin/zzz-calculator-deploy deploy \
  --artifact zzz-calculator-server-<artifact-sha-prefix>.tar.gz \
  --expected-sha <artifact-sha256> --expected-commit <40-char-main-sha>
sudo -n /usr/local/sbin/zzz-calculator-deploy rollback --previous
```

Every command first requires an active and healthy production service, valid
Nginx configuration, both download manifests, effective `NODE_ENV=production`,
maintenance disabled, and `ZZZ_CALCULATOR_DATA_DIR` either unset or resolving
lexically through `/opt/zzz_calculator/current/data`. An absolute path naming a
specific release is rejected even when it happens to point at the current
release, because it would become stale after a switch. The effective process
environment is checked again after every restart. `audit` is read-only apart
from its evidence file and verifies that the release, PID, restart counter,
service and manifest hashes stay unchanged.

Before either artifact operation, the root manager atomically moves the
uploaded artifact and evidence into a root-only processing directory and seals
each into a new root-owned inode. The unprivileged upload account therefore
cannot replace or keep modifying the objects used during validation. Archives
are limited to 256 MiB compressed, 1 GiB expanded and 20,000 entries; unsafe
paths, links, special entries, duplicate paths, insufficient disk headroom or
hash/evidence mismatches fail before extraction or switching. Artifact size is
checked before the sealed copy is made, that copy is file-size limited, and its
size is checked again; evidence JSON is limited to 1 MiB.

`dry-run` creates hash-verified immutable private copies of the current,
candidate and compatible rollback trees, then runs the current copy, candidate
copy, rollback copy and candidate copy in that order. Each stage gets a fresh
128 MiB/16,384-inode tmpfs for `HOME`, temporary files and writable data plus a
separate 4 MiB private `/run`, and runs as `zzzvalidate` in a transient systemd
service with `PrivateNetwork`, AF_UNIX disabled, an empty capability set, no
new privileges, a read-only host filesystem, explicit memory/CPU/task/file
limits and `KillMode=control-group`. The source `data` tree is never copied:
only `agents.json`, `agent_skills.json`, `anomaly_effects.json`, `bosses.json`,
`combat_buffs.json`, `drive_disc_sets.json`, `stat_rules.json` and
`w_engines.json` are allow-listed. `user_drive_discs.example.json` is copied
as both the example and isolated `user_drive_discs.json`; real inventory,
scan telemetry and unknown files never enter the sandbox. Seed data is capped
at 64 MiB, 8,192 entries and 1 MiB per file before candidate code starts. The real release
root, deployment state, production state and download origin are inaccessible;
the one private release copy is exposed read-only at `/zzz-validation/app`.
Only private loopback port 8788 exists. The worker itself checks these mounts
and isolation before starting candidate code, traps HUP/INT/TERM, terminates
and reaps its server child, and is backed by systemd control-group cleanup for
any descendants. Candidate stdout/stderr stays discarded inside this gate and
is never copied into deployment evidence. Every stage must pass `/api/health`,
`/api/catalog` and `/api/app-config`, after which the manager stops the whole
cgroup and removes its writable tree. `dry-run`
never changes `current` or restarts the production service and verifies the
original target, PID, `NRestarts`, Nginx and both manifest hashes afterward. A
real `deploy` repeats the same four-stage gate before any production switch.

Successful deploys create new `git-<12-char-sha>` and rollback releases owned
by `root:root`, with directories mode `0755` and files mode `0644`; the manager
checks that `zzzcalc` can read the runtime files but cannot write the release.
The rollback and candidate each contain the union of old/new
`dist/pages/static/app` and `dist/pages/assets`; an absent directory on either
side is treated as empty, while same-path byte conflicts stop the operation.
After an atomic `current` switch, health must pass for 15 consecutive one-second
checks with an active service and stable PID. Any failed or interrupted
uncommitted switch restores the validated rollback release. The switch is not
committed until before/after evidence has been written atomically.

`rollback` accepts exactly `--previous`; arbitrary release names and paths are
not accepted. It uses the same production preflight, atomic switch, stable
health, manifest and evidence gates. HUP, INT and TERM use the same uncommitted
switch recovery path.

The program uses an absolute `/bin/bash`, a fixed system `PATH`, clears shell,
loader, archive, Node and curl injection variables, and holds
`/run/lock/zzz-calculator-deploy.lock`, so audit, dry-run, deploy and rollback
cannot overlap. Release directories are never overwritten or deleted. Claimed
uploads and allow-listed staging paths are removed on exit; a cleanup failure
fails the operation. Evidence records before/after release, commit, service,
PID, restart counter and manifest hashes plus archive limits, tree hashes,
validation sequence, transient-unit results and switch state. JSON is rendered
to a temporary inode, checked against a complete key/type/state schema with
`jq`, permissioned, and atomically renamed. An invalid or unwritable evidence
record fails the operation; after a production switch it also forces rollback.
Credentials are never recorded.
