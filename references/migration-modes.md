# Migration modes

## Decision table

| Available input | Preferred method | Fidelity | Main risk |
| --- | --- | --- | --- |
| Source repository | Build and adapt the real frontend | Highest | Framework or backend assumptions |
| Production build directory | Inline build artifacts | High | Remaining dynamic chunks and APIs |
| Static HTML/CSS/JS | Inline resources directly | High | Multi-page navigation |
| Public website only | Inventory, request source, then reconstruct if authorized | Variable | Missing code, data, states, and licensing |
| Authenticated private website | Obtain source or an approved export | Variable | Secrets and access-control bypass |

## Source-owned application

1. Read repository instructions and preserve existing changes.
2. Identify the formal entry, build command, router, asset base, APIs, workers, and downloads.
3. Create a standalone/offline flag that affects only the packaged build.
4. Convert history routing to hash routing or an equivalent in-file router.
5. Build normally before packing.
6. Use centralized sanitized fixtures for approved offline data.

Do not copy compiled output back into source files unless the project explicitly uses generated artifacts.

## Production build directory

The packer handles:

- linked stylesheets and CSS imports;
- CSS images and fonts;
- external script files that are already self-contained bundles;
- image, audio, video poster, icon, and manifest resources;
- relative and absolute same-origin asset URLs.

The packer intentionally rejects unresolved ES module imports or dynamic chunks. Rebuild the app as a single bundle first.

## Static multi-page source

A single file cannot preserve server page navigation automatically. Choose one:

- merge page bodies into explicit route templates and intercept internal links;
- rebuild the pages as an SPA with hash routes;
- deliver multiple HTML files if the user approves.

Preserve canonical route labels and back/forward behavior. Do not turn navigation into decorative controls.

## Website-only access

Website-only migration is an investigative workflow, not a guarantee of source recovery.

1. Verify authorization.
2. Crawl only the approved route scope.
3. Capture route inventory, DOM structure, visible states, responsive behavior, and network dependencies.
4. Request the source repository or production build.
5. If reconstruction is approved, implement the observed product behavior and disclose differences.

Never:

- bypass login, paywalls, robots controls, CSP, or anti-bot systems;
- copy secrets, user data, proprietary API payloads, or third-party licensed assets;
- describe a visual reconstruction as a code migration.

## Common blockers

- OAuth and SSO callbacks require an origin and server.
- Payments, uploads, mutations, and signed URLs require backend services.
- WebSockets, streaming, and live collaboration cannot become real-time offline.
- `file://` blocks or changes some CORS, storage, worker, and module behaviors.
- Service workers do not provide a reliable single-file `file://` runtime.
- Cross-origin iframes and protected media cannot be safely inlined without permission.
