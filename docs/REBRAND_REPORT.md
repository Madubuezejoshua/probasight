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
| `public/brand/probasight-mark.png` | **New.** The supplied ProbaSight logo, 512x512 RGBA. |
| `src/app/favicon.ico` | **New.** The supplied favicon, 16/32/48 px entries. |
| `src/app/apple-icon.png` | **New.** 180x180 iOS home-screen icon, generated from the supplied logo. |
| `src/app/opengraph-image.png` | **New.** 1200x630 social preview card. |
| `src/app/icon.svg` | **Deleted.** The interim generated mark, superseded by the supplied asset. |
| `public/brand/README.md` | **New.** Asset locations and replacement instructions. |

### Documentation (7 files)

`README.md`, `REPORT.md`, `SUBMISSION_READY.md`, `docs/DEMO_SCRIPT.md`,
`docs/REQUIRED_KEYS.md`, `docs/SUBMISSION.md`, `docs/TRACTION_CHECKLIST.md`.

`docs/ARCHITECTURE.md` and `docs/QA_REPORT.md` contained no product-brand references and
were not modified by the rebrand.

## Brand Assets Updated

### The supplied asset

The ProbaSight logo and favicon were **provided by the project owner** and are the marks
now in use: a teal bar chart with a forward arrow inside a ring. Both were inspected
before adoption.

| Asset | Source | Where it is used |
| --- | --- | --- |
| `public/brand/probasight-mark.png` | Supplied, 512x512 RGBA with alpha | Header and footer marks |
| `src/app/favicon.ico` | Supplied, 3 entries (16, 32, 48 px, 32bpp) | Browser tab icon |
| `src/app/apple-icon.png` | Generated from the supplied logo | iOS home screen, 180x180 |
| `src/app/opengraph-image.png` | Generated from the supplied logo | Social preview, 1200x630 |

The favicon's three embedded bitmaps were decoded and rendered: the artwork matches the
logo, and is legible at 32 and 48 px. The logo was rendered at its real display sizes
(24, 28, 32, 48, 180 px) on both the dark theme background (`#080B10`) and a light
background before being wired in.

An interim mark drawn during this rebrand (a logistic curve with a focal node) was
**discarded** in favour of the supplied asset, and `src/app/icon.svg` was deleted.

### Serving cost

The source PNG is 275 KB, which would otherwise be downloaded in full to paint a 28 px
header icon on every page load. The mark is therefore rendered through `next/image`
rather than a raw `<img>`.

Measured against the running production server:

| Request | Bytes |
| --- | --- |
| `/brand/probasight-mark.png` (source) | 275 KB |
| `/_next/image?...&w=128&q=75` (what the browser actually gets) | **7 KB** |

The header instance sets `priority` (it is above the fold on every page); the footer
instance lazy-loads. Both render with `object-contain` inside a square box, so the aspect
ratio is preserved and the mark is never stretched or squashed.

### Independence

The mark is not a Panta asset and does not resemble one. The footer still states that
ProbaSight is an independent interface not operated or endorsed by Panta, and
"Powered by Panta" remains a separate element.

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
| `og:image` | `/opengraph-image.png`, 1200x630, with `og:image:width` / `:height` **(added)** |
| `icon` | `/favicon.ico` **(supplied asset)** |
| `apple-touch-icon` | `/apple-icon.png`, 180x180 **(added)** |

The explicit `icons` block was removed from `layout.tsx`; Next's file conventions
(`app/favicon.ico`, `app/apple-icon.png`, `app/opengraph-image.png`) now generate the
tags, which removes the risk of metadata and files disagreeing. Verified in served HTML.

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

All run after every change, against a tree installed from the lockfile.

| Gate | Command | Result |
| --- | --- | --- |
| Clean install | `npm ci` | **PASS** - 473 packages, zero lockfile drift |
| Lint | `npx eslint .` | **PASS** - 0 errors, 0 warnings |
| Typecheck | `npx tsc --noEmit` | **PASS** - 0 errors |
| Tests | `npx vitest run` | **PASS** - 137/137 passing, 11 files |
| Build | `npx next build` | **PASS** - all 20 API routes plus `/apple-icon.png` and `/opengraph-image.png` |

No test was weakened, skipped or modified. Four tests were **added** (see below).

### `npm ci` - resolved

`npm ci` initially failed twice, rejected by the OS while deleting
`node_modules\@next\swc-win32-x64-msvc
ext-swc.win32-x64-msvc.node`.

The cause was identified rather than worked around: a **stale `next start -p 3000`
process** (PID 2788, started 00:30, left over from an earlier session) still had the
native module loaded. Ending that process made `npm ci` succeed on the next attempt,
installing all 473 packages with no lockfile drift. This was not an npm, packaging or
platform fault.

### The repo-integrity test earned its keep

`tests/repo-integrity.test.ts` failed during this pass because the newly written
`tests/ai-question-refetch.test.ts` was not yet git-tracked. That is the same guard added
after four API routes were silently excluded from the repository by an unanchored
`.gitignore` pattern, and it behaved exactly as intended.

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
| Favicon `/favicon.ico` | **PASS** - HTTP 200, supplied asset |
| App icon `/apple-icon.png` | **PASS** - HTTP 200 |
| Social card `/opengraph-image.png` | **PASS** - HTTP 200, 1200x630 |
| Logo `/brand/probasight-mark.png` | **PASS** - HTTP 200, served optimised at 7 KB |
| Old `/icon.svg` | **PASS** - HTTP 404, correctly gone |
| "Powered by Panta" | **PASS** - present on all five pages |
| Responsive layout | Unchanged - no layout code was touched |

### AI route: question-less market rows

During this pass the AI route returned HTTP 422 `MARKET_QUESTION_UNAVAILABLE` on roughly
half of repeated calls for the same market. Two findings came out of investigating it.

**1. It is not a rebrand regression.** The only change under `src/lib/ai/` or
`src/app/api/ai/` at that point was one line of `SYSTEM_PROMPT` replacing the product
name. `src/lib/ai/market-context.ts`, which holds the guard, was byte-for-byte unchanged.

**2. Many Panta markets genuinely have no question text.** Checking the detail endpoint
for 12 consecutive catalog rows: **7 of 12 returned an empty `title` AND empty
`description`**, persistently, across repeated calls. For those markets the 422 is the
correct and honest answer, not a bug. `hasAnalysableQuestion` refuses rather than letting
the model infer a question from category or oracle-feed names, which is exactly the
hallucination `tests/ai-guard.test.ts` was written to prevent.

**Mitigation added.** For the case where a populated row and an empty row alternate for
the same id, the route now re-fetches before refusing (`QUESTION_ATTEMPTS = 3`, backoff
200/500 ms). The client's existing transient retry cannot cover this, because the bad
response is an HTTP 200 with empty fields rather than an error code.

The refusal is **not** weakened: if the question is still missing after the attempts, the
request is refused exactly as before.

**Covered by four new tests** in `tests/ai-question-refetch.test.ts`: a populated first
response is used with no extra call; a later populated response wins; a genuinely
question-less market is still refused; and the attempts are bounded rather than looping.
The tests were confirmed to have teeth by temporarily setting `QUESTION_ATTEMPTS = 1`,
which made two of them fail.

**Honest limit:** after the fix, behaviour is deterministic in live testing - a market
with question text returned 200 on 4/4 calls (the 5th was a correct 429 from the rate
limiter), and a market without returned 422 on 6/6. The alternating behaviour observed
earlier **did not reproduce**, so the re-fetch is proven by unit test but was not
observed rescuing a live call.

### Not verifiable here

Wallet connect, trade signing, claims and creator fees are unchanged by this rebrand, but
all require a funded wallet and a human approval in a real browser. They are
**BLOCKED - MANUAL VERIFICATION REQUIRED**, exactly as in `REPORT.md`. No branding change
touched the transaction, signing or broadcast path.

## Remaining Manual Actions

1. **GitHub repository name.** The remote is still
   `github.com/Madubuezejoshua/Panta-Pulse.git`. Renaming is a GitHub-side action and
   GitHub redirects the old URL, so nothing breaks either way. No file in this repository
   hardcodes the URL, so a rename needs no code change.

2. **Panta API account and key labels.** The live key was registered with Panta under the
   old name. `docs/REQUIRED_KEYS.md` now says `probasight`, which is correct for a fresh
   registration, but an already-issued key keeps the label it was minted with. Cosmetic,
   visible only in the Panta dashboard, no functional effect.

3. **Vercel project name.** Cosmetic, affects only the default deployment URL.

### Closed in this pass

- ~~Supply the ProbaSight logo asset~~ - supplied and wired in.
- ~~Open Graph image~~ - `src/app/opengraph-image.png`, 1200x630, verified served.
- ~~`npm ci` blocked~~ - stale process identified and ended; `npm ci` passes.
