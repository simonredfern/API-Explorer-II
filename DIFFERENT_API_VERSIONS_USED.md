# Different API Versions Used

Current state of all OBP API version references in the codebase.

**Legend:** **ENV** = environment variable, **CODE** = TypeScript/JS constant, **LITERAL** = hardcoded string in code.

## Group A: app's own OBP path version (used for app-infrastructure calls)

| # | Type | Name | Location | Current Value | Purpose |
|---|------|------|----------|---------------|---------|
| 1 | ENV | `VITE_OBP_API_VERSION` | `.env:3` | `v6.0.0` | Local override. Read in `OBPConsentsService.ts:203` (commented out) and historically wired into infrastructure paths |
| 2 | ENV | `VITE_OBP_API_VERSION` | `.env.example:3` | `v5.1.0` | Template default for new checkouts |
| 3 | CODE | `DEFAULT_OBP_API_VERSION` | `src/shared-constants.ts:2` | `'v5.1.0'` | Fallback when env var unset. Imported by `OBPClientService.ts:29,81`, `OBPConsentsService.ts`, `server/routes/user.ts`, `AutoLogout.vue` |
| 4 | CODE | `OBP_API_VERSION` | `src/obp/index.ts:32` | re-exports #3 | Used in `src/obp/index.ts:150,163,172,181,189,194,199`, `message-docs.ts:64`, `main.ts:47,368` |

## Group B: per-endpoint pinned versions (intentionally not env-driven)

| # | Type | Name | Location | Current Value | Used by |
|---|------|------|----------|---------------|---------|
| 5 | CODE | `RESOURCE_DOCS_API_VERSION` | `src/shared-constants.ts:12` | `'v5.1.0'` | `src/obp/resource-docs.ts:38,54`; `server/routes/status.ts:111` |
| 6 | CODE | `MESSAGE_DOCS_API_VERSION` | `src/shared-constants.ts:18` | `'v5.1.0'` | `server/routes/status.ts:126` |
| 7 | CODE | `API_VERSIONS_LIST_API_VERSION` | `src/shared-constants.ts:24` | `'v7.0.0'` | `src/obp/api-version.ts:33` (drives the dropdown); `server/routes/status.ts:141` |
| 8 | CODE | `GLOSSARY_API_VERSION` | `src/shared-constants.ts:30` | `'v5.1.0'` | `src/obp/glossary.ts:37` |

## Group C: default doc version shown in UI

| # | Type | Name | Location | Current Value | Purpose |
|---|------|------|----------|---------------|---------|
| 9 | ENV | `VITE_OBP_API_DEFAULT_RESOURCE_DOC_VERSION` | `.env:51` | *commented out* | Not set locally — code fallback (#11) is active |
| 10 | ENV | `VITE_OBP_API_DEFAULT_RESOURCE_DOC_VERSION` | `.env.example:67` | `OBPv6.0.0` | Template default |
| 11 | CODE | `OBP_API_DEFAULT_RESOURCE_DOC_VERSION` | `src/obp/index.ts:34-35` | env var ?? `'OBPv7.0.0'` | Used in `HeaderNav.vue:311`, `Content.vue:47`, `Preview.vue:41`, `SearchNav.vue:84`, `CollectionView.vue:26`, `resource-docs.ts:224,237,261,268`, `router/index.ts:117,144` |

## Group D: plain version-string constants (formerly literals)

Previously hardcoded in `obp/...` paths. Now backed by simple constants in `src/shared-constants.ts` that just represent the version string with no semantic meaning.

| # | Type | Name | Location | Current Value | Used by |
|---|------|------|----------|---------------|---------|
| 12 | CODE | `V5_1_0` | `src/shared-constants.ts` | `'v5.1.0'` | `server/services/OAuth2ProviderManager.ts:99,104,154` (well-known); `server/routes/status.ts:336,349` (well-known status) |
| 13 | CODE | `V6_0_0` | `src/shared-constants.ts` | `'v6.0.0'` | `src/obp/message-docs.ts:46,73` (connectors, message-docs JSON schema); `src/obp/index.ts:205,209` (api-collections, banks) |

## Group E: non-path version references (display labels / doc comments)

| # | Type | Location | Literal | What it does |
|---|------|----------|---------|--------------|
| 14 | LITERAL | `src/components/HeaderNav.vue:75` | `['BGv1.3', 'BGv2', 'OBPv5.1.0', 'OBPv6.0.0', 'OBPv7.0.0', 'UKv3.1', ...]` | Dropdown ordering — display labels, not behavioral |
| 15 | LITERAL | `server/services/OAuth2ProviderManager.ts:75` | `* 2. VITE_OBP_API_HOST/obp/v5.1.0/well-known (multi-provider mode)` | JSDoc comment only — not executed |

## Quick observations

- **#1 vs #2 mismatch**: local `.env` is `v6.0.0` but template `.env.example` is `v5.1.0`. Worth checking that's intentional.
- **#9 is commented out**, so the UI default comes from #11's `'OBPv7.0.0'` fallback. That's why `localhost:5173` lands on v7.0.0.
- **#4 (`OBP_API_VERSION`) is just a re-export of #3** — could be collapsed.
- **#12 / #13** are deliberately value-named (not purpose-named) so any path can use them without semantic baggage. Bumping a version means updating one constant.
