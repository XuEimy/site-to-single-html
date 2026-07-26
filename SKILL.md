---
name: site-to-single-html
description: Migrate an authorized website or frontend project into a self-contained local HTML file while preserving visual design, client-side navigation, and usable offline states. Use when Codex is asked to copy or migrate a website, archive a web app as one HTML file, remove localhost or hosting dependencies, inline frontend assets, convert React/Vue/SPA routes for local use, or verify that a delivered HTML works when opened through file://.
---

# Site to Single HTML

Turn an authorized website or frontend codebase into one portable HTML file. Preserve source behavior where possible; never replace an existing product with an invented imitation.

## Safety and fidelity

- Confirm that the user owns the site or is authorized to migrate it. Do not bypass authentication, paywalls, DRM, anti-bot controls, or access restrictions.
- Prefer source code and production build artifacts over scraping rendered pixels or reconstructing the UI.
- Preserve navigation, content, interaction, responsive behavior, and accessibility semantics.
- Do not claim server-backed features work offline. Replace unavailable APIs only with clearly identified fixtures or disabled/error states approved by the user.
- Keep secrets, cookies, tokens, personal data, and private API responses out of the generated file.
- Treat third-party fonts, images, video, and code as licensed material. Do not redistribute assets without permission.

## Choose the migration mode

Read [migration-modes.md](references/migration-modes.md) before implementation.

1. **Source-owned app**: inspect the repository, run its normal production build, adapt routing for `file://`, then pack the build output. This is the preferred path.
2. **Static or multi-page source**: collect every page and asset, unify navigation, then pack.
3. **Website-only access**: use the browser to inventory routes and interactions. Obtain source or explicit permission before copying protected assets. Recreate only when source cannot be obtained, and label deviations.

## Workflow

### 1. Establish the contract

Record:

- source URL or repository and authorization;
- required routes, viewport sizes, and interactions;
- whether the result must work fully offline;
- server-backed features and the approved offline behavior;
- output path and whether one file or a companion export is acceptable.

Define acceptance criteria in observable terms. Include direct `file://` opening, route navigation, asset completeness, console errors, and network requests.

### 2. Inventory the source

For a URL or built entry:

```bash
node scripts/audit-site.mjs --input <url-or-index.html> --json <audit.json>
```

Also inspect the live page with an available browser:

- enumerate menus, links, dialogs, tabs, forms, downloads, and responsive states;
- record route changes and whether history, hash, or server rewrites own navigation;
- inspect console and network activity;
- identify API, WebSocket, worker, iframe, blob, streaming, font, and media dependencies;
- capture screenshots only as verification references, not as implementation source.

### 3. Acquire and stabilize the frontend

When source exists:

- preserve the existing app architecture;
- run the documented install, test, and production build commands;
- make the smallest source changes needed for a static base path and offline mode;
- centralize fixtures and offline flags instead of scattering fetch fallbacks;
- disable service-worker registration in the standalone build;
- never embed credentials or captured authenticated responses.

When only a website exists, follow the website-only constraints in [migration-modes.md](references/migration-modes.md).

### 4. Make navigation file-safe

Read [router-recipes.md](references/router-recipes.md) for the detected framework.

- Prefer hash routing for a true single file.
- Rewrite hard-coded root paths and asset bases before building.
- Preserve query strings and deep-link state when practical.
- For multi-page sites, either merge pages into an explicit client router or obtain agreement to deliver separate files. Do not silently drop routes.
- Test back, forward, refresh, direct entry, and nested navigation.

### 5. Define offline data behavior

Classify every remote dependency:

| Dependency | Offline treatment |
| --- | --- |
| Static CSS, JS, image, font | Inline as text or data URI |
| Read-only API needed for display | Use an approved sanitized fixture |
| Mutation, upload, payment, auth | Disable with clear local-mode feedback |
| WebSocket, streaming, live status | Provide a labeled snapshot or unavailable state |
| Cross-origin iframe or protected media | Keep external only with approval, otherwise report unsupported |

The offline file must not display raw transport errors such as `Failed to fetch`.

### 6. Pack the production build

Use the bundled packer only after the app works from its build directory:

```bash
node scripts/pack-single-html.mjs \
  --input <dist/index.html> \
  --output <output.html>
```

For an authorized public URL, add `--allow-network`. The packer inlines linked stylesheets, classic or already-bundled scripts, images, fonts, icons, manifests, and CSS assets. It rejects unresolved module imports and external runtime resources by default.

If the packer reports unresolved dependencies, fix the source/build or explicitly document an approved online dependency. Do not suppress the report to make the task appear complete.

### 7. Verify the delivered file

Read and execute [verification-checklist.md](references/verification-checklist.md).

At minimum:

1. Stop the source dev server.
2. Open the output through `file://`.
3. Exercise every required route and primary interaction.
4. Check desktop and narrow viewport layouts.
5. Inspect console errors and network requests.
6. Search the file for `localhost`, source paths, unresolved assets, secrets, and forbidden external hosts.
7. Compare screenshots against the source at equivalent states.
8. Report separately: file created, static audit passed, browser flow passed, and real backend availability.

## Failure rules

- Stop and report when authorization is missing.
- Ask for source access when runtime scraping cannot preserve required behavior.
- Reject “fully offline” if essential server behavior has no approved fixture or disabled state.
- Never hide broken features, missing routes, or external dependencies behind a success claim.
