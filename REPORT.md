# Panta Pulse — Final Audit Report

Written for: the project owner, and any Colosseum / Panta Sidetrack judge opening this
repository.

**Ground rule for this document: every PASS has evidence from something actually executed.**
A code path existing is not proof that it ran. Anything that could not be executed —
because it needs a funded wallet, a human wallet approval, or a market state that does not
currently exist — is marked **BLOCKED**, never PASS.

Audit environment: Windows 11, Node 24.20.0, npm 11.19.0, Next.js 15.5.4.
Panta key in use: `pk_live_…` (production catalog). Groq key configured. Helius mainnet RPC.

---

## 1. Executive Summary

Panta Pulse is a working, non-custodial prediction-market intelligence and trading terminal
built on the Panta public API. All 18 Panta endpoints this integration needs are wired to
real product surfaces and verified against the live production API.

**Final state.** Every read path, the AI layer, and the trading lifecycle **up to the wallet
signature** are executed and verified against production. A real Panta `build` response was
compiled through the application's own code into a valid 696-byte v0 Solana transaction
carrying Panta's on-chain attribution memo. The only unexecuted step is the signature
itself, which requires a funded wallet and a human approval.

**Demo readiness: ready.** A judge can open the app and see real Panta markets, real
pricing, real trade tape, and a live AI analysis without any wallet.

**Production readiness: ready, with one external caveat.** The application is correct and
deployable. The caveat is upstream: Panta's production API intermittently returns a
detail-less `400` for valid requests (measured below). This audit added error
reclassification and bounded retry for idempotent reads, which raised market-detail
reliability from **75% raw to 12/12 through the application**.

**Unresolved blockers:** none in software. Two external prerequisites remain, both yours:
a funded wallet for the signature, and a resolved market where you hold the winning side
for a live claim demo.

---

## 2. Final Verdict

> **Ready with manual final transaction verification remaining.**

Why this category and not "Ready": no real transaction has been signed or broadcast. Every
step that leads to the signature is verified against production, and the transaction that
would be signed has been constructed and validated. But signing needs your wallet and your
funds, so claiming a completed on-chain trade would be a fabrication.

Why not "Not ready": nothing is missing or broken in the software. Lint, typecheck, 129
tests and the production build all pass; all five pages and all 20 API routes respond
correctly against live production data.

---

## 3. Bounty Requirement Matrix

| Requirement | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Working demo or compelling prototype | **PASS** | All 5 pages return 200 against live production Panta; homepage 110 KB / 0.15 s, markets 282 KB / 0.65 s, market detail 90 KB / 0.62 s | Fully browsable with no wallet |
| Panta used meaningfully | **PASS** | 18 of 18 endpoints wired to real surfaces; path-by-path diff against current `llms.txt` shows exact match | Remove Panta and no product remains |
| Demonstrates what prediction-market infra enables | **PASS** | AI intelligence layer + trading + creation + claims over one API | See §4 Originality |
| Market discovery | **PASS** | `GET /markets/` 8/8 OK; 50 markets rendered on `/markets` | |
| Market browsing / filters | **PASS** | Category filter verified server-side (`sports`→50/50 sports, `crypto`→9/9 crypto); phase filtered client-side (see Bug 10) | |
| Market information | **PASS** | `GET /markets/{id}/` renders title, phase, timing, volume, resolution | |
| Market prices / data | **PASS** | Live `yesPrice` 0.500078865 / `noPrice` 0.499921135 rendered as 50% / 50% | |
| Market trades / activity | **PASS** | `GET /markets/{id}/trades/` 8/8 OK; tape and flow chart render | |
| Market creation | **PARTIAL** | Quote executed live: `createId=cr_f3970da3…`, fee 50.00 USDC. Build returns an upstream error for a wallet with no USDC token account | Full path needs a funded wallet |
| Market creation fee quote | **PASS** | Real quote: `paymentUsdc` 50000000 = 50.00 USDC (10.00 liquidity + 40.00 platform), `expectedEventPda` returned | |
| Building transactions | **PASS** | `POST /primaryorderbuild/` returned `orderId=ord_ae23ba9d…`, 2 instructions, blockhash, `lastValidBlockHeight` | |
| Buying YES | **BLOCKED** | Verified through build + local compile; signature needs funded wallet | See §19 |
| Buying NO | **BLOCKED** | Same code path, side parameter validated (`yes`/`no`, case-insensitive) | See §19 |
| Wallet positions | **PASS** | `GET /positions/` 8/8 OK; empty array renders the honest empty state | No position exists to display yet |
| Wallet activity / trades | **PASS** | `GET /wallets/{w}/trades/` 8/8 OK | |
| Claim eligibility | **PASS** | `claim/build` correctly refuses with `NOT_CLAIMABLE` for a non-holder | Correct refusal is the evidence |
| Winnings claim tx building | **BLOCKED** | Build path reached and refused correctly; a real build needs a winning position | |
| Creator fee claims | **PASS (refusal verified)** | `claim/creator-fees/build` returns `NOT_MARKET_CREATOR` for a non-creator | Correctly does **not** post to `/trades/` |
| Trade attribution / reporting | **PASS** | Panta's own attribution memo decoded from a real build: `panta:v1:usr_cWKvy-Yl_9oRIbtZcGnzug:qt_49efa64d…:ord_ae23ba9d…` | Explicit `POST /trades/` also implemented |
| Trade verification | **PASS** | `GET /trades/{sig}/` returns `{"status":"unknown"}` for an unseen signature; wired to a live UI poll | |
| Powered by Panta | **PASS** | Exact string on home (×2), markets, market detail, trade panel, AI panel, portfolio, create, footer | Terms §6 wording, unmodified |

---

## 4. Judging Criteria

### 4.1 Panta API Integration

**Verdict: deeply integrated; Panta is load-bearing, not decorative.**

Path-by-path diff against the current `llms.txt` (re-fetched during this audit, unchanged
at 43 lines) shows **all 18 endpoints match exactly**:

| Panta endpoint | Powers |
| --- | --- |
| `GET /categories/` | Markets filter chips, create-market category field |
| `GET /markets/` | Homepage rail, markets grid, created markets |
| `GET /markets/{id}/` | Market detail, card pricing + titles, position valuation |
| `GET /markets/{id}/trades/` | Activity chart, trade tape, AI context |
| `GET /wallets/{w}/trades/` | Portfolio → Activity |
| `GET /positions/?wallet=` | Portfolio → Open + Claimable |
| `POST /primaryorderquote/` | Trade quote preview |
| `POST /primaryorderbuild/` | Trade build, pre-signature |
| `POST /primaryordersubmit/` | Post-broadcast submission |
| `POST /primaryorderverify/` | Final order status |
| `POST /trades/` | Attribution for buys and win claims |
| `GET /trades/{sig}/` | Live attribution status poll |
| `POST /claim/build/` | Claim winnings |
| `POST /claim/creator-fees/build/` | Claim creator fees |
| `POST /markets/create/image-upload/` | Image upload |
| `POST /markets/create/quote/` | Creation fee quote |
| `POST /markets/create/build/` | Creation transaction |
| `POST /markets/register/` | Post-broadcast registration |

**Architecture.** The browser never holds the developer key. Every authenticated call is
proxied through this application's own route handlers. 13 modules carry `import "server-only"`,
so a client component importing one fails the build rather than leaking at runtime.
Bundle scan: **0** secret values, **0** server `process.env` references, **0** occurrences of
the Panta base URL, the Groq endpoint, or the `X-Api-Key` header in client JavaScript.

**Attribution asymmetry implemented correctly.** Primary buys and win claims are reported to
`POST /trades/`; creator-fee claims deliberately are not, because Panta rejects those
signatures with `TX_MISMATCH`. Verified in `useClaimFlow.ts`, which branches on claim kind.

### 4.2 Technical Execution

**Verdict: strong.** Evidence:

- **Both Panta transaction shapes handled.** Instruction lists (buy, claims) compiled to a v0
  transaction; an assembled base64 transaction (creation) deserialised. A real build response
  was compiled through the app's own logic: version 0, blockhash preserved, fee payer at
  `staticAccountKeys[0]`, 1 required signature, **696 bytes** (within the 1232 limit),
  survives a serialise/deserialise round trip.
- **Post-broadcast boundary handled deliberately.** Once a transaction lands, a later failure
  is a bookkeeping problem, not a lost trade — the UI says exactly that and shows the
  signature rather than a generic error.
- **Expiry handled.** Quote (~90 s), order (~120 s) and create session (~5 min) counted down
  in the UI and invalidated on expiry; `REBUILD_CODES` drives discard-and-requote.
- **Signing errors classified.** Wallet rejection (`code 4001`, `WalletSignTransactionError`,
  message variants) is distinct from RPC failure, blockhash expiry, insufficient funds and
  on-chain revert. 16 unit tests cover this.
- **Upstream instability absorbed.** See Bugs 15 and 16 — this audit's most substantive fix.
- **Quality gate:** lint 0 errors / 0 warnings, `tsc --noEmit` 0 errors (strict),
  **129 tests across 9 files**, production build clean, 102 kB shared First Load JS.

### 4.3 Product & User Experience

**Verdict: strong, with one honest upstream-data caveat.**

- Public browsing with no login; a judge sees real markets immediately.
- Pricing readable: 0.500078865 USDC/share rendered as **50%** with the USDC price beneath.
- One obvious trade flow, scoped exactly to what the API supports — no fake limit orders.
- Mobile trade ticket is a real `role="dialog"` bottom sheet with focus trap, Escape,
  scroll lock and safe-area insets.
- No dead buttons: all 20 API routes are reachable from the product (verified by grepping
  every route against the codebase); "Load more" retires itself when the catalog ends.
- No placeholder content, no lorem ipsum, no "coming soon".
- **Caveat:** 42 of 50 live catalog rows carry no question text on the list endpoint. This is
  upstream data, not a UI bug. Mitigated by Bug 14 — detail is now merged into cards, turning
  8 of the 12 enriched cards into real questions. Genuinely nameless markets fall back to
  their id rather than an invented title.

### 4.4 Originality

**Verdict: genuine intelligence layer, not a listings frontend.**

Verified by live execution against three different real markets — all returned a
schema-valid 7-section analysis on the first attempt, no repair retry needed:

- Receives **only** real Panta context (catalog row + trade tape). No news API, no web search.
- Missing fields are passed as the literal string `"unavailable"`, so the model is told what
  it does not know instead of guessing.
- Output is strict JSON validated with Zod; a schema miss gets exactly one repair attempt,
  then errors rather than rendering malformed text as trusted content.
- Refuses outright on markets with no question text (`MARKET_QUESTION_UNAVAILABLE`), because
  a model given no question will infer one.
- Never recommends a trade; politically neutral by system instruction.

Quality on real data — it caught something a reader would miss:

> *"Four trades occurred in a brief window, **all from a single wallet**."*
> *"Trade-by-trade USDC amounts are not provided, **preventing price impact analysis**."*

The same principle governs the chart: Panta trade rows carry share quantities and fees but
never the USDC spent, so a price line is not derivable. Rather than fake one, the page plots
**cumulative YES/NO share flow** — genuinely derivable — and says why.

### 4.5 Impact Potential

**Verdict: category-agnostic by construction.**

Zero hardcoded market ids or category-specific code paths exist outside tests. The live
catalog exercised during this audit spans **sports, crypto, politics, weather, finance and
entertainment**, all rendered by the same components. Categories are fetched from
`GET /categories/` rather than hardcoded, with the documented allowlist used only as a
fallback when that call fails.

### 4.6 Traction Readiness

**Verdict: technically ready to measure; nothing fabricated.**

Attribution is correctly wired, so trades routed through Panta Pulse are attributable to
this API account and readable from `GET /account/metrics/`. Panta also embeds its own
attribution memo on-chain, decoded above.

No analytics backend was built. See §20 for exactly what to collect and how.

---

## 5. Route Audit

Executed against a production build with live production Panta data.

| Route | HTTP | Size | Time | Result |
| --- | --- | --- | --- | --- |
| `/` | 200 | 110 KB | 0.145 s | PASS — real markets, hero, AI showcase, how-it-works |
| `/markets` | 200 | 282 KB | 0.649 s | PASS — 50 cards, filters, search |
| `/markets/{id}` | 200 | 90 KB | 0.619 s | PASS — header, pricing, chart, AI, tape, trade rail |
| `/portfolio` | 200 | 24 KB | 0.297 s | PASS — wallet-disconnected state |
| `/create` | 200 | 32 KB | 0.237 s | PASS — form, preview, live categories |
| `/markets/not-valid` | **404** | — | — | PASS — malformed id |
| `/markets/{valid-but-missing}` | **404** | — | — | PASS |
| `/nope` | **404** | — | — | PASS |

Browser-console and hydration checks were **not executed** — no headless browser was
available in this environment. The production build reports no hydration or React warnings,
and no `useEffect`/render loops were found by inspection, but this is a code-level result,
not a browser observation. Marked **BLOCKED — requires a browser session**.

---

## 6. API Audit

All **20** internal routes enumerated from the filesystem (not assumed).

### Read routes

| Route | Valid | Invalid | POST (405) |
| --- | --- | --- | --- |
| `/api/panta/categories` | 200 | 200 (no params) | 405 |
| `/api/panta/markets` | 200 | 400 | 405 |
| `/api/panta/markets/[id]` | 200 | 400 | 405 |
| `/api/panta/markets/[id]/trades` | 200 | 400 | 405 |
| `/api/panta/positions` | 200 | 400 | 405 |
| `/api/panta/wallet-trades` | 200 | 400 | 405 |
| `/api/panta/created-markets` | 200 | 400 | 405 |
| `/api/panta/trades/[signature]` | 200 | 400 | 405 |

### Mutating routes — validation matrix

| Route | Case | HTTP | Code |
| --- | --- | --- | --- |
| `trade/quote` | valid | 200 | — |
| `trade/quote` | invalid wallet | 400 | `VALIDATION_FAILED` |
| `trade/quote` | invalid marketId | 400 | `VALIDATION_FAILED` |
| `trade/quote` | invalid side | 400 | `VALIDATION_FAILED` |
| `trade/quote` | zero amount | 400 | `VALIDATION_FAILED` |
| `trade/quote` | negative amount | 400 | `VALIDATION_FAILED` |
| `trade/quote` | excess precision (7 dp) | 400 | `VALIDATION_FAILED` |
| `trade/quote` | missing amount | 400 | `VALIDATION_FAILED` |
| `trade/quote` | malformed JSON | 400 | `VALIDATION_FAILED` |
| `trade/build` | unknown quoteId | 400 | `QUOTE_EXPIRED` |
| `trade/submit` | bad signature | 400 | `VALIDATION_FAILED` |
| `trade/verify` | unknown orderId | 400 | `QUOTE_EXPIRED` |
| `trades/report` | bad signature | 400 | `VALIDATION_FAILED` |
| `claims/winnings/build` | non-holder | 400 | `NOT_CLAIMABLE` |
| `claims/creator-fees/build` | non-creator | 400 | `NOT_MARKET_CREATOR` |
| `create/image` | valid | 200 | real Cloudinary form |
| `ai/market-analysis` | invalid marketId | 400 | `VALIDATION_FAILED` |
| `ai/market-analysis` | rate limit (12 rapid) | 429 | `AI_RATE_LIMITED` |

**Secret leakage:** no response body contained a credential, stack trace or upstream request
body. Server logs carry route, status, Panta code and duration only; grep for the configured
key across the full server log returned **0** occurrences.

---

## 7. Panta Integration Audit

Executed live against `https://live-api.panta.market/api/v1`.

### Per-endpoint reliability (raw upstream, 8 spaced calls each)

| Endpoint | Result |
| --- | --- |
| `GET /categories/` | **8/8** |
| `GET /markets/` | **8/8** |
| `GET /markets/{id}/` | **6/8** |
| `GET /markets/{id}/trades/` | **8/8** |
| `GET /positions/` | **8/8** |

Through the application, with the retry added by this audit: market detail **12/12**, and the
market detail page **8/8**.

### Upstream defects found and worked around

Each reproduced with plain `curl` outside the application, so none are our bugs.

| Defect | Evidence | Handling |
| --- | --- | --- |
| Detail-less `400 INVALID_MARKET_PARAMS` on valid requests | Identical trade-status request alternated 200/400 across 8 consecutive calls; persisted after a 90 s cooldown, so not rate limiting | Reclassified `UPSTREAM_TRANSIENT`, retryable; GET auto-retried (Bugs 15, 16) |
| `status` does not filter by phase | `status=primary` → 9 cancelled + 36 resolved + 3 primary; `status=resolved` → 0 while 38 resolved exist | Parameter not sent; phase filtered client-side on the real field |
| Cursor does not advance | 12 pages walked, same 50 markets, same cursor every time | Load-more retires when a page yields no new rows |
| `createdBy=me` always 400s | `"limit must be an integer"` for limit=50, limit=20 and with no limit | Falls back to catalog filtered on `createdByPartner` |
| `title` empty on list rows | Same market: `title: ""` on list, real question on detail | `marketTitle` resolves title → description → id; detail merged into cards |
| Timestamps differ by environment | Live returns Unix integers; sandbox returned ISO-8601 | `unixToDate` accepts both |
| Some markets have no question at all | Empty `title` **and** `description` on both list and detail | AI refuses; card falls back to id |

None of these required a database, a scraper, or fabricated data.

---

## 8. Solana / Wallet Audit

| Check | Result |
| --- | --- |
| RPC configured | **PASS** — Helius mainnet; `getHealth` ok, `getSlot` 448,420,683, real blockhash returned |
| Network handling | **PASS** — wallet adapter cluster detection falls through to `solana:mainnet` for the Helius URL (verified in the built bundle) |
| Instruction conversion | **PASS** — 16 unit tests: base64 decode, account metadata, order preservation |
| v0 transaction construction | **PASS** — real build compiled: version 0, blockhash preserved, fee payer first, 1 signature, 696 bytes, round-trips |
| Attribution memo | **PASS** — decoded from the real build: `panta:v1:usr_…:qt_…:ord_…` |
| Wallet signing | **BLOCKED** — requires a human approval in Phantom/Solflare |
| Broadcast | **BLOCKED** — requires a funded wallet |
| Confirmation logic | **PASS (code + tests)**, **BLOCKED (live)** — uses Panta's `lastValidBlockHeight` |
| Blockhash expiry | **PASS (classified + tested)**, **BLOCKED (live trigger)** |
| Explorer links | **PASS** — Solscan, cluster suffix derived from `NEXT_PUBLIC_SOLANA_NETWORK` |
| Private key / seed handling | **PASS** — 0 occurrences of `secretKey`, `privateKey`, `mnemonic`, `seedPhrase` anywhere in `src/` |

---

## 9. AI Audit

| Check | Result |
| --- | --- |
| Valid market context → analysis | **PASS** — 3 different live markets, all schema-valid first attempt |
| Structured 7-section output | **PASS** — summary, current view, activity, YES case, NO case, uncertainties, limitations |
| Grounded only in Panta data | **PASS** — context builder passes catalog row + tape; missing fields sent as `"unavailable"` |
| No invented external news | **PASS** — no news API or web search exists in the codebase; system prompt forbids external facts |
| Refuses markets with no question | **PASS** — returns `MARKET_QUESTION_UNAVAILABLE` (422); UI hides the Analyze button and explains |
| Malformed model response | **PASS (unit)** — 13 schema tests reject partial, empty-array and wrong-typed output |
| Repair retry | **PASS (code + unit)** — one repair attempt, then error rather than rendering raw text |
| Groq unavailable | **PASS (observed)** — a transient failure surfaced as `AI_UNAVAILABLE`, `retryable: true`, with a retry button; retry succeeded |
| AI failure does not crash the page | **PASS** — market detail returned 200 while the AI panel showed its error state |
| Secret server-side | **PASS** — `GROQ_API_KEY` read only in a `server-only` module; 0 occurrences in the client bundle |
| No trade recommendation | **PASS** — system prompt forbids it; no recommendation appeared in any of the three analyses |

**Model note:** the default is `openai/gpt-oss-120b`, verified against Groq's live model list.
`groq/compound*` models are deliberately excluded — they carry built-in web search, which
would break the guarantee that analysis uses only the Panta snapshot.

---

## 10. E2E Results

### Journey 1 — discover → analyse → trade

| Step | Status | Evidence |
| --- | --- | --- |
| Open homepage | **EXECUTED** | 200, real markets rendered |
| Explore markets | **EXECUTED** | 50 live markets |
| Filter by category | **EXECUTED** | `crypto` → 9/9 crypto rows |
| Filter by phase | **EXECUTED** | client-side on the real `phase` field |
| Open a market | **EXECUTED** | 200, real pricing and timing |
| Inspect activity | **EXECUTED** | real trade tape + flow chart |
| Run AI analysis | **EXECUTED** | schema-valid analysis on 3 markets |
| Connect wallet | **BLOCKED** | browser extension + human action |
| Request quote | **EXECUTED** | `qt_49efa64d…`, 1.996363 shares, avg 0.50091, fee 0.02 |
| Build transaction | **EXECUTED** | `ord_ae23ba9d…`, 2 instructions, blockhash |
| Compile transaction | **EXECUTED** | 696-byte v0 tx, 1 signature, memo decoded |
| **Wallet signature** | **BLOCKED** | funded wallet + human approval |
| Broadcast / confirm / submit / report | **BLOCKED** | depends on the signature |

> **E2E complete through the wallet-approval boundary.** No transaction has been signed or
> broadcast.

### Journey 2 — portfolio

| Step | Status | Evidence |
| --- | --- | --- |
| Disconnected state | **EXECUTED** | 200, connect prompt rendered |
| Positions fetch | **EXECUTED** | `GET /positions/` 8/8, empty array → empty state |
| Wallet activity | **EXECUTED** | `GET /wallets/{w}/trades/` 200 |
| Created markets | **EXECUTED** | 200 via `partnerFlag` fallback |
| Claimable state | **EXECUTED (refusal)** | `NOT_CLAIMABLE` correctly returned |
| Claim signature | **BLOCKED** | needs a winning position |

### Journey 3 — create market

| Step | Status | Evidence |
| --- | --- | --- |
| Categories load | **EXECUTED** | 8 live categories |
| Form validation | **EXECUTED** | time ordering, data-URL image, length limits all rejected |
| Image upload signature | **EXECUTED** | real Cloudinary form returned |
| Creation fee quote | **EXECUTED** | `cr_f3970da3…`, 50.00 USDC (10 + 40), `expectedEventPda` |
| Build | **BLOCKED** | upstream error for a wallet with no USDC token account |
| Sign / broadcast / register | **BLOCKED** | costs a real 50 USDC fee |

---

## 11. Automated Tests

| Check | Command | Result |
| --- | --- | --- |
| Lint | `npx eslint .` | **PASS** — 0 errors, 0 warnings |
| Typecheck | `npx tsc --noEmit` | **PASS** — 0 errors, strict mode |
| Unit tests | `npx vitest run` | **PASS — 129 passed / 129, 9 files** |
| Production build | `npx next build` | **PASS** — 28 routes, 102 kB shared First Load JS |

| Test file | Tests | Covers |
| --- | --- | --- |
| `format.test.ts` | 21 | USDC base-unit vs decimal, share base units, implied-percent bounds, position valuation incl. settlement |
| `validation.test.ts` | 19 | Zod route inputs: base58, amount bounds, create time ordering, image URL rules |
| `errors.test.ts` | 18 | Error normalisation, status fallbacks, retryability, transient reclassification |
| `time.test.ts` | 17 | Both Panta timestamp wire formats, countdowns, quote expiry maths |
| `solana-transaction.test.ts` | 16 | Instruction decode, order, v0 compile, fee payer, round-trip, signing-error classification |
| `ai-schema.test.ts` | 13 | JSON extraction, rejection of partial/empty/wrong-typed output |
| `display.test.ts` | 11 | Market-name resolution and truncation |
| `panta-client-retry.test.ts` | 8 | GET retries transient, POST never does, real validation errors never retried, fail-closed without a key |
| `ai-guard.test.ts` | 6 | Refusal of markets with no question text |

**No test signs a transaction, spends funds, or creates a market.**

---

## 12. Responsive Audit

**Method: code and breakpoint audit, not visual browser testing.** No headless browser was
available. Stated plainly rather than implied.

| Check | Result |
| --- | --- |
| Fixed widths that could overflow 360px | **PASS** — every `[1440px]` is `max-w-`, never a fixed width |
| Tables have a mobile alternative | **PASS** — both tables pair `hidden sm:block` with an `sm:hidden` card list |
| `min-w-0` on flex children with long text | **PASS** — present across 7 components |
| `overflow-x: hidden` guard on body | **PASS** |
| Horizontally scrolling filter rows | **PASS** — `overflow-x-auto` on category and phase chips |
| Sticky bar / padding breakpoint pairing | **PASS** — fixed in a prior session (Bug 1) |
| Safe-area insets on the mobile sheet | **PASS** — `env(safe-area-inset-bottom)` on bar and sheet |
| Desktop sticky trade rail | **PASS** — `hidden lg:block` + `sticky top-20` |

**Not executed:** visual rendering at 360 / 390 / 430 / 768 / 1024 / 1440 px.
**BLOCKED — requires a browser session.** Step 11 of §19 covers it.

---

## 13. Accessibility Audit

**Method: code audit.** 87 accessibility attribute usages across 19 files.

| Check | Result |
| --- | --- |
| Icon-only buttons labelled | **PASS** — 6 `aria-label`s for 2 icon buttons in the header |
| Every form control has a label | **PASS** — all 12 `htmlFor` values have a matching input `id` (verified pairwise) |
| Search inputs labelled | **PASS** — `aria-label` on both search fields |
| Modal semantics | **PASS** — `role="dialog"`, `aria-modal`, Escape, focus trap, scroll lock, focus restore |
| YES/NO not colour-only | **PASS** — text label + `aria-pressed` + `✓` on the active side |
| Visible focus ring | **PASS** — `:focus-visible` with a 2px accent outline |
| Reduced motion | **PASS** — `@media (prefers-reduced-motion: reduce)` disables all animation |
| Skip link | **PASS** — "Skip to content" as the first focusable element |
| Live regions | **PASS** — `aria-busy` / `aria-live` on the AI loading state |

**Not executed:** screen-reader testing and computed contrast-ratio measurement.
**BLOCKED — requires assistive tech and a browser.**

---

## 14. Security Audit

| Check | Method | Result |
| --- | --- | --- |
| Secrets in git history | Scanned **every commit, all files** | **PASS — 0** |
| `.env.local` tracked | `git ls-files` | **PASS — 0** (3 `.gitignore` rules cover it) |
| `.env` files tracked | `git ls-files` | **PASS** — only `.env.example` (placeholders) |
| Secret values in client bundle | grep `.next/static/` | **PASS — 0** |
| Server `process.env` in client bundle | grep excluding `NEXT_PUBLIC_` | **PASS — 0** |
| Panta base URL in client bundle | grep | **PASS — 0** |
| Groq endpoint in client bundle | grep | **PASS — 0** |
| `X-Api-Key` in client bundle | grep | **PASS — 0** |
| `server-only` guards | count | **PASS — 13 modules** |
| `dangerouslySetInnerHTML` | grep | **PASS — 0** |
| `eval` / `new Function` / `innerHTML` / `document.write` | grep | **PASS — 0** |
| Private key / seed handling | grep `secretKey`, `privateKey`, `mnemonic`, `seedPhrase` | **PASS — 0** |
| Input validation | Zod on every mutating route | **PASS** — 19 tests + live matrix |
| Method guards | live | **PASS** — 405 on every mismatch |
| Secret logging | full server-log grep | **PASS — 0** |

**No credential is exposed in the repository.** Keys were supplied in the working session and
live only in the gitignored `.env.local`.

> **Rotation still required.** The Panta, Groq and Helius keys were transmitted in a chat
> transcript during development. They are not in the repository, but they should be rotated
> before or shortly after submission. A new Panta key minted with `revokeOthers: true`
> revokes the old ones. Keys are **not** reproduced in this report.

---

## 15. Bugs Found

Bugs 1–14 were found in earlier sessions and are recorded in `docs/QA_REPORT.md`. Bugs 15–17
were found during **this** audit.

| # | Bug | Severity | Fix | Retest |
| --- | --- | --- | --- | --- |
| 15 | **Transient upstream `400` reported as the user's fault.** Panta intermittently returns a bare `{"code":"INVALID_MARKET_PARAMS"}` for valid requests. It was surfaced as "Some of the submitted values were rejected", non-retryable — blaming input that was correct and denying a retry | **High** | Detail-less params errors are reclassified `UPSTREAM_TRANSIENT` (502, retryable) with accurate copy. Errors carrying `field`/`fields`/`message` keep their code and stay non-retryable | **PASS** — 6 new unit tests; live: route now returns `UPSTREAM_TRANSIENT retryable=true` on the bare form and `NOT_CLAIMABLE` on the real one |
| 16 | **No retry for that instability**, so roughly a quarter of market-detail loads failed | **High** | Bounded retry (3 attempts, 150/400 ms backoff) for **GET only**. POST is never auto-retried: quote/build would mint duplicate sessions and submit/report/register must not fire twice | **PASS** — market detail 75% raw → **12/12** through the route; showpiece page **8/8**; 8 new unit tests pin the semantics |
| 17 | **Test mock reused one `Response`**, whose body can only be read once, so the retry test failed with "Body is unusable" | Low (test-only) | Mock builds a fresh `Response` per call | **PASS** — 8/8 retry tests green |

**Also corrected during this audit:** an earlier session recorded a CRITICAL "AI hallucination".
Re-investigation showed the list endpoint returns `title: ""` while detail returns the real
question, and the AI route reads detail — so the model used genuine data. The finding has been
rewritten in `docs/QA_REPORT.md` and downgraded; the guard it produced is still correct and
retained for markets that really are empty.

---

## 16. Remaining Blockers

| Blocker | Impact | Owner |
| --- | --- | --- |
| Funded wallet (SOL + USDC) | Blocks real trade signature, broadcast, attribution | **You** |
| Human wallet approval | Cannot and must not be automated | **You** |
| A resolved market where you hold the winning side | Blocks a live winnings-claim demo | Market conditions |
| A graduated market you created with accrued fees | Blocks a live creator-fee demo | Market conditions |
| Browser session | Blocks visual responsive + screen-reader verification | **You** |
| Upstream Panta instability | Mitigated, not eliminated — retry raised detail reliability to 12/12 but Panta can still fail | Panta |

**No software blockers remain.**

---

## 17. Required API Keys / Environment

Exactly the variables this project reads — verified by grepping `process.env` across `src/`.

| Variable | Required | Status | Purpose | Side | Where obtained |
| --- | --- | --- | --- | --- | --- |
| `PANTA_API_KEY` | **Yes** | **Configured** (`pk_live_…`, verified) | Every Panta call | **Server only** | `POST /account/keys/` with `{"env":"live"}` — see `docs/REQUIRED_KEYS.md` §1a |
| `PANTA_API_BASE_URL` | No | Defaulted | Base URL override | Server only | Defaults to `https://live-api.panta.market/api/v1` |
| `GROQ_API_KEY` | No (required for AI) | **Configured**, verified | AI Market Intelligence | **Server only** | <https://console.groq.com/keys> |
| `GROQ_MODEL` | No | Defaulted, verified | Model id | Server only | Defaults to `openai/gpt-oss-120b`. **Never** set a `groq/compound*` model — built-in web search |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Recommended | **Configured** (Helius mainnet, verified) | Broadcast + confirm | **Public** | <https://dashboard.helius.dev/> |
| `NEXT_PUBLIC_SOLANA_NETWORK` | No | Defaulted `mainnet-beta` | Explorer cluster | Public | Your choice |

`PANTA_API_KEY` and `GROQ_API_KEY` must **never** carry a `NEXT_PUBLIC_` prefix — that is what
inlines a value into the browser bundle.

---

## 18. Vercel Deployment Checklist

- [x] Production build passes (`npx next build`, 28 routes)
- [x] No `localhost` dependency in application code (only in local test scripts, untracked)
- [x] No filesystem persistence — no database, no disk writes
- [x] No hardcoded RPC — read from `NEXT_PUBLIC_SOLANA_RPC_URL`
- [x] Route handlers are standard Next.js App Router handlers
- [x] Remote image patterns configured in `next.config.ts` (Panta serves Cloudinary URLs)
- [x] Security headers set (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`)
- [x] `.env.local` gitignored; `.env.example` documents every variable
- [ ] Environment variables entered in Vercel — **you**
- [ ] Deployed and smoke-tested — **you**

**Enter these in Vercel → Project → Settings → Environment Variables:**

```
PANTA_API_KEY               = pk_live_…            (leave UNPREFIXED — server only)
PANTA_API_BASE_URL          = https://live-api.panta.market/api/v1
GROQ_API_KEY                = gsk_…                (leave UNPREFIXED — server only)
GROQ_MODEL                  = openai/gpt-oss-120b
NEXT_PUBLIC_SOLANA_RPC_URL  = https://mainnet.helius-rpc.com/?api-key=…
NEXT_PUBLIC_SOLANA_NETWORK  = mainnet-beta
```

Two caveats worth knowing:

1. `NEXT_PUBLIC_SOLANA_RPC_URL` is **inlined into the browser bundle by design** — the browser
   must reach the RPC to broadcast. Restrict the Helius key by domain in their dashboard
   before going public.
2. `NEXT_PUBLIC_*` values are inlined at **build** time. Changing one requires a redeploy,
   not just a restart.

---

## 19. Final Manual E2E Steps

Everything here needs your wallet or your eyes. Steps 1–5 spend nothing.

1. **Deploy**, or run `npm run build && npm run start` locally.
2. **Confirm the key is live:** `curl -s localhost:3000/api/panta/categories` → expect a real
   category array. If you see `UNAUTHORIZED` the key is wrong; `PANTA_NOT_CONFIGURED` means the
   server did not read `.env.local`.
3. **Browse:** open `/`, `/markets`, a market page. Confirm real questions, pricing and tape.
4. **Run AI:** click **Analyze with AI**, then **Regenerate**. Confirm all 7 sections and that
   the data-limitations section names real gaps.
5. **Reject a signature (important):** connect the wallet, enter `1`, **Get quote**, click
   **Trade YES**, then **decline** in the wallet. Expect `WALLET_REJECTED` — "You declined the
   signature request" — and *not* a network error.
6. **Real trade (spends USDC):** repeat, but approve. Watch the status line move through
   building → waiting → sending → confirming → reporting → verifying → completed. Record the
   signature.
7. **Verify attribution:** `curl -s localhost:3000/api/panta/trades/<signature>` → expect
   `processed`, or `pending_attribution` while Panta indexes. **This is the evidence for the
   submission.**
8. **Portfolio:** confirm the position appears. "Position is updating" is expected briefly.
9. **Claims:** if you hold a resolved winning position, claim it. If not, show the honest
   empty state and say so — do not stage one.
10. **Create market (spends ~50 USDC):** fill the form, **upload** the image rather than
    pasting a URL, read the fee, then sign only if you intend to spend it.
11. **Responsive pass:** devtools at 360 / 390 / 430 / 768 / 1024 / 1440 px. Confirm no
    horizontal scroll, the mobile trade sheet opens from the sticky bar, and tables become
    cards.

---

## 20. Traction Data To Collect Before Submission

Nothing here is fabricated, and nothing is pre-filled. Every figure has a stated source.

| Metric | Source | Value |
| --- | --- | --- |
| Panta-attributed trades | `GET /account/metrics/` → `summary.trades.total` | _____ |
| Attributed volume (USDC) | same → `volumeUsdcBase` ÷ 1,000,000 | _____ |
| Markets created | same → `summary.creates.total` | _____ |
| Distinct transacting wallets | same → distinct `trades[].wallet` | _____ |
| Unique visitors | Vercel Analytics (enable on deploy) | _____ |
| Testers completing the core loop | ask each tester directly; report as self-reported | _____ |
| Tester quotes | collect 3–5 verbatim, with consent | _____ |

```bash
curl https://live-api.panta.market/api/v1/account/metrics/ -H "X-Api-Key: pk_live_…"
```

Cite at least one trade signature that a judge can check independently on Solscan. Record the
measurement timestamp for every figure. If a metric was not measured, write "not measured"
rather than estimating. Include one piece of critical feedback and what you changed — it reads
as real usage.

---

## 21. Submission Readiness Checklist

- [x] Repository public and pushed
- [x] English throughout
- [x] Panta integration explained (`README.md`, `docs/ARCHITECTURE.md`, `docs/SUBMISSION.md`)
- [x] "Powered by Panta" on every Panta-powered surface, exact wording
- [x] Working prototype — all pages live against production Panta
- [x] Quality gate green (lint, typecheck, 129 tests, build)
- [ ] Deployed URL — **you**
- [ ] Official Colosseum submission — **you**
- [ ] Panta Sidetrack submission on Superteam Earn — **you**
- [ ] Demo video — **you** (`docs/DEMO_SCRIPT.md` has a timed 2–4 min script)
- [ ] Screenshots — **you**
- [ ] Traction figures filled from §20 — **you**
- [ ] One real trade signature for evidence — **you**

---

## 22. Final Known Limitations

Stated plainly. Most are properties of the current Panta API, not unfinished work.

1. **No real transaction has been signed or broadcast.** Everything up to the signature is
   verified; the signature itself is yours.
2. **Upstream instability is mitigated, not eliminated.** Retry raised market detail to 12/12,
   but Panta can still fail a request. The UI shows an honest retryable error when it does.
3. **`status` phase filtering is broken upstream**, so phase is filtered client-side over
   loaded markets rather than the whole catalog.
4. **Pagination does not advance upstream**, so the practical catalog reach is one page
   (50 markets) per category.
5. **No catalog text search exists**, so search filters loaded markets — labelled as such.
6. **42 of 50 live markets have no question text on the list endpoint.** Detail is merged for
   the first 12 rows per page; beyond that, genuinely nameless markets show their id.
7. **No P&L**, because positions carry no entry price. Estimated mark-to-market value is shown
   where a price exists, and "Value unavailable" where it does not.
8. **Created Markets is account-scoped**, not wallet-scoped, where Panta does not expose
   `creatorAddress`. Disclosed in the UI; Panta enforces ownership on the claim itself.
9. **AI rate limiter is in-process**, so it is per-instance on serverless rather than a global
   quota.
10. **A missing market renders the correct 404 page** — fixed this session via route groups.
11. **Visual responsive, browser-console and screen-reader checks were not executed** — no
    browser was available. Code-level audits passed; the visual pass is step 11 of §19.
