# Calculator production deploy manager

This directory contains the one-time server initializer and the root-owned
deployment program used by the Calculator CD workflow. It is deliberately
separate from the application service, Nginx configuration, Helper/Scanner
download origin, and the `current` symlink.

## One-time initialization

Run the bootstrap as `root` on the production host. The first run needs the
public half of the dedicated CI deploy key in `ZZZDEPLOY_PUBLIC_KEY`; the key
is written only to the server's `zzzdeploy` account and is never part of the
repository:

```sh
export ZZZDEPLOY_PUBLIC_KEY='ssh-ed25519 AAAA...'
./bootstrap-zzz-calculator-deploy.sh
unset ZZZDEPLOY_PUBLIC_KEY
```

The initializer creates a password-locked `zzzdeploy` account, disables PTY,
agent/X11/port forwarding for its dedicated key, and grants access to the
fixed `incoming` upload directory plus only the root deployment command. It
creates the root-owned history/validation folders,
the fixed sudo rule, and `/usr/local/sbin/zzz-calculator-deploy`. It does not
read or change `current`, release contents, Nginx, or systemd, and it never
restarts the application.

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
sudo -n /usr/local/sbin/zzz-calculator-deploy rollback
```

`audit` is read-only apart from its evidence file. `dry-run` validates the
archive, `.deployed-commit`, SHA-256, safe tar paths and static-resource
compatibility in `validation`; it does not switch `current` or restart the
service. `deploy` creates a new immutable `git-<12-char-sha>` release and a
rollback release containing the union of old/new `dist/pages/static/app` and
`dist/pages/assets`. Same-path byte conflicts stop the operation. The current
symlink is switched atomically and the service is restarted at most once; a
15-second health failure switches back and restarts the validated rollback
release. `rollback` accepts only a recorded release basename and runs the same
health gate.

The program uses `/run/lock/zzz-calculator-deploy.lock`, so audit, dry-run,
deploy and rollback cannot overlap. Release directories are never overwritten
or deleted, and `.part` uploads remain available for post-deploy evidence
cleanup.
