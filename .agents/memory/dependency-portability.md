---
name: Dependency snapshot portability
description: Why the port uses a focused Python workspace lock without rewriting legacy requirement snapshots
---

Do not assume the old full-environment Python freeze is a resolvable application
dependency manifest. Preserve the legacy snapshots rather than rewriting them
as part of a structural port; lock the packages the workspace runtime needs
separately.

**Why:** A universal resolver first failed on unsupported future Python markers,
then on an unavailable version of an unrelated AI dependency. Restricting the
workspace to the existing Python minor and the application's direct runtime
dependencies resolved successfully without changing application code.

**How to apply:** When adding backend features, extend the focused workspace
runtime lock with required modules and keep its production export in sync.
Do not leave a second deployment installer on the unresolvable broad snapshot:
the preview and production image must consume equivalent dependency locks.
