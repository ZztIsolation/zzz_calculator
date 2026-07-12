# ZZZ Calculator

ZZZ Calculator is a Vue 3 application for Zenless Zone Zero character panels, damage modeling, Drive Disc inventory, local optimization, accounts, and scanner imports. Shared game logic lives in a platform-neutral core and is reused by the browser and the Node.js service.

中文说明见 [README.zh-CN.md](README.zh-CN.md).

## Architecture

```text
core/                    shared calculations, validation, inventory rules, and optimizer engine
webapp/                  Vue 3 + Pinia + Vite application
  src/runtime/           browser catalog, storage, scanner, and optimizer adapters
  public/assets/         application images and other public assets
backend/                 Node.js APIs, file adapters, and built-app hosting
data/                    game catalogs and public configuration
examples/                stable calculation fixtures
scripts/                 Pages and release build helpers
tests/                   Node and cross-runtime regression tests
benchmarks/              opt-in performance benchmarks
docs/                    modeling notes, regression contract, and changelog
```

The browser owns user accounts, Drive Discs, import history, and loadouts through the existing IndexedDB/localStorage schema. Heavy optimization runs in a browser Worker on the public site. The Node adapter keeps worker-thread support for local and self-hosted use.

## Requirements And Installation

- Node.js 20
- npm

Install the Vue workspace exactly from its lock file:

```bash
npm run install:webapp
```

The root project intentionally has no third-party runtime dependencies.

## Run Locally

Build the Vue application and start the Node service:

```bash
npm start
```

The default address is `http://127.0.0.1:8787`. To serve an existing Vue build without rebuilding it, use:

```bash
npm run serve
```

For frontend-only development with hot reload:

```bash
npm run dev:webapp
```

Set `PORT` to change the Node port. The service binds to `127.0.0.1` by default; container or network exposure requires an explicit `HOST` such as `0.0.0.0`. Maintenance is disabled in production unless `MAINTENANCE_ENABLED=true` is set explicitly. Maintenance writes accept loopback browser origins by default; every non-loopback origin must be listed explicitly in the comma-separated `MAINTENANCE_ALLOWED_ORIGINS` setting.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Workbench: character setup, damage configuration, Buffs, Drive Disc schemes, and optimizer |
| `/discs` | Drive Disc inventory, loadouts, import preview, scanner flow, and stat analysis |
| `/accounts` | Local account creation, switching, rename, and deletion |
| `/maintenance` | Vue data maintenance UI, available only when maintenance is enabled |

`/calculate.html`, `/drive-discs.html`, and `/accounts.html` remain compatibility redirects. When maintenance is enabled, `/maintenance.html` redirects to `/maintenance`; when disabled, both maintenance page routes return 404 and maintenance APIs return 403.

## Local Data

User data stays in the browser and remains scoped to the current account. Existing installations keep the same IndexedDB and localStorage keys; no destructive migration is required.

The local file `data/user_drive_discs.json`, scanner exports under `imports/` or `data/imports/`, build output, logs, downloads, and Playwright artifacts are ignored by Git. Public catalogs, examples, source assets, and tests remain versioned.

## Tests And Builds

Run the complete regression suite after installing webapp dependencies:

```bash
npm test
```

Useful focused commands:

```bash
npm run test:webapp
npm --prefix webapp run build
npm run build:pages
npm run benchmark:optimizer
```

`npm test` covers the Node calculation model, optimizer fixtures/progress/API/fuzz behavior, storage compatibility, scanner bridge, production server behavior, and the Vue test suite. CI uses Node 20, installs `webapp/package-lock.json`, runs the complete suite, and builds the Vue application for every branch and pull request.

## GitHub Pages

Build the static deployment artifact with:

```bash
npm run build:pages
```

The output is written to `dist/pages` and is never committed. It contains the SPA, static catalog/config payloads, `CNAME`, scanner manifest, and the verified current scanner package when available. `.github/workflows/pages.yml` deploys only when `main` is updated; maintenance pages are excluded from the default Pages artifact.

## Scanner Integration

The Drive Disc scanner flow uses a small local Helper registered for the `zzz-scanner://` protocol. The Helper communicates with the page at `127.0.0.1:22355`, reads `/downloads/zzz-scanner/manifest.json`, and prepares ZZZ Scanner Next.

The current supported OCR runtime is ZZZ Scanner Next `1.0.36`. The manifest locks the package size and SHA-256, prefers the same-site Pages package, and retains the GitHub Release asset as a fallback. Local and Cloud Zenless Zone Zero targets are both supported. Scanner packages and generated scans are release artifacts or local caches, not normal source-control content.

## Documentation

- [Modeling notes](docs/modeling.md)
- [Long-term regression contract](docs/regression-contract.md)
- [Detailed changelog](docs/changelog.md)

All calculator models, public data, frontend code, backend code, examples, tests, and release scripts are maintained in this repository.
