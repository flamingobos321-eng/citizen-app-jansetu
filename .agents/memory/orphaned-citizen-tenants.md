---
name: Orphaned citizen tenant links
description: Handling active citizen accounts whose tenant no longer resolves to a portal.
---

Treat `same_tenant: false` as a transfer candidate only when the backend also confirms `can_transfer: true`. An active citizen record may refer to a source portal that no longer exists, which makes the transfer flow impossible.

**Why:** The preview database contained an active account with no resolvable source portal. The login page had treated every cross-tenant result as transferable, sending the citizen into a flow that could not complete.

**How to apply:** Surface the backend's recovery message when `can_transfer` is false. Before changing an account's tenant association, confirm the target portal and the exact account, then update only the explicitly approved record and verify the mobile check again.
