# ZZZ Calculator

ZZZ Calculator is a Vue 3 and shared-core tool for Zenless Zone Zero agent panels, damage snapshots, Drive Disc optimization, local inventory and Scanner imports. Calculation and optimization run in the browser; the Node service provides catalogs, static assets, local maintenance and bounded integrations.

## Upload Update Summaries

- **2026-10-09 — Adaptive teammate menu**: position and size the teammate menu within available space, with a fixed category column and independently scrolling characters on narrow and short viewports.
- **2026-10-08 — Documentation and character-authoring guide**: separated current specifications from archived evidence, corrected stale role/default/deployment statements, and documented the workflow learned from Aria, Sigrid, Soldier 11, Vivian, Claret, Pyrois and Velina.
- **2026-10-07 — Catalog assets**: added and verified current W-Engine records and content-versioned thumbnails.
- **2026-10-04 — Web/runtime hardening**: preserved Scanner settings across web elevation retries and revalidated compact catalog responses with ETags.
- **2026-10-03 — Production recovery controls**: bounded deployment phases, audit evidence and recovery diagnostics without changing the normal exact-SHA promotion boundary.

Older release and implementation history is in the [archived summaries](docs/archive/) and the [current changelog](docs/changelog.md).

## Architecture

- `core/`: portable calculation, normalization, validation and optimizer logic.
- `webapp/`: Vue UI, browser stores, Worker adapters and local import/maintenance flows.
- `backend/`: catalog/API/static serving, local maintenance, Enka proxy and operational endpoints.
- `data/`: authored catalogs and source fixtures. Browser-owned accounts, Drive Discs, loadouts and calculation selections use IndexedDB `zzz-calculator-user-store` with the existing localStorage fallback.
- `webapp/public/`: committed images and generated thumbnails; production serves them without runtime image processing.

The authoritative model rules live in [docs/modeling.md](docs/modeling.md). New agent work follows [docs/character-authoring-guide.md](docs/character-authoring-guide.md), and durable acceptance behavior lives in [docs/regression-contract.md](docs/regression-contract.md).

## Requirements and installation

- Node.js 20 or newer.
- Install root dependencies and WebApp dependencies as required by the checked-in lockfiles:

```bash
npm install
npm --prefix webapp ci
```

## Run locally

```bash
npm run build:webapp
PORT=8787 npm run serve
```

On Windows PowerShell use `$env:PORT='8787'; npm run serve`. Readiness is the listener followed by HTTP 200 for `/` and `/api/health` with `ok: true` and service `zzz_calculator`.

## Routes and data boundaries

- `/` is the Workbench; `/discs`, `/accounts`, `/import` and `/settings` are Vue routes.
- `/maintenance` is available only when maintenance is enabled. `/internal/scans` is a protected operational route.
- `/api/health`, `/api/meta`, `/api/catalog` and `/api/app-config` are normal service/catalog endpoints.
- `/api/calculate/*`, `/api/analysis/*` and `/api/optimize/*` are development/verification interfaces and return 403 in production; calculation runs in the browser.
- Retired `/api/accounts*` and `/api/user-drive-discs*` routes return 410; user data is browser-local. Enka showcase access is separately runtime-gated.

Deployments preserve the public origin `https://zzzcaculator.top`, browser storage keys and stores. Local maintenance edits authored JSON and does not itself commit or deploy a catalog.

## Tests and builds

```bash
npm test
npm run test:webapp
npm run test:layout
npm run build:webapp
npm run build:server
npm run build:pages
```

Run focused character, formula, maintenance or optimizer scripts from `package.json` when only one behavior changes. `npm run test:layout` includes a build and checks desktop, zoomed desktop and mobile containers with Chromium.

## Production deployment

`main` CI verifies and publishes an immutable exact-SHA artifact. Production is promoted only by the owner-dispatched **Promote deploy** workflow with `force=false`; it is never deployed by a normal push to `main`. Use [the production runbook](docs/production-deployment-runbook.md), [the control-plane documentation](deploy/production/README.md) and [the recovery guide](deploy/production/RECOVERY.md). Legacy Pages is a manual fallback via `npm run build:pages` and `.github/workflows/pages.yml`.

## Scanner integration

The current published line is ZZZ Scanner Next `1.0.49`, Helper `1.3.1`, protocol v4, with schema-v3 manifests. The browser keeps calculator data local; Helper handles the `zzz-scanner://` bridge and package lifecycle. Current support, hashes and compatibility come from `config/scanner-manifest.json`, `config/helper-manifest.json` and the [ZZZ-Scanner.Next repository](https://github.com/ZztIsolation/ZZZ-Scanner.Next). The [1.0.43 evidence](docs/archive/scanner-integration-1.0.43.md) is historical only.

## Third-party services and acknowledgements

Showcase Data Import uses the public Zenless Zone Zero Character Showcase API provided by [Enka.Network](https://enka.network/). We acknowledge the [Enka Network API documentation](https://github.com/EnkaNetwork/API-docs/blob/master/docs/zzz/api.md) and its [upstream repository](https://github.com/EnkaNetwork/API-docs). The generated local mapping records its source revision in `data/enka_zzz_mapping.json`.

ZZZ Calculator is independent and is not affiliated with or endorsed by Enka.Network or HoYoverse. Public upstream access does not by itself grant redistribution rights; confirm the API-docs-derived mapping's terms before production use.

## Documentation

- [Documentation index](docs/README.md)
- [Character authoring and maintenance guide](docs/character-authoring-guide.md)
- [Modeling specification](docs/modeling.md)
- [Long-term regression contract](docs/regression-contract.md)
- [Frontend layout contract](docs/frontend-layout-contract.md)
- [Pyrois modeling](docs/pyrois-modeling.md)
- [Wind/anomaly modeling](docs/wind-anomaly-modeling.md)
- [Luminescence score modeling](docs/luminescence-modeling.md)
- [Production deployment runbook](docs/production-deployment-runbook.md)
- [Current changelog](docs/changelog.md)
- [Archived evidence](docs/archive/)

All calculator models, public data, frontend/backend code, examples, tests and release scripts are maintained in this repository. See [AGENTS.md](AGENTS.md) for the project entry point used by coding assistants.
