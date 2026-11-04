---
name: CRA Tailwind resolution
description: Prevent sibling Tailwind versions from breaking the JanSetu web build.
---

**Rule:** Keep the JanSetu web app's Create React App PostCSS Tailwind plugin bound to the version installed for that artifact rather than resolving the bare plugin name.

**Why:** The pnpm workspace has sibling artifacts on Tailwind 4 while the CRA web app uses Tailwind 3. CRA's plugin-name resolution can pick the workspace Tailwind 4 package, which rejects use as the v3 PostCSS plugin.

**How to apply:** When changing Tailwind versions or CRA's PostCSS setup, verify the resolved plugin path and preserve an explicit artifact-local plugin until a deliberate Tailwind migration updates the web app's CSS and configuration.
