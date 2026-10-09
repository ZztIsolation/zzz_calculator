> **Historical archive — not current operating instructions.**
> Original: `deploy/production/RECOVERY.md`. Period: 2026-10-02 incident and subsequent bounded audit. Archived: 2026-10-08.
> Source commit: `6355fbd310cc5836aff0e78bc3fb46e68a5356f8`. Current reference: [current document](../../deploy/production/RECOVERY.md).
> Statements, values and validation results below describe their original revision, not the current implementation or live deployment.

# October 2 deployment recovery investigation

The October 2 failure does not prove a sandbox hang. On attempt 3 the remote
step began at 17:10:51 UTC, the first manager preflight message arrived at
17:30:43, and the capability probe passed at 17:30:44. The job was cancelled
15 seconds later. Transfer, connection and early preflight were not separately
timed in that workflow. The new checkpoints distinguish those stages.

The first bounded audit reached the old manager's preflight after 31 seconds
and hit the 55-second runner deadline before completing. No publish action was
invoked. The old content and portable digests spawned several processes per
file for every tree read. The reviewed manager now hashes those trees in one
trusted, streaming Node process, with byte-for-byte compatibility tests against
the prior GNU tools recipe. Metadata, permission, snapshot and rollback checks
are retained; the 60-second external audit budget is unchanged.
