# ProbaSight Rebrand Report

Written for: the project owner, and any judge or reviewer who encountered this project
under its previous name.

Date: 2026-09-20. Branch: `main`.

## Old Brand

**Panta Pulse**

## New Brand

**ProbaSight**

Tagline: *AI-powered prediction-market intelligence and trading built on Panta.*

### The distinction this rebrand enforces

| Role | Name |
| --- | --- |
| Product | **ProbaSight** |
| Prediction-market infrastructure / API provider | **Panta** |

Panta is not being renamed or removed anywhere. Every reference to Panta as the data,
pricing, settlement and market-creation provider was deliberately preserved, including
the required "Powered by Panta" attribution. The old *product* name was the only thing
replaced.

## Files Updated

### Application source (9 files)

| File | Change |
| --- | --- |
| `src/components/layout/Logo.tsx` | Rewritten. New mark and wordmark, new component names. |
| `src/components/layout/Header.tsx` | Imports, mark/wordmark usage, `aria-label="ProbaSight home"`. |
| `src/components/layout/Footer.tsx` | Imports, mark/wordmark usage, independence disclaimer. |
| `src/app/layout.tsx` | All metadata (see below). |
| `src/app/(home)/page.tsx` | Non-custodial copy line. |
| `src/app/globals.css` | Design-system header comment, wallet-modal comment, `pp-pulse` to `ps-pulse`. |
| `src/components/portfolio/PortfolioDashboard.tsx` | Empty-state and Created Markets copy. |
| `src/components/trading/TradePanel.tsx` | Non-custodial reassurance line. |
| `src/lib/ai/prompts.ts` | `SYSTEM_PROMPT` product name only. No rule or constraint changed. |
| `src/lib/client-api.ts` | Network-failure message. |

### Project metadata

| File | Change |
| --- | --- |
| `package.json` | `"name": "panta-pulse"` to `"name": "probasight"`. No dependency changed. |
| `package-lock.json` | Same rename in the two `name` fields. **No dependency, version or integrity hash changed** (verified: `npm install` produced a 2-line diff). |
| `.env.example` | Header comment. No variable name changed. |

### Brand assets

| File | Change |
| --- | --- |
| `src/app/icon.svg` | Redrawn as the ProbaSight mark. |
| `src/app/apple-icon.png` | **New.** 180x180 iOS home-screen icon. |
| `public/brand/README.md` | **New.** Drop-in instructions for a supplied logo asset. |

### Documentation (7 files)

`README.md`, `REPORT.md`, `SUBMISSION_READY.md`, `docs/DEMO_SCRIPT.md`,
`docs/REQUIRED_KEYS.md`, `docs/SUBMISSION.md`, `docs/TRACTION_CHECKLIST.md`.

`docs/ARCHITECTURE.md` and `docs/QA_REPORT.md` contained no product-brand references and
were not modified by the rebrand.

## Brand Assets Updated

### The new mark

An original drawing: a **logistic (sigmoid) probability curve** with a **focal node at its
inflection point**. The curve reads as forecasting and probability; the node is the
"sight" the product is named for. It replaces the previous ECG-style pulse trace, which
was tied to the old name.

Accent `#4FE0D0` on surface `#0E131A`, matching the existing dark-terminal theme. Not
casino-like, not playful.

**Legibility was verified by rendering, not assumed.** The icon was rasterised at 16, 32,
48 and 180 px and inspected. The first geometry failed at 16 px (the node merged into the
curve and it read as a plain diagonal line), so the punch-out gap was widened and the node
enlarged (`stroke-width` 2.4 to 2.2, node `r` 2.4 to 3.0, gap `r` 3.6 to 4.3). The second
geometry reads correctly at all four sizes.

### Drop-in path for a supplied asset

`src/components/layout/Logo.tsx` exposes a single constant:

```ts
const BRAND_MARK_SRC: string | null = null;
```

Point it at a file in `public/brand/` and the app uses that image instead of the inline
SVG. The image renders with `object-contain` inside a square box, so **aspect ratio is
always preserved**, never stretched or squashed. Left `null`, the inline SVG is used, so
nothing breaks while `public/brand/` is empty. Full instructions in
`public/brand/README.md`.

### Origin and independence

The mark is original and is **not** derived from any Panta asset. The footer continues to
state that ProbaSight is an independent interface not operated or endorsed by Panta, and
"Powered by Panta" remains a separate attribution element.

## Metadata Updated

Verified in the served HTML of the running production server, not read from source:

| Field | Value |
| --- | --- |
| `<title>` | `ProbaSight: Prediction markets, understood` |
| Title template | `%s · ProbaSight` |
| `application-name` | `ProbaSight` |
| `description` | `An AI-powered prediction-market intelligence and trading terminal built on Panta. ...` |
| `og:title` | `ProbaSight: Prediction markets, understood` |
| `og:description` | `Real-time Panta market intelligence, AI analysis, and on-chain trading in one terminal.` |
| `og:site_name` | `ProbaSight` **(added)** |
| `icon` | `/icon.svg` |
| `apple-touch-icon` | `/apple-icon.png`, 180x180 **(added)** |

No technical claim in the description was changed or broadened.

## Documentation Updated

| Document | New heading |
| --- | --- |
| `README.md` | `# ProbaSight` |
| `REPORT.md` | `# ProbaSight: Final Readiness Report` |
| `SUBMISSION_READY.md` | `# ProbaSight: Submission Readiness` |
| `docs/SUBMISSION.md` | `# ProbaSight: Submission` |
| `docs/DEMO_SCRIPT.md` | `# Demo script: ProbaSight` |

Spoken demo branding now opens with "ProbaSight turns Panta prediction markets into an AI
intelligence and trading terminal", and still closes on "Powered by Panta."

No audit evidence, test result, measurement or verdict was altered. Only product-name
wording changed.

## Internal Components Renamed

| Old | New |
| --- | --- |
| `PulseGlyph` | `ProbaSightMark` |
| `Wordmark` | `ProbaSightWordmark` |
| `@keyframes pp-pulse` | `@keyframes ps-pulse` |

`pp-` stood for Panta Pulse, so the prefix was brand-derived and renamed with it.

**Deliberately NOT renamed** (non-brand use of the word "pulse"): the CSS comment
"Quiet status pulse" and the animation itself, which genuinely describes a pulsing status
indicator.

**Deliberately NOT renamed** (Panta infrastructure identifiers, per the rebrand rules):

```
/api/panta/*        src/lib/panta/      src/app/api/panta/
PANTA_API_KEY       PANTA_API_BASE_URL  PoweredByPanta.tsx
```

## Panta Attribution Preserved

`src/components/common/PoweredByPanta.tsx` was **not modified**. Panta's Terms of Use
section 6 require the exact wording, and it is unchanged.

Confirmed in served HTML from the running server:

| Page | "Powered by Panta" occurrences |
| --- | --- |
| `/` | 2 |
| `/markets` | 2 |
| `/portfolio` | 1 |
| `/create` | 3 |
| `/markets/{id}` | 1 |

Other accurate provider references left intact, verified present: "Live from the Panta
catalog", "Publish a new prediction market to Panta", "Market data, pricing, positions and
settlement are provided by Panta", and the full Panta API integration tables in `README.md`.

## Old-Name Search Result

Repository-wide, excluding `node_modules`, `.next`, `.git`, `out`, `coverage`:

| Pattern | Occurrences |
| --- | --- |
| `Panta Pulse` | 0 |
| `PantaPulse` | 0 |
| `Panta-Pulse` | 0 |
| `panta-pulse` | 0 |
| `pantapulse` | 0 |
| `PANTA PULSE` | 0 |

**0 unintended occurrences.**

Also confirmed in the rendered HTML of every page served by the production build:
0 occurrences of "Panta Pulse" on `/`, `/markets`, `/portfolio`, `/create` and
`/markets/{id}`.

### One intentional historical reference

`REPORT.md` carries a naming note stating that this project was previously called
"Panta Pulse" and that it is the same project, not a second one. This is **deliberate**
and is the single place the old name survives.

Reason: judges and reviewers may have seen the earlier name in prior material, and the
report already carried a note disambiguating an unrelated "Panther" typo. Silently
dropping the old name would make the two look like different submissions. The note
identifies "Panta Pulse" explicitly as a *former* name, never as the current product.

## Tests

All run after every rebrand change, against the restored dependency tree.

| Gate | Command | Result |
| --- | --- | --- |
| Lint | `npx eslint .` | **PASS** - 0 errors, 0 warnings |
| Typecheck | `npx tsc --noEmit` | **PASS** - 0 errors |
| Tests | `npx vitest run` | **PASS** - 133/133 passing, 10 files |
| Build | `npx next build` | **PASS** - all 20 API routes plus `/icon.svg` and `/apple-icon.png` emitted |
| Clean install | `npm ci` | **BLOCKED** - see below |

No test was weakened, skipped or modified. No test referenced the product name, so none
needed updating.

### `npm ci` - BLOCKED, environment, not project

`npm ci` could not complete on this Windows machine. It deletes `node_modules` wholesale
before reinstalling, and the OS refused to delete a loaded native binary:

```
node_modules\@next\swc-win32-x64-msvc\next-swc.win32-x64-msvc.node
The operation was rejected by your operating system.
```

Attempted twice, failed identically both times, leaving `node_modules` partially removed
(473 packages down to 61). Recovered both times with `npm install`.

This is a Windows file-lock on a native module, not a packaging fault. The evidence that
the renamed lockfile is valid is stronger than `npm ci` would have given: `npm install`
reconciled `package.json` against `package-lock.json` and produced a diff of **exactly the
two renamed `name` fields**, with no dependency, version or integrity-hash drift, and
restored all 473 packages. Vercel builds on Linux, where this lock does not occur.

## Functional Regression Check

Verified by starting the production build (`npx next start -p 3111`) and issuing real
requests against the live Panta API and live Groq. Not a code read.

| Surface | Result |
| --- | --- |
| Homepage `/` | **PASS** - HTTP 200 |
| Markets `/markets` | **PASS** - HTTP 200, live catalog rendered |
| Market detail `/markets/{id}` | **PASS** - HTTP 200 on a real live market id |
| Portfolio `/portfolio` | **PASS** - HTTP 200 |
| Create market `/create` | **PASS** - HTTP 200 |
| 404 handling | **PASS** - unknown market returns HTTP **404**, not 200 |
| `/api/panta/categories` | **PASS** - HTTP 200 |
| `/api/panta/markets` | **PASS** - HTTP 200, real market ids returned |
| AI analysis | **PASS** - HTTP 200, full structured analysis from live Groq |
| Favicon `/icon.svg` | **PASS** - HTTP 200 |
| App icon `/apple-icon.png` | **PASS** - HTTP 200 |
| "Powered by Panta" | **PASS** - present on all five pages |
| Responsive layout | Unchanged - no layout code was touched |

### Note on AI route intermittency (pre-existing, not a regression)

Repeated AI calls alternate between HTTP 200 with a full analysis and HTTP 422
`MARKET_QUESTION_UNAVAILABLE`. This is the **existing** upstream Panta flakiness already
recorded in `docs/QA_REPORT.md`: the market detail endpoint intermittently returns a row
with both `title` and `description` empty, and `hasAnalysableQuestion` then correctly
**refuses to analyse** rather than inferring a topic from category or oracle names.

That is the honest-refusal guard working as designed. Confirmed not caused by this
rebrand: the only change under `src/lib/ai/` and `src/app/api/ai/` is one line in
`SYSTEM_PROMPT` replacing the product name. `src/lib/ai/market-context.ts`, which holds
the guard, is byte-for-byte unchanged.

### Not verifiable here

Wallet connect, trade signing, claims and creator fees are unchanged by this rebrand, but
all require a funded wallet and a human approval in a real browser. They are
**BLOCKED - MANUAL VERIFICATION REQUIRED**, exactly as in `REPORT.md`. No branding change
touched the transaction, signing or broadcast path.

## Remaining Manual Actions

1. **Supply the ProbaSight logo asset.** Drop it in `public/brand/` and set
   `BRAND_MARK_SRC` in `src/components/layout/Logo.tsx`. The inline SVG mark works today,
   so this is optional polish rather than a blocker. See `public/brand/README.md`.

2. **Open Graph image.** No `og:image` exists, before or after this rebrand. Social shares
   will show no preview card. Add one at 1200x630 and reference it in `layout.tsx`.

3. **GitHub repository name.** The remote is still
   `github.com/Madubuezejoshua/Panta-Pulse.git`. Renaming it is a GitHub-side action;
   GitHub redirects the old URL, so nothing breaks either way. No document in this
   repository hardcodes the repository URL, so a rename requires no code change.

4. **Panta API account and key labels.** The existing live key was registered with Panta
   under the old name. The setup instructions in `docs/REQUIRED_KEYS.md` now say
   `probasight`, which is correct for a fresh registration, but the already-issued key
   keeps whatever label it was minted with. This is cosmetic, visible only in the Panta
   dashboard, and does not affect function. Re-label or re-mint at your discretion.

5. **Vercel project name.** Cosmetic, affects only the default deployment URL.
