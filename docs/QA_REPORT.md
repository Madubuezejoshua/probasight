# QA report

Written for: the project owner, and any reviewer checking what was actually verified.

**Ground rule for this document: nothing is marked verified unless it was executed.**
Anything that could not be run without live credentials, a funded wallet or a human
approving a wallet prompt is listed as *not executed*, with the reason.

Environment: Windows 11, Node 24.20.0, npm 11.19.0, Next.js 15.5.4.

---

## 1. Automated checks

| # | Command | Result | Detail | Blocker? |
| --- | --- | --- | --- | --- |
| 1 | `npm install` | **PASS** | Exit 0. 474 packages | No |
| 2 | `npx eslint .` | **PASS** | Exit 0. 0 errors, 0 warnings | No |
| 3 | `npx tsc --noEmit` | **PASS** | Exit 0. Strict mode, no errors | No |
| 4 | `npx vitest run` | **PASS** | 8 files, **115 tests**, all passing | No |
| 5 | `npx next build` | **PASS** | Compiled successfully. 5 pages + 21 API routes | No |

### Unit test coverage

| File | Tests | What it locks down |
| --- | --- | --- |
| `tests/format.test.ts` | 21 | USDC base-unit vs decimal formatting (Panta uses both), share base units, implied-percentage bounds, position value estimation including resolved settlement, amount parsing |
| `tests/errors.test.ts` | 12 | Panta error normalisation, HTTP-status fallback codes, retryability, rebuild codes, copy coverage for all 22 documented codes |
| `tests/ai-schema.test.ts` | 13 | JSON extraction from fenced/prose responses, schema rejection of partial, empty and wrong-typed output |
| `tests/validation.test.ts` | 19 | Zod route-input validation: base58 shapes, amount bounds, create-market time ordering, image-URL rules, documented query params only |
| `tests/ai-guard.test.ts` | 6 | Refusal of markets with no question text, the guard against the observed hallucination |
| `tests/display.test.ts` | 11 | Market-name resolution: title -> description -> id fallback, word-boundary truncation, never-empty guarantee |
| `tests/time.test.ts` | 17 | Both Panta timestamp wire formats (documented Unix integers AND the ISO-8601 strings the live catalog actually returns), countdown units, create-form numeric round-trip, quote-expiry maths |
| `tests/solana-transaction.test.ts` | 16 | Instruction decoding, order preservation, v0 compilation, fee-payer position, serialise round-trip, signing-error classification |

Tests deliberately cover the places where a silent bug is most expensive: a mis-scaled
amount, an invented price, a mis-compiled transaction, or a user rejection reported as a
network error. **No test signs a transaction, spends funds or creates a market.**

---

## 2. Live HTTP verification

Executed against a running production server (`next start`).

### 2.1 Page rendering: with no credentials configured

| Route | Status | Note |
| --- | --- | --- |
| `/` | 200 | Renders; market section shows honest error state |
| `/markets` | 200 | Renders; explorer shows honest error state |
| `/portfolio` | 200 | Renders; wallet-disconnected state |
| `/create` | 200 | Renders; falls back to documented category allowlist |
| `/nonexistent-page` | 404 | Styled not-found page |

**Result: PASS.** No page crashes when Panta is unconfigured, each degrades to an explicit
error state rather than a blank screen or fabricated data.

### 2.2 Unconfigured-credential handling

| Route | Status | Body |
| --- | --- | --- |
| `/api/panta/categories` | 503 | `{"error":{"code":"PANTA_NOT_CONFIGURED", …,"retryable":false}}` |
| `/api/panta/markets` | 503 | same |

**Result: PASS.**

### 2.3 Input validation

| Route | Input | Status | Code returned |
| --- | --- | --- | --- |
| `/api/panta/trade/quote` | invalid wallet | 400 | `VALIDATION_FAILED` + `fields.wallet` |
| `/api/panta/trade/quote` | negative amount | 400 | `VALIDATION_FAILED` + `fields.amountUsdc` |
| `/api/panta/trade/quote` | side `"maybe"` | 400 | `VALIDATION_FAILED` + `fields.side` |
| `/api/panta/trade/quote` | malformed JSON | 400 | `VALIDATION_FAILED` ("must be valid JSON") |
| `/api/panta/claims/winnings/build` | missing `marketId` | 400 | `VALIDATION_FAILED` + `fields.marketId` |
| `/api/panta/claims/creator-fees/build` | invalid wallet | 400 | `VALIDATION_FAILED` + `fields.wallet` |
| `/api/panta/create/quote` | `endTime` before `startTime` | 400 | `VALIDATION_FAILED` + `fields.endTime` |
| `/api/panta/create/quote` | `data:` URL image | 400 | `VALIDATION_FAILED` + `fields.imageUrl` |
| `/api/ai/market-analysis` | invalid `marketId` | 400 | `VALIDATION_FAILED` + `fields.marketId` |

**Result: PASS.** Every rejection returns structured field errors the UI renders inline.

### 2.4 Method enforcement

`GET` against `/api/panta/trade/quote`, `/api/panta/create/register` and
`/api/ai/market-analysis` all returned **405**. **Result: PASS.**

### 2.5 AI rate limiting

12 consecutive POSTs to `/api/ai/market-analysis`. The limiter engaged and returned **429**
with `AI_RATE_LIMITED` and a `retryAfterSeconds` value. The limit applied *before* any
upstream work. **Result: PASS.**

### 2.6 Live upstream integration: real Panta API

Executed against `https://live-api.panta.market/api/v1` using a **deliberately invalid** API
key. This exercises the entire real path. DNS, TLS, URL construction, trailing slashes,
header assembly, upstream response, error normalisation, without needing a valid key.

Direct upstream probe:

| Endpoint | Status | Body |
| --- | --- | --- |
| `GET /categories/` | 401 | `{"code":"UNAUTHORIZED","message":"authentication required or invalid"}` |
| `GET /markets/?limit=2` | 401 | same |

Through our own routes, with the bogus key configured:

| Our route | Status | Normalised result |
| --- | --- | --- |
| `/api/panta/categories` | 401 | `UNAUTHORIZED` + human message |
| `/api/panta/markets?limit=5` | 401 | `UNAUTHORIZED` |
| `/api/panta/markets/{id}` | 401 | `UNAUTHORIZED` |
| `/api/panta/positions?wallet=…` | 401 | `UNAUTHORIZED` |
| `/api/panta/wallet-trades?wallet=…` | 401 | `UNAUTHORIZED` |
| `/api/panta/trade/quote` (valid payload) | 401 | `UNAUTHORIZED` |
| `/api/panta/claims/winnings/build` | 401 | `UNAUTHORIZED` |
| `/api/panta/claims/creator-fees/build` | 401 | `UNAUTHORIZED` |
| `/api/panta/create/image` | 401 | `UNAUTHORIZED` |

**Result: PASS.** The Panta API is reachable, returns exactly the documented error envelope,
and our client maps it correctly. Request construction is confirmed correct end to end:
**the only thing standing between this and live data is a valid `PANTA_API_KEY`.**

Groq was probed the same way: `POST https://api.groq.com/openai/v1/chat/completions` with an
invalid key returns 401 `invalid_api_key`, which our code maps to `GROQ_NOT_CONFIGURED`.

### 2.7 Live verification with real credentials

Run against production Panta with a real `pk_test_` key and a real Groq key.

| Check | Result |
| --- | --- |
| `GET /account/` | **PASS**: account active, `canCreateMarkets: true` |
| `/api/panta/categories` | **PASS**: returns `["crypto","politics","sports","entertainment"]`. Note: 4 live categories, not the 8 in the docs example, the fallback list in `/create` exists for exactly this |
| `/api/panta/markets` | **PASS**: returns a real catalog row with live `yesPrice`/`noPrice` |
| `/api/panta/markets/{id}` | **PASS**: full detail incl. spot pricing |
| `/api/panta/markets/{id}/trades` | **PASS**: empty tape handled as an honest empty state |
| `/api/panta/positions` | **PASS**: empty array, rendered as the empty state |
| `/api/panta/wallet-trades` | **PASS** |
| `/api/panta/created-markets` | **PASS**: returns the account's created market |
| `/api/panta/trade/quote` | **PASS**: real `quoteId`, shares and fee returned |
| `/api/ai/market-analysis` | **PASS**: valid 7-section schema on the first attempt, no repair retry needed |
| Market detail page render | **PASS**: real title, real 50% implied pricing, real dates (after fix #6) |

**Sandbox scope.** A `pk_test_` key returns sandbox fixtures: one synthetic market, and
quotes carrying `"Test mode: this response uses sandbox fixtures and does not access Solana
mainnet."` Exercising real mainnet markets and real trading requires a key minted with
`env: "live"` (see `REQUIRED_KEYS.md`). This is a Panta environment distinction, not an
application limitation, the same code paths serve both.

**AI output quality on a near-empty market.** Asked to analyse a market with no trades and
no resolution metadata, the model correctly reported the resolution criteria as unavailable,
stated there was no observable participation, declined to characterise the underlying
question, and listed four specific data limitations. It invented nothing and recommended
nothing. This is the hardest case for the honesty constraints and they held.

### 2.8 Server log audit

Log lines take the form:

```
panta GET /markets/6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P/ status=401 code=UNAUTHORIZED ms=265
```

Grep for the configured key value across the full server log: **0 occurrences**.
Logs contain route, status, Panta code and duration, never a credential or a request body.
**Result: PASS.**

---

## 3. Security verification

| Check | Method | Result |
| --- | --- | --- |
| No secret value in client bundle | grep across `.next/static/` | **PASS**: none |
| No `process.env.<SERVER_VAR>` in client bundle | grep for `process.env.*` | **PASS**: zero matches |
| No `pk_*` / `gsk_*` material in bundle | regex scan | **PASS**: none |
| No Panta base URL in client bundle | grep `live-api.panta.market` | **PASS**: none |
| No Groq endpoint in client bundle | grep `api.groq.com` | **PASS**: none |
| No `X-Api-Key` construction in client | grep | **PASS**: none |
| `server-only` guards | 13 modules verified | **PASS** |
| `.env.local` gitignored | inspected `.gitignore` | **PASS** |
| No credentials committed | no `.env.local` exists | **PASS** |

**One expected match** was investigated: the literal string `GROQ_API_KEY` appears in the
market-detail chunk. It is the variable *name* rendered as operator help text
("Set `GROQ_API_KEY` on the server…"), not a value. Confirmed by inspecting the surrounding
bytes. Not a leak.

---

## 4. Bugs found and fixed during QA

| # | Bug | How found | Fix | Severity |
| --- | --- | --- | --- | --- |
| 1 | Sticky mobile trade bar visible until `lg` (1024px), but the page's extra bottom padding stopped at `sm` (640px), content could sit underneath the bar at tablet widths (640–1023px) | Responsive audit of breakpoint pairing | Changed `sm:pb-10` → `lg:pb-10` on the market detail container so padding persists exactly as long as the bar does | Medium, would have clipped the trade tape on tablets |
| 2 | Mobile navigation sheet anchored at `top-14` while the header grows to `h-16` from `sm` up, leaving an 8px gap in the 640–767px range | Same audit | Added `sm:top-16` to the sheet | Low, visual seam |
| 3 | Six redundant `eslint-disable` directives for rules not enabled in this config, reported as warnings | `npx eslint .` | Removed via `--fix`, then stripped the resulting trailing whitespace repo-wide | Low, lint noise |
| 4 | Four dead exports shipped in the source tree: `getConnection`, `categoryLabel`/`CATEGORY_LABELS`, `isValidPublicKey`, and a `handler` route wrapper no route used | Dead-export audit | Deleted the unused modules and helpers. `REBUILD_CODES` was *not* deleted, it was wired into `useTradeFlow` and `useCreateFlow`, replacing hand-written code comparisons, so expired-session handling now has one source of truth. The 5xx logging that lived in the unused `handler` was moved into `errorResponse`, which every route does use, so it is now actually reached | Low, no runtime effect, but dead code in a reviewed submission is a real cost |
| 13 | **A missing market returned HTTP 200 with 404 content.** `/markets/<bad-id>` rendered the correct "not found" page but with a 200 status, which misleads crawlers and uptime monitoring | Status-code sweep across page routes | Root-caused to the app-root `loading.tsx`: it creates a Suspense boundary above every route, so Next streams a 200 shell before `notFound()` can run. Verified by removing it (404 restored) and by proving a `markets/loading.tsx` re-broke it through cascade. Fixed with **route groups**: the homepage moved to `(home)/` and the markets list to `markets/(list)/`, each with its own loading boundary, so no boundary sits above `markets/[marketId]`. Loading skeletons are fully preserved and all three 404 cases now return 404 | Medium |
| 9 | **Markets with no question text could be sent to the model at all.** While testing AI output across live markets, a market rendering as nameless produced a summary naming a specific subject. That looked like a hallucination and was initially recorded as one. **On re-investigation it was not**: `GET /markets/` returns `title: ""` while `GET /markets/{id}/` returns the real title for the same market, and the AI route reads detail, so the model had the genuine question and used it correctly. The real defect was narrower: markets that are empty on *both* list and detail (still common, verified live) would be sent to the model anyway, and a model given no question is free to infer one | Live AI testing, then a list-vs-detail comparison that corrected the initial diagnosis | `hasAnalysableQuestion` now hard-guards the route, returning `MARKET_QUESTION_UNAVAILABLE` (422) when both title and description are empty. The context builder passes the **raw** title rather than a synthesised display name, which would itself have read to the model as a real title. Prompt rule 2b forbids inferring the subject from category, region, oracle feed names, id or timing, and states that oracle identifiers name a data source rather than the question. The UI hides the Analyze button and explains why. 6 regression tests | Medium, a latent path to fabricated analysis, closed before it could bite |
| 14 | **Cards named markets by id when Panta knew the question.** The list endpoint's empty `title` meant discovery cards fell back to `Market AESrMoZx…` even though detail held the real question | The same list-vs-detail comparison | `enrichMarketsWithPrices` now carries `title`, `description` and `oracle` across from detail alongside prices, for the bounded slice it already fetches. Only non-empty detail values overwrite list values | Medium, the catalog looked far emptier than it is |
| 10 | **Phase filter returned wrong results.** Panta's documented `status` parameter does not filter by phase against the live catalog: `status=primary` returned 9 cancelled + 36 resolved + 3 primary rows, and `status=resolved` returned 0 while 38 resolved markets existed. The UI's phase chips were therefore actively misleading | Live catalog testing per phase | Stopped sending `status` upstream. Phase is now filtered client-side on each row's real `phase` field, and the homepage does the same for its featured rail. `category`, which was verified to filter correctly, is still sent upstream | **High**: users saw "no markets" where 38 existed |
| 11 | **"Load more" was a dead button.** Panta's cursor does not advance: passing the returned `nextCursor` yields the identical page with the identical cursor, indefinitely. Client-side dedup meant clicking Load More appended nothing, forever | Pagination walk (12 pages, 50 unique markets total) | Load-more now detects a page that yields zero new rows, retires the button and shows "End of the Panta catalog for this filter" | Medium, a visibly dead control |
| 12 | **`createdBy=me` is broken upstream.** Returns `400 INVALID_MARKET_PARAMS ("limit must be an integer")` for every value of `limit`, and also when `limit` is omitted entirely. The Created Markets tab failed outright | Live route sweep | Added a fallback: the route tries the documented path, and on failure derives the same set from the general catalog filtered on `createdByPartner`, which the docs define as the same relationship. Reports which path produced the result | Medium, a whole portfolio tab was broken |
| 8 | **Every market name rendered blank on the live catalog.** Production Panta returns `title` as an **empty string** on every market; the actual question lives in `description`. Cards, the market `<h1>`, portfolio rows, the mobile sheet and the AI context all rendered empty. The sandbox catalog *does* populate `title`, so this was invisible until a `pk_live_` key was used | Live mainnet testing with a `pk_live_` key | Added `lib/panta/display.ts` with `marketTitle` (title -> description -> truncated id, never empty), `marketSubtitle` (suppresses the description when it is already the heading) and `marketInitial`. Routed all nine render sites plus the AI context through it. Homepage now orders named markets first, ordering, not filtering; unnamed markets still appear on `/markets` and still fill leftover slots. 11 regression tests | **High**: the product looked broken on real data |
| 6 | **Every date on the market page rendered as "N/A".** Panta's docs describe `startTime`/`endTime`/`resolutionTime` as *integer Unix seconds*, but the live catalog returns **ISO-8601 strings** (`"2026-01-01T00:00:00Z"`). `unixToDate` rejected non-numeric input, so all five date fields silently fell back to the unavailable marker | **Live API testing with a real key**: impossible to catch without one | Rewrote `unixToDate` to accept integer seconds, numeric strings and ISO-8601. Widened the catalog types and every formatter signature. Fixed the AI context builder's own copy of the helper so the model is not handed a bogus 1970 timestamp. Added `tests/time.test.ts` (17 tests) pinning both wire formats. Unavailable markers on the market page dropped 14 → 4 | **High**: the showpiece page was missing all timing data |
| 7 | **Default Groq model was decommissioned.** `llama-3.3-70b-versatile` returns 404 `model_not_found`; the AI panel failed entirely | Live Groq call with a real key | Queried Groq's live model list and switched the default to `openai/gpt-oss-120b`, verified to support JSON mode. Deliberately avoided `groq/compound*`, which has **built-in web search** and would break the guarantee that analysis is grounded only in the Panta snapshot | **High**: the originality feature was completely broken |
| 5 | Two orphaned API routes. `/api/panta/trades/{signature}` (attribution status) and `/api/panta/categories` were built and working, but nothing in the product called them. The first left the **Panta attribution loop open**: a trade reporting as `pending_attribution` had no way to be re-checked. The second meant a failed server-side category fetch left the filter row permanently empty with no recovery path | Route-reachability scan: every route grepped against product code | Built `AttributionStatus`, a bounded, decelerating poll (2s/6s/15s/30s) that stops as soon as the status settles, then hands the user a manual re-check. Wired into both the trade success panel and the win-claim success state. Added a client-side category retry to `MarketsExplorer`. All 20 routes are now reachable from the product | **Medium**: attribution is a judged criterion and the loop was not closable |

All fourteen were fixed and the full gate (lint, typecheck, tests, build) re-run clean
afterwards.

---

## 5. Design-decision verification

Checks confirming the honest-data rules actually hold in code, not just in intent:

| Rule | Verified how | Result |
| --- | --- | --- |
| Missing values never become zero | Unit tests assert `N/A` for null/undefined/empty across every formatter | **PASS** |
| Out-of-range price yields no percentage | `priceToImpliedPercent("1.4")` returns `null` | **PASS** |
| Resolved markets use settlement, not stale spot | Dedicated test: 10 shares, winner, spot 0.5 → value 10, not 5 | **PASS** |
| No P&L anywhere | grep for P&L/profit computation in `src/` | **PASS**: none exists |
| No fabricated chart | Chart refuses to draw below 2 timestamped trades; labelled as share flow, not price | **PASS** |
| Partial AI output never rendered | Schema test rejects missing sections and empty arrays | **PASS** |
| Creator-fee claims not reported to `/trades/` | `useClaimFlow` branches on `kind`; reporting is win-claim only | **PASS** (code review) |
| "Powered by Panta" on every Panta surface | Present on home, markets, market detail, trade panel, AI panel, portfolio, create, footer | **PASS** |

---

## 6. Responsive verification

**Method: structural/code audit, not visual browser testing.** Stated plainly because it is a
real limitation of what could be verified tonight.

| Check | Result |
| --- | --- |
| Fixed pixel widths that could overflow 360px | **PASS**: all `[1440px]` occurrences are `max-w-`, not fixed widths |
| Every `<table>` has a mobile alternative | **PASS**: both tables pair `hidden sm:block` with an `sm:hidden` card list |
| `min-w-0` on flex children holding long text | **PASS**: present across 7 components |
| `overflow-x: hidden` guard on body | **PASS** |
| Horizontally-scrolling filter rows on mobile | **PASS**: `overflow-x-auto` on category and phase chips |
| Breakpoint pairing of sticky bar and padding | **PASS after fix #1** |
| Safe-area insets for the mobile sheet | **PASS**: `env(safe-area-inset-bottom)` on the bar and sheet |

**Not executed:** visual rendering at 360 / 390 / 430 / 768 / 1024 / 1440px in a real
browser. This needs a human or a headless browser and is step 11 of the E2E procedure in
`REQUIRED_KEYS.md`.

---

## 7. Not executed: and why

Everything in this section is blocked on credentials, funds, or a human approving a wallet
prompt. None of it can be honestly claimed as tested.

| Area | Blocked by | Where it is covered |
| --- | --- | --- |
| Live market data rendering | `PANTA_API_KEY` | E2E steps 1–2 |
| AI analysis output quality | `GROQ_API_KEY` | E2E step 3 |
| Groq model id currently served | `GROQ_API_KEY` | Overridable via `GROQ_MODEL` |
| Wallet connect / disconnect | Browser wallet extension | E2E step 4 |
| Wallet rejection path | Human declining a prompt | E2E step 5 |
| Real trade execution | Funded wallet + approval | E2E step 6 |
| Panta trade attribution | A real signature | E2E step 7 |
| Win claim | A resolved market where the wallet holds the winning side | E2E step 8 |
| Market creation | Creation fee in USDC | E2E step 9 |
| Creator-fee claim | A graduated market with accrued fees | E2E step 10 |
| Blockhash-expiry recovery | A slow real signature | Code path implemented; not triggered |
| Wrong-network behaviour | Live wallet on a mismatched cluster | Not triggered |

The transaction-construction logic these flows depend on **is** unit-tested (instruction
decoding, v0 compilation, fee payer, round-trip, error classification), and the request path
to Panta is verified live in §2.6. What remains unverified is the wallet-signature step and
the upstream responses that require a valid key.

---

## 7a. Upstream Panta defects worked around

These are defects in the live Panta API, verified by reproducing each one with plain
`curl` outside this application. Each is handled rather than passed through to the user.

| Defect | Evidence | How this app handles it |
| --- | --- | --- |
| `status` does not filter by phase | `status=primary` -> 9 cancelled + 36 resolved + 3 primary; `status=resolved` -> 0 rows while 38 resolved markets exist | Parameter not sent; phase filtered client-side on the real `phase` field |
| Cursor does not advance | Passing `nextCursor` returns the identical page and the identical cursor, indefinitely (12 pages walked, 50 unique markets) | Load-more retires itself when a page yields no new rows |
| `createdBy=me` always 400s | `"limit must be an integer"` for limit=50, limit=20 and with no limit at all | Falls back to the catalog filtered on `createdByPartner` |
| `title` empty on every live row | Question lives in `description` instead | `marketTitle` resolves title -> description -> id |
| Timestamps differ by environment | Live returns Unix integers; sandbox returns ISO-8601 strings | `unixToDate` accepts both |
| Create quote/build return opaque failures | `"unexpected create quote failure - check server logs"` | `CreateFailureHint` names the causes actually observed (unreachable image URL, wallet with no USDC token account, duplicate question) |
| Some markets have no question at all | Empty `title` AND empty `description` | AI analysis refused; card falls back to the market id |

None of these required a database, a scraper, or fabricated data to work around.

## 8. Known non-blocking issues

1. **AI rate limiter is in-process.** Per-instance on serverless rather than a global quota.
   Adequate for abuse-resistance at this scale; a shared store would need a dependency the
   spec rules out.
2. **Position valuation fans out** to one market-detail call per distinct market, capped at
   24 per request. Beyond that the response sets `truncatedMarketLookups` and the UI says so.
3. **Created Markets is account-scoped** where Panta does not expose `creatorAddress`. The UI
   discloses this; Panta enforces ownership on the claim itself.
4. **Groq model ids change.** The default `openai/gpt-oss-120b` was verified against
   Groq's live model list; `GROQ_MODEL` overrides it if that changes.
5. **Public Solana RPC default** is heavily rate-limited. A dedicated RPC is strongly
   recommended before any real trading.

---

## 9. Summary

| Category | Status |
| --- | --- |
| Install | **PASS** |
| Lint | **PASS**: 0 errors, 0 warnings |
| Typecheck | **PASS**: strict, 0 errors |
| Unit tests | **PASS**: 115/115 |
| Production build | **PASS**: 5 pages, 21 API routes |
| Route validation | **PASS**: all cases |
| Method enforcement | **PASS** |
| Rate limiting | **PASS** |
| Live upstream request path | **PASS**: verified against the real Panta API |
| Secret containment | **PASS**: nothing in the client bundle or logs |
| Responsive structure | **PASS** (code audit; visual pass outstanding) |
| Route reachability | **PASS**: all 20 routes called from the product, 0 orphaned |
| Transient-failure path | **PASS**: an unplanned real DNS failure during testing was correctly classified `UPSTREAM_UNREACHABLE`, marked retryable, returned 504, and recovered on retry |
| Live data / wallet / funded flows | **NOT EXECUTED**: needs keys, a wallet and funds |

**No blocking defects are known.** Every issue found during QA was fixed and re-verified.
The remaining work is the credentialed end-to-end pass in `REQUIRED_KEYS.md` §5.
