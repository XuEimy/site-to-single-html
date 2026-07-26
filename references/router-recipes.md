# Router recipes

## General rule

Use hash routing for a portable single HTML file. A URL such as `app.html#/projects/42` keeps the document path stable while preserving client navigation.

Search for:

```text
BrowserRouter
createBrowserRouter
createWebHistory
historyApiFallback
pushState
router.push
baseURL
publicPath
base:
assetPrefix
serviceWorker.register
```

## React Router

- Replace `BrowserRouter` with `HashRouter`, or use `createHashRouter`.
- Remove server-only rewrite assumptions.
- Verify nested routes, redirects, search parameters, back, and forward.
- For lazy routes, configure the build to emit one JavaScript bundle before packing.

## Vue Router

- Replace `createWebHistory()` with `createWebHashHistory()`.
- Set Vite `base: './'`.
- Avoid unresolved lazy chunks; configure a single-bundle build or inline them before delivery.

## Vite

- Set `base: './'` for build assets.
- Build first; pack `dist/index.html`, not the development entry.
- Classic scripts copied from `public/` must also be present in `dist`.
- Dynamic imports must be bundled into one chunk or explicitly inlined.

## Next.js

- A normal server-rendered Next.js app is not a single-file candidate.
- Use static export only when every required route supports it.
- Client navigation across exported pages still requires merging or a route adapter.
- Server Actions, Route Handlers, image optimization, middleware, auth, and runtime data remain server features.

## Plain JavaScript

- Store the current route in `location.hash`.
- Render from a deterministic route table.
- Listen to `hashchange`.
- Use anchors with `href="#/route"` so keyboard and browser history behavior remain native.

## Local file caveats

- Do not fetch sibling local files at runtime.
- Inline modules and assets before delivery.
- Avoid absolute paths beginning with `/`.
- Disable service workers.
- Prefer `localStorage` only for non-sensitive local state and provide a reset path.
