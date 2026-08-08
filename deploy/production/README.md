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

The bootstrap is also the control-plane upgrade path. Whenever the manager,
validation worker, SSH gateway or sudoers policy changes, rerun the bootstrap
from the same pinned `main` commit before approving its first `dry-run`. Verify
the installed file hashes afterward. The transaction may update only these
dedicated deployment files and accounts; it must still leave `current`, the
production service, Nginx and download manifests unchanged.

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
maintenance and scan telemetry disabled, empty `ZZZ_CALCULATOR_DATA_DIR` and
`SCAN_TELEMETRY_DIR`, no production StateDirectory, no server inventory or
telemetry files, and a retired `/api/user-drive-discs` endpoint (`410`). These
temporary no-persistence gates prevent an immutable release from hiding a
server-side write requirement. Future server persistence requires a separately
approved external StateDirectory and migration. The effective process
environment is checked again after every restart. `audit` is read-only apart
from its evidence file and verifies that the release, PID, restart counter,
service and manifest hashes stay unchanged.

The first managed migration has one explicit legacy-current compatibility
contract. It accepts only the audited tuple `last-release=git-2e7f874bc034`,
`previous-release=rollback-2e7f874bc034`, an absent migration marker, and
current commit `2e7f874bc034871f03b5738f48d7d05685b36ea9`. The current tree
must match the pinned full-content and static portable digests, its complete
historical `zzzcalc:zzzcalc` ownership and directory/file `0755/0644` modes,
and the audited empty server-persistence state. It may contain no links, hard
links, special paths or nested mounts. The manager never changes its owner or
permissions. The legacy `previous-release` is preserved as history but is not
a valid rollback target. Manual rollback remains disabled until the first
managed deployment creates a new strict compatibility rollback.

Before an artifact is claimed, the legacy tree is copied with a canonical tar
stream into a `root:root` mode `0700` processing job and normalized there to
the root-owned immutable contract. Neither `zzzcalc` nor `zzzvalidate` can
reach this complete source snapshot. Only allow-listed catalog files and the
empty example inventory are copied into the `root:zzzvalidate` validation job;
real inventory, telemetry and unknown data files never enter validator scope.
All rollback construction and resource merging use the sealed root-only
snapshot, not the writable live tree. Full content, portable/static and
metadata digests are checked again after sealing, after validation and
immediately before a production switch.

A first successful deploy records the newly created strict compatibility
rollback, the candidate and a root-owned `legacy-current-migrated` marker. If
an uncommitted first deploy is automatically restored to that compatibility
rollback, both state entries are anchored to the actual immutable rollback.
Later managed rollback failures preserve the prior `previous-release`. The
marker permanently disables replay of the legacy exception.

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
limits and `KillMode=control-group`. The source `data` tree is never copied into
the validation scope:
only `agents.json`, `agent_skills.json`, `anomaly_effects.json`, `bosses.json`,
`combat_buffs.json`, `drive_disc_sets.json`, `stat_rules.json` and
`w_engines.json` are allow-listed. `user_drive_discs.example.json` is copied
as both the example and isolated `user_drive_discs.json`; real inventory,
scan telemetry and unknown files never enter the sandbox. Seed data is capped
at 64 MiB, 8,192 entries and 1 MiB per file before candidate code starts. The real release
root, deployment state, production state and download origin are inaccessible;
the one private release copy is exposed read-only at `/zzz-validation/app`.
The private validation parent remains `root:zzzvalidate` mode `0750`: the
validator can read immutable release files, while the production `zzzcalc`
account cannot traverse the job directory. Production release trees separately
require read access for both principals and write access for neither. The
one-time legacy source is not a production target under this rule: only its
sanitized copies participate in validation, and every newly created candidate
or rollback remains strictly immutable.
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
Public assets whose bytes may differ between releases must therefore use a
content-versioned URL and deterministic line endings.
After an atomic `current` switch, the first healthy response must arrive within
15 seconds. Health must then pass for 15 consecutive one-second checks with an
active service and stable PID. Any failed or catchably interrupted uncommitted
switch restores the validated rollback release. The switch is not committed
until before/after evidence has been written atomically.

`rollback` accepts exactly `--previous`; arbitrary release names and paths are
not accepted. It uses the same production preflight, atomic switch, stable
health, manifest and evidence gates. HUP, INT and TERM use the same uncommitted
switch recovery path. SIGKILL and host power loss cannot execute a shell trap;
the next manager invocation therefore fails closed if `current`, the state pair
and the migration marker do not describe one complete managed state, and an
operator must audit that state before recovery.

The program uses an absolute `/bin/bash`, a fixed system `PATH`, clears shell,
loader, archive, Node and curl injection variables, and holds
`/run/lock/zzz-calculator-deploy.lock`, so audit, dry-run, deploy and rollback
cannot overlap. Release directories are never overwritten or deleted. Claimed
uploads and allow-listed staging paths are removed on exit; a cleanup failure
fails the operation. Evidence records before/after release, commit, service,
PID, restart counter and manifest hashes plus archive limits, tree hashes,
the current-release policy, full/portable/static live digests, metadata digest,
tree usage, byte/inode headroom, validation sequence, transient-unit results
and switch state. It also records `previous-release`, `last-release` and the
migration marker before and after the action. Successful audit/dry-run evidence
requires those values to be identical; committed deploy/rollback evidence must
map them to the exact final release. JSON is rendered
to a temporary inode, checked against a complete key/type/state schema with
`jq`, permissioned, and atomically renamed. An invalid or unwritable evidence
record fails the operation; after a production switch it also forces rollback.
Credentials are never recorded.
