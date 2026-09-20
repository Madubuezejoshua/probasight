# Panta Pulse: Final Readiness Report

Written for: the project owner, and any Colosseum / Panta Sidetrack judge opening this
repository.

> **Ground rule: every PASS below has evidence from something actually executed during this
> audit.** A code path existing is not proof that it ran. Anything requiring a funded wallet,
> a human wallet approval, a market state that does not currently exist, or a real browser is
> marked **BLOCKED: MANUAL/EXTERNAL VERIFICATION REQUIRED**, never PASS.

Audit environment: Windows 11, Node 24.20.0, npm 11.19.0, Next.js 15.5.25.
Credentials in use: live Panta key (production catalog), Groq key, Helius mainnet RPC.
No credential value appears in this document.

*(Naming note: this project is **Panta Pulse**, built on the **Panta** API. If you were
looking for "Panther", this is the same project, there is no second project.)*

---

## Executive Summary

Panta Pulse is a working, non-custodial prediction-market intelligence and trading terminal
built on the Panta public API. All 18 Panta endpoints this integration needs are wired to
real product surfaces and were verified against the live production API during this audit.

Every read path, the AI layer, and the trading lifecycle **up to the wallet signature** were
executed this session. A fresh Panta `build` response was compiled through the application's
own code into a valid 696-byte v0 Solana transaction carrying Panta's on-chain attribution
memo. The only unexecuted step is the signature itself.

The quality gate was re-executed from a clean `npm ci`: **0 lint errors, 0 TypeScript errors,
133 tests passing across 10 files, production build clean with all 20 API routes emitted.**

No new software defects were found in this pass. The two critical defects from the previous
pass, four transaction-builder routes excluded from the repository by an unanchored
`.gitignore` pattern, and a critical Next.js RCE: remain fixed and are now covered by tests.

---

## Final Status

> ## READY FOR SUBMISSION
>
>, subject to the owner actions listed below, none of which are code changes.

Ready because the software is complete and correct, the gate is green, the integration is
verified against production, and the security audit is clean.

The repository is also deployment-ready; deployment itself has not been performed, and
credentials should be rotated first.

Explicitly **not** claiming a completed on-chain trade: no transaction has been signed or
broadcast, and saying otherwise would be fabrication.

---

## Quality Gate

| Check | Command | Result |
| --- | --- | --- |
| Install | `npm ci` | **PASS** |
| Lint | `npx eslint .` | **PASS**: exit 0, 0 errors, 0 warnings |
| Typecheck | `npx tsc --noEmit` | **PASS**: exit 0, strict mode |
| Tests | `npx vitest run` | **PASS: Tests 133 passed (133), Test Files 10 passed (10)** |
| Build | `npx next build` | **PASS**: 20/20 API routes, 103 kB shared First Load JS |
| `npm audit` | N/A | 0 critical, 1 high, 18 moderate (see Known Limitations) |

### Test files

| File | Tests | Covers |
| --- | --- | --- |
| `format.test.ts` | 21 | USDC base-unit vs decimal, share base units, implied-percent bounds, position valuation incl. settlement |
| `validation.test.ts` | 19 | Zod route inputs: base58, amount bounds, create time ordering, image-URL rules |
| `errors.test.ts` | 18 | Error normalisation, status fallbacks, retryability, transient reclassification |
| `time.test.ts` | 17 | Both Panta timestamp wire formats, countdowns, quote-expiry maths |
| `solana-transaction.test.ts` | 16 | Instruction decode, order, v0 compile, fee payer, round-trip, signing-error classification |
| `ai-schema.test.ts` | 13 | JSON extraction, rejection of partial/empty/wrong-typed output |
| `display.test.ts` | 11 | Market-name resolution and truncation |
| `panta-client-retry.test.ts` | 8 | GET retries transient; POST never does; real validation errors never retried; fail-closed without a key |
| `ai-guard.test.ts` | 6 | Refusal of markets with no question text |
| `repo-integrity.test.ts` | 4 | Every source file and API route is tracked by git; gitignore cannot swallow nested source dirs |

No test signs a transaction, spends funds, or creates a market.

---

## Feature Requirement Matrix

| Feature | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Market discovery | **PASS** | 50 live markets on `/markets` | |
| Categories | **PASS** | 8 live from `GET /categories/` | Documented allowlist is fallback only |
| Market browsing | **PASS** | Cards render title, phase, volume, timing | |
| Filtering | **PASS** | Category server-side (`crypto` → 9/9 crypto); phase client-side on the real field | Panta's `status` param is unreliable, see Upstream Defects |
| Search | **PASS** | Filters loaded markets, labelled as such | Panta exposes no search param |
| Market detail | **PASS** | Live pricing, timing, resolution, volume | |
| Market pricing / data | **PASS** | Real `yesPrice`/`noPrice` rendered as implied % + USDC per share | |
| Activity / trades | **PASS** | Trade tape + cumulative share-flow chart | Not a price chart, see Originality |
| Timing / status | **PASS** | Both Unix-integer and ISO wire formats parsed | |
| Empty states | **PASS** | Positions/activity empty arrays render honest empty states | |
| Loading states | **PASS** | Scoped `loading.tsx` per route group | |
| API failure handling | **PASS** | Structured envelope, retryable flag, retry UI | |
| AI Market Intelligence | **PASS** | Schema-valid 7-section analysis on all 3 demo markets | |
| AI: real context only | **PASS** | Context built from catalog row + tape; missing fields sent as `"unavailable"` | |
| AI: no fabricated news | **PASS** | No news API or web search exists in the codebase | |
| AI: refuses no-question markets | **PASS** | `EWiohz3L…` → `MARKET_QUESTION_UNAVAILABLE`; Analyze button hidden | |
| AI: no trade recommendation | **PASS** | None present in any of 3 analyses; forbidden by system prompt | |
| Wallet connect (Phantom / Solflare) | **BLOCKED** | Requires browser extension + human action | Adapter wired, modal restyled |
| No private key / seed handling | **PASS** | 0 occurrences of `secretKey`, `privateKey`, `mnemonic`, `seedPhrase` in `src/` | |
| Trading. YES / NO | **PASS** (quote+build) / **BLOCKED** (signature) | Side validated case-insensitively | |
| Trading, amount validation | **PASS** | Zero, negative, 7-dp, missing, malformed all rejected 400 | |
| Trading, quote | **PASS** | `qt_687e6694…` shares 1.996363, avg 0.50091, fee 0.02 | |
| Trading, quote expiry | **PASS** (code + UI countdown) | ~90 s countdown; expiry clears the quote | Live expiry not waited out |
| Trading, build | **PASS** | `ord_1c1420f5…`, 2 instructions, `lastValidBlockHeight` 426598131 | |
| Trading, tx construction | **PASS** | 696-byte v0 tx, 1 signature, blockhash preserved, round-trips | |
| Trading, signature | **BLOCKED** | Manual wallet approval required | |
| Trading, broadcast / confirm | **BLOCKED** | Funded wallet required | |
| Trading, submit / verify | **BLOCKED** | Depends on a signature | Routes verified reachable |
| Trade reporting / attribution | **PASS** | Panta memo decoded on-chain: `panta:v1:usr_…:qt_…:ord_…` | Explicit `POST /trades/` also implemented |
| Indexing-delay handling | **PASS** (code) | Bounded refetch + "Position is updating" state | |
| Portfolio positions | **PASS** | `GET /positions/` 200, count 0, honest empty state | No position exists yet |
| Wallet activity | **PASS** | `GET /wallets/{w}/trades/` 200 | |
| Estimated value | **PASS** | Shares × side price; settlement 1/0 once resolved | |
| No fake P&L | **PASS** | No P&L computation exists anywhere in `src/` | |
| Claimable state | **PASS** | Correct refusal `NOT_CLAIMABLE` | |
| Winnings claim execution | **BLOCKED** | Requires a winning position | |
| Market creation, categories | **PASS** | 8 live | |
| Market creation, validation | **PASS** | Bad time ordering rejected 400 | |
| Market creation, image upload | **PASS** | Real signed Cloudinary form, host `api.cloudinary.com` | Bytes never touch our server |
| Market creation, fee quote | **PASS** | 50.00 USDC = 10.00 liquidity + 40.00 platform; real `expectedEventPda` | |
| Market creation, sign / register | **BLOCKED** | Real 50 USDC fee | |
| Creator fees | **PASS** (refusal verified) | `NOT_MARKET_CREATOR` | Correctly does **not** post to `/trades/` |
| "Powered by Panta" | **PASS** | Exact string, every Panta-powered surface | Terms §6 wording unmodified |

---

## Panta API Integration

**READY.** Panta is load-bearing, not decorative.

Path-by-path diff against the current `llms.txt` (re-fetched this audit, unchanged at 43
lines) shows **all 18 endpoints match exactly**:

| Endpoint | Method | Powers |
| --- | --- | --- |
| `/categories/` | GET | Filter chips, create-market category |
| `/markets/` | GET | Homepage rail, markets grid, created markets |
| `/markets/{id}/` | GET | Market detail, card pricing + titles, position valuation |
| `/markets/{id}/trades/` | GET | Activity chart, trade tape, AI context |
| `/wallets/{w}/trades/` | GET | Portfolio → Activity |
| `/positions/?wallet=` | GET | Portfolio → Open + Claimable |
| `/primaryorderquote/` | POST | Trade quote preview |
| `/primaryorderbuild/` | POST | Trade build, pre-signature |
| `/primaryordersubmit/` | POST | Post-broadcast submission |
| `/primaryorderverify/` | POST | Final order status |
| `/trades/` | POST | Attribution for buys and win claims |
| `/trades/{sig}/` | GET | Live attribution status poll |
| `/claim/build/` | POST | Claim winnings |
| `/claim/creator-fees/build/` | POST | Claim creator fees |
| `/markets/create/image-upload/` | POST | Image upload signature |
| `/markets/create/quote/` | POST | Creation fee quote |
| `/markets/create/build/` | POST | Creation transaction |
| `/markets/register/` | POST | Post-broadcast registration |

**Authentication.** `X-Api-Key` server-side only. The browser never holds the developer key;
every authenticated call is proxied through this app's own route handlers. 13 modules carry
`import "server-only"`, so a client component importing one fails the build.

**Attribution asymmetry implemented correctly.** Primary buys and win claims are reported to
`POST /trades/`; creator-fee claims deliberately are not, because Panta rejects those
signatures with `TX_MISMATCH`.

### Upstream Panta defects worked around

Each reproduced with plain `curl` outside the application, so none are ours.

| Defect | Evidence | Handling |
| --- | --- | --- |
| Detail-less `400 INVALID_MARKET_PARAMS` on valid requests | Identical request alternated 200/400 across 8 consecutive calls; persisted after a 90 s cooldown, so not rate limiting | Reclassified `UPSTREAM_TRANSIENT` (retryable); GET auto-retried, POST never |
| `status` does not filter by phase | `status=primary` → 9 cancelled + 36 resolved + 3 primary; `status=resolved` → 0 while 38 resolved exist | Parameter not sent; phase filtered client-side |
| Cursor does not advance | 12 pages walked, same 50 markets, same cursor | Load-more retires when a page yields no new rows |
| `createdBy=me` intermittently 400s | `"limit must be an integer"` for every limit, and with none | Falls back to catalog filtered on `createdByPartner`; the documented path succeeded again this audit |
| `title` empty on list rows | Same market: empty on list, real question on detail | Detail merged into leading cards; `marketTitle` resolves title → description → id |
| Timestamps differ by environment | Live returns Unix integers; sandbox returned ISO-8601 | `unixToDate` accepts both |
| Some markets have no question at all | Empty title **and** description on both list and detail | AI refuses; card falls back to id |

---

## Technical Execution

**READY.**

- **Both Panta transaction shapes handled.** Instruction lists (buy, claims) compiled to v0;
  an assembled base64 transaction (creation) deserialised.
- **Real transaction verified this audit**: version 0, blockhash preserved, fee payer at
  `staticAccountKeys[0]`, 1 required signature, **696 bytes** (limit 1232), round-trips.
- **Post-broadcast boundary handled deliberately.** After a transaction lands, a later
  failure is a bookkeeping problem, not a lost trade, the UI says so and shows the signature.
- **Expiry handled.** Quote (~90 s), order (~120 s), create session (~5 min) counted down and
  invalidated; `REBUILD_CODES` drives discard-and-requote.
- **Signing errors classified.** Wallet rejection (`code 4001`, `WalletSignTransactionError`,
  message variants) distinct from RPC failure, blockhash expiry, insufficient funds, revert.
- **Retry discipline.** GET retries the transient upstream shape (3 attempts, 150/400 ms).
  **POST is never auto-retried**: quote/build would mint duplicate sessions and
  submit/report/register must not fire twice for one signature. Pinned by 8 unit tests.
- **Validation.** Zod on every mutating route; 19 unit tests plus a live matrix.

---

## Product & UX

**READY.**

Public browsing with no login; a judge sees real markets immediately. Pricing reads as an
implied percentage with the USDC price beneath. One obvious trade flow, scoped to what the
API supports, no fake limit orders. The mobile trade ticket is a real `role="dialog"` bottom
sheet with focus trap, Escape, scroll lock and safe-area insets. No dead buttons: all 20
routes are reachable from the product, and "Load more" retires itself at the catalog end.
Zero TODO / FIXME / "coming soon" / lorem ipsum in `src/`.

**Honest caveat:** most live catalog rows carry no question text on the list endpoint. Detail
is merged into the leading cards so real questions appear; genuinely nameless markets show
their id rather than an invented title.

**Cold-load note:** `/markets` took 10.6 s on the first request after a cold start (12 detail
enrichments), then 0.07–0.23 s warm. The route-group `loading.tsx` streams a skeleton
immediately, so perceived load stays fast.

---

## Originality

**READY.**

Verified by live execution on three different real markets, all returned a schema-valid
7-section analysis, no repair retry needed.

The layer is defined as much by what it refuses as by what it produces: it sees only real
Panta context, is told what it does not know via explicit `"unavailable"` markers, returns
Zod-validated JSON, gets exactly one repair attempt before erroring, never recommends a
trade, and **refuses outright** on markets with no question text rather than inferring a
topic from category or oracle feed names.

Quality on real data. It surfaced something a reader would miss:

> *"Four trades occurred in a brief window, all from a single wallet."*
> *"Trade-by-trade USDC amounts are not provided, preventing price impact analysis."*

The same principle governs the chart. Panta trade rows carry share quantities and fees but
never the USDC spent, so a price line is not derivable. Rather than fake one, the page plots
**cumulative YES/NO share flow**: genuinely derivable, and says why.

---

## Impact Potential

**READY.** Zero hardcoded market ids or category-specific code paths outside tests. The live
catalog exercised this audit spans **sports, crypto, politics, weather, finance and
entertainment**, all rendered by the same components. Categories come from
`GET /categories/`, with the documented allowlist used only as a fallback.

---

## Traction Readiness

**READY to collect. Nothing invented.**

Attribution is correctly wired, so trades routed through Panta Pulse are attributable to this
API account and readable from `GET /account/metrics/`. Panta also embeds its own attribution
memo on-chain. No analytics backend was built. Collection plan in
`docs/TRACTION_CHECKLIST.md`; every figure in `docs/SUBMISSION.md` is a blank placeholder.

Metrics to collect before submission: attributed trades, attributed volume, markets created,
distinct transacting wallets, unique visitors (Vercel Analytics), testers completing the core
loop, and verbatim tester feedback.

---

## Frontend Route Audit

| Route | HTTP | Size | Time | Result |
| --- | --- | --- | --- | --- |
| `/` | 200 | 108 KB | 0.094 s | PASS |
| `/markets` | 200 | 284 KB | 10.6 s cold / 0.07–0.23 s warm | PASS |
| `/portfolio` | 200 | 24 KB | 0.018 s | PASS |
| `/create` | 200 | 33 KB | 0.031 s | PASS |
| `/markets/{primary}` | 200 | 90 KB | 0.289 s | PASS |
| `/markets/{backup 1}` | 200 | N/A |, | PASS |
| `/markets/{backup 2}` | 200 | N/A |, | PASS |
| `/markets/bad-id` | **404** | N/A |, | PASS |
| `/markets/{valid-but-missing}` | **404** | N/A |, | PASS |
| `/nope` | **404** | N/A |, | PASS |

Showpiece content verified present: "Powered by Panta", "AI Market Intelligence", "Market
activity flow", "Recent activity", trade panel.

---

## API Route Audit

All **20** routes enumerated from the filesystem, not assumed.

### Read routes

| Route | Valid | Invalid | Wrong method |
| --- | --- | --- | --- |
| `categories` | 200 | 200 (no params to invalidate) | 405 |
| `markets` | 200 | 400 | 405 |
| `markets/[id]` | 200 | 400 | 405 |
| `markets/[id]/trades` | 200 | 400 | 405 |
| `positions` | 200 | 400 | 405 |
| `wallet-trades` | 200 | 400 | 405 |
| `created-markets` | 200 | 400 | 405 |
| `trades/[signature]` | 502¹ | 400 | 405 |

¹ `UPSTREAM_TRANSIENT`, retryable, the documented upstream flakiness, correctly classified.

### Mutating routes

| Route | Case | HTTP | Code |
| --- | --- | --- | --- |
| `trade/quote` | valid | 200 | N/A |
| `trade/quote` | invalid wallet / marketId / side | 400 | `VALIDATION_FAILED` |
| `trade/quote` | zero / negative / 7-dp / missing / malformed | 400 | `VALIDATION_FAILED` |
| `trade/build` | unknown quoteId | 400 | `QUOTE_EXPIRED` |
| `trade/submit` | bad signature | 400 | `VALIDATION_FAILED` |
| `trade/verify` | unknown orderId | 400 | `QUOTE_EXPIRED` |
| `trades/report` | bad signature | 400 | `VALIDATION_FAILED` |
| `claims/winnings/build` | non-holder | 400 | `NOT_CLAIMABLE` |
| `claims/creator-fees/build` | non-creator | 400 | `NOT_MARKET_CREATOR` |
| `create/image` | valid | 200 | real Cloudinary form |
| `create/quote` | bad time ordering | 400 | `VALIDATION_FAILED` |
| `ai/market-analysis` | invalid marketId | 400 | `VALIDATION_FAILED` |
| `ai/market-analysis` | no-question market | 422 | `MARKET_QUESTION_UNAVAILABLE` |
| `ai/market-analysis` | 12 rapid requests | 429 | `AI_RATE_LIMITED` |

**Leakage check across every captured response body: 0 secrets, 0 stack traces.**

---

## End-to-End Results

### EXECUTED

- Homepage → markets → category filter → phase filter → market detail
- Real Panta pricing, timing, volume, resolution metadata
- Trade tape and cumulative share-flow chart
- AI analysis on 3 distinct real markets (schema-valid, first attempt)
- AI refusal on a genuinely question-less market
- Trade **quote** → **build** → **transaction compile** (696-byte v0, memo decoded)
- Portfolio: positions, wallet activity, created markets
- Claim eligibility refusal (`NOT_CLAIMABLE`) and creator-fee refusal (`NOT_MARKET_CREATOR`)
- Market creation: live categories, image-upload signature, **real 50 USDC fee quote**

### BLOCKED

| Step | Reason |
| --- | --- |
| Wallet connect | BLOCKED: browser extension + human action |
| Wallet signature | BLOCKED: MANUAL WALLET APPROVAL REQUIRED |
| Broadcast / confirmation | BLOCKED: FUNDED WALLET REQUIRED |
| Panta submit / verify | BLOCKED: depends on a signature |
| Position appearing after a trade | BLOCKED: depends on a broadcast |
| Winnings claim execution | BLOCKED: CLAIMABLE POSITION REQUIRED |
| Creator-fee claim execution | BLOCKED: graduated market with accrued fees required |
| Market creation build / sign / register | BLOCKED: real 50 USDC fee |

### FAILED

None.

> **E2E complete through the wallet-approval boundary.** No transaction has been signed or
> broadcast.

---

## Wallet / Solana

| Check | Result |
| --- | --- |
| Network configuration | **PASS**: Helius mainnet; adapter cluster detection resolves to `solana:mainnet` |
| RPC handling | **PASS**: read from `NEXT_PUBLIC_SOLANA_RPC_URL`, no hardcoding |
| Instruction conversion | **PASS**: 16 unit tests |
| v0 transaction construction | **PASS**: verified on a fresh real build this audit |
| Blockhash handling | **PASS**: Panta blockhash preserved; `lastValidBlockHeight` used |
| Wallet signing architecture | **PASS** (code) / **BLOCKED** (execution) |
| Broadcast architecture | **PASS** (code) / **BLOCKED** (execution) |
| Confirmation logic | **PASS** (code + tests) / **BLOCKED** (live) |
| Explorer URLs | **PASS**: Solscan with cluster suffix |
| Wallet-rejection classification | **PASS** (unit), `code 4001`, adapter error, message variants → `WALLET_REJECTED`, non-retryable |
| RPC failure classification | **PASS** (unit), distinct from rejection |
| Blockhash expiry | **PASS** (unit), `BLOCKHASH_EXPIRED`, retryable |
| No private key / seed phrase | **PASS**: 0 occurrences |

> **A live rejection test is BLOCKED**: triggering a wallet prompt needs a browser and a
> human. Owner action 4 covers it. The classification itself is unit-tested.

---

## AI

| Check | Result |
| --- | --- |
| Real context only | **PASS**: catalog row + trade tape; missing fields sent as `"unavailable"` |
| Structured output | **PASS**: 7 sections, Zod-validated, 3/3 markets on first attempt |
| YES case / NO case / uncertainty / limitations | **PASS**: all populated on all 3 |
| No fabricated news | **PASS**: no news API or web search in the codebase |
| No guaranteed outcomes / no trade recommendation | **PASS**: none present; forbidden by prompt |
| Missing-question market | **PASS**: `MARKET_QUESTION_UNAVAILABLE`; Analyze button hidden |
| Malformed model response | **PASS** (unit), 13 schema tests |
| Repair retry | **PASS** (code + unit), one attempt, then error |
| Unavailable / timeout | **PASS** (observed), surfaced `AI_UNAVAILABLE`, retryable; retry succeeded |
| Failure does not break the page | **PASS**: market page returned 200 with the AI panel in its error state |
| Key server-only | **PASS**: 0 occurrences in the client bundle |

Model: `openai/gpt-oss-120b`, verified against Groq's live model list. `groq/compound*`
models are deliberately excluded, they carry built-in web search, which would break the
guarantee that analysis uses only the Panta snapshot.

---

## Security

| Check | Method | Result |
| --- | --- | --- |
| Secrets in git history | Scanned **all 8 commits, all files** | **PASS: 0** |
| `.env.local` tracked | `git ls-files` | **PASS: 0**, and ignored |
| `.env.example` contains real values | regex | **PASS: 0** |
| Secrets in client bundle | grep `.next/static/` | **PASS: 0** |
| Server `process.env` in client bundle | grep excluding `NEXT_PUBLIC_` | **PASS: 0** |
| Panta base URL / Groq endpoint / `X-Api-Key` in bundle | grep | **PASS: 0 each** |
| Secrets in server logs | full runtime log grep | **PASS: 0** |
| Secrets in API response bodies | all captured bodies | **PASS: 0** |
| Stack traces in responses | all captured bodies | **PASS: 0** |
| `dangerouslySetInnerHTML` / `eval` / `new Function` / `innerHTML` / `document.write` | grep | **PASS: 0 each** |
| Private key / seed / mnemonic handling | grep | **PASS: 0** |
| `server-only` guards | count | **PASS: 13 modules** |
| Input validation | Zod on every mutating route | **PASS** |
| Method guards | live | **PASS: 405 on every mismatch** |

> **Credential rotation required before or shortly after submission.** The Panta, Groq and
> Helius keys were transmitted in a development chat transcript. They are **not** in the
> repository. A new Panta key minted with `revokeOthers: true` revokes the old ones. No
> credential value appears in this report.

---

## Responsive / Browser

> **BLOCKED: MANUAL/EXTERNAL VERIFICATION REQUIRED.** No browser or headless driver is
> available in this environment, so visual rendering, the browser console, hydration warnings
> and real interaction were **not** observed. What follows is a code-level audit only and is
> not a substitute for looking at it.

| Check | Result |
| --- | --- |
| Fixed widths that could overflow 360 px | **PASS**: every `[1440px]` is `max-w-`, never fixed |
| Tables have a mobile alternative | **PASS**: both pair `hidden sm:block` with an `sm:hidden` card list |
| `min-w-0` on flex children with long text | **PASS**: across 7 components |
| `overflow-x: hidden` guard on body | **PASS** |
| Horizontally scrolling filter rows | **PASS**: `overflow-x-auto` on category and phase chips |
| Sticky bar / padding breakpoint pairing | **PASS**: `pb-28` persists to `lg`, matching the bar |
| Safe-area insets on the mobile sheet | **PASS**: `env(safe-area-inset-bottom)` |
| Desktop sticky trade rail | **PASS**: `hidden lg:block` + `sticky top-20` |
| Build-time React / hydration warnings | **PASS**: none emitted by `next build` |

**Manual instructions.** Devtools device toolbar at **360 / 390 / 430 / 768 / 1024 / 1440 px**,
on `/`, `/markets`, a market page, `/portfolio`, `/create`. Confirm: no horizontal scroll;
the mobile trade sheet opens from the sticky bar and traps focus; tables become cards; the
header does not overlap content; the console is clean of React warnings, hydration errors and
repeated network calls.

---

## Accessibility

> Code audit. Screen-reader behaviour and computed contrast ratios were **not** measured.
> **BLOCKED: MANUAL/EXTERNAL VERIFICATION REQUIRED**.

| Check | Result |
| --- | --- |
| Form labels | **PASS**: all 12 `htmlFor` values have a matching input `id`, verified pairwise |
| Icon-only buttons labelled | **PASS**: `aria-label` on each |
| Search inputs labelled | **PASS** |
| Dialog semantics | **PASS**: `role="dialog"`, `aria-modal`, Escape, focus trap, scroll lock, focus restore |
| YES/NO not colour-only | **PASS**: text label + `aria-pressed` + `✓` on the active side |
| Visible focus ring | **PASS**: `:focus-visible`, 2 px accent outline |
| Reduced motion | **PASS**: `@media (prefers-reduced-motion: reduce)` disables animation |
| Skip link | **PASS**: first focusable element |
| Live status messaging | **PASS**: `aria-busy` / `aria-live` on AI loading |

---

## Performance

| Check | Result |
| --- | --- |
| N+1 market fetching | **PASS**: enrichment bounded to 12 rows; positions fan-out capped at 24 |
| Repeated AI calls | **PASS**: only from explicit `onClick`; never on render; session-cached |
| Excessive polling | **PASS**: attribution poll bounded to 4 attempts then manual; countdowns are local 1 s timers, all cleared on unmount |
| Infinite loops | **PASS**: load-more retires on a no-new-rows page |
| POST retries causing duplicates | **PASS**: POST is explicitly never auto-retried |
| Bundle | **PASS**: 103 kB shared First Load JS |
| Image optimisation | **PASS**: `next/image` with configured `remotePatterns` |
| Unnecessary dependencies | **PASS**: 12 runtime deps, all used |

---

## Bugs Found

No new defects in this pass. Bugs 1–14 are recorded in `docs/QA_REPORT.md`; 15–20 were found
in the previous audit pass and are re-verified as fixed here.

| Bug | Severity | Fix | Retest |
| --- | --- | --- | --- |
| 18. Four transaction-builder routes excluded from the repository by an unanchored `.gitignore` `build` pattern. `trade/build`, `create/build`, `claims/winnings/build`, `claims/creator-fees/build` were absent from every deployment; Vercel listed 16 routes where the project has 20. Every write flow was broken in production while working locally | **CRITICAL** | Root-anchored all build-output patterns; committed the four routes; added `repo-integrity.test.ts` | **PASS**: build emits 20/20 routes; test green |
| 19. Next.js 15.5.4 carried a critical RCE plus 30 advisories, including an Image-Optimization RCE and a `remotePatterns` DoS | **CRITICAL** | Upgraded to 15.5.25; `sharp` to 0.35.4 | **PASS**: `npm audit` critical 1 → **0** |
| 15. Transient upstream 400 reported as the user's fault, non-retryable | High | Detail-less params errors reclassified `UPSTREAM_TRANSIENT`, retryable | **PASS**: live: transient form retryable, real form still `NOT_CLAIMABLE` |
| 16. No retry for that instability; ~25% of market-detail loads failed | High | Bounded GET-only retry | **PASS**: detail 75% raw → 12/12 through the app |
| 17. Test mock reused one `Response` (body readable once) | Low | Fresh `Response` per call | **PASS** |
| 20. Next 16 evaluated and rejected | N/A | Builds and passes tests, but enables `react-hooks/set-state-in-effect` flagging 10 legitimate sites; a major upgrade before submission is poor risk | **N/A**: documented so it is not re-litigated |

---

## Remaining Blockers

| Blocker | Impact | Owner |
| --- | --- | --- |
| Funded wallet (SOL + USDC) | Real signature, broadcast, attribution | **You** |
| Human wallet approval | Cannot and must not be automated | **You** |
| Resolved market with a winning position | Live winnings-claim demo | Market conditions |
| Graduated market with accrued creator fees | Live creator-fee demo | Market conditions |
| Browser session | Visual responsive + console + screen-reader checks | **You** |
| Upstream Panta instability | Mitigated by retry, not eliminated | Panta |

**No software blockers remain.**

---

## Required Environment Variables

Exactly the variables this repository reads, verified by grepping `process.env` across `src/`.
No values shown.

| Variable | Required | Server/Public | Purpose | Where obtained |
| --- | --- | --- | --- | --- |
| `PANTA_API_KEY` | **Yes** | **Server** | Every Panta call | `POST /account/keys/` with `{"env":"live"}`, see `docs/REQUIRED_KEYS.md` §1a |
| `PANTA_API_BASE_URL` | No | Server | Base URL override | Defaults to production |
| `GROQ_API_KEY` | For AI | **Server** | AI Market Intelligence | <https://console.groq.com/keys> |
| `GROQ_MODEL` | No | Server | Model id; defaults `openai/gpt-oss-120b` | Never a `groq/compound*` model |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Recommended | **Public** | Broadcast + confirm | <https://dashboard.helius.dev/> |
| `NEXT_PUBLIC_SOLANA_NETWORK` | No | Public | Explorer cluster | Your choice |

Never prefix the two secrets with `NEXT_PUBLIC_`, that is what inlines a value into the
browser bundle.

---

## Vercel Deployment Checklist

- [x] Production build passes; all 20 API routes emitted
- [x] No localhost dependency in application code
- [x] No filesystem persistence, no database, no disk writes
- [x] No hardcoded RPC
- [x] Route handlers are standard App Router handlers
- [x] Image `remotePatterns` configured
- [x] Security headers set (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`)
- [x] `.env.local` gitignored; `.env.example` documents every variable
- [x] Next.js on a patched release (15.5.25); 0 critical advisories
- [ ] Environment variables entered in Vercel, **you**
- [ ] Deployed and smoke-tested, **you**

Two caveats: `NEXT_PUBLIC_SOLANA_RPC_URL` is inlined into the browser by design (the browser
must reach the RPC to broadcast), restrict the key by domain in Helius before going public.
And `NEXT_PUBLIC_*` values are inlined at **build** time, so changing one needs a redeploy.

---

## Final Manual Owner Actions

1. **Rotate credentials**: new Panta key with `revokeOthers: true`, new Groq key, new Helius key.
2. **Deploy to Vercel**, entering the six variables above.
3. **Smoke-test**: `curl <url>/api/panta/categories` → real array; then `/`, `/markets`, a market page.
4. **Reject a wallet signature**: confirm it reads `WALLET_REJECTED`, not a network error.
5. **Execute one real trade** (small amount) and record the signature.
6. **Verify attribution**: `GET <url>/api/panta/trades/<signature>` → `processed`. This is the submission evidence.
7. **Responsive + console pass** at 360 / 390 / 430 / 768 / 1024 / 1440 px.
8. **Claims**: only if you hold a resolved winning position; otherwise show the honest empty state.
9. **Create a market** only if you intend to spend the ~50 USDC fee.
10. **Screenshots + demo video** using `docs/DEMO_SCRIPT.md`.
11. **Traction** from `GET /account/metrics/` into `docs/SUBMISSION.md`.
12. **Submit** to Colosseum and to the Panta Sidetrack on Superteam Earn.

---

## Demo Checklist

Verified live during this audit, re-check immediately before recording, since markets move.

- **PRIMARY** `FFFcvy12DfhFMQTPieuGFHgzdXwkk24oXTRpbpXJPF9`. Andy Burnham announcement
- **BACKUP 1** `dsaUrqmxNRtGeEhYZv4hPeWRKXQbVY6LcxgDrA6cUSe`. Super Micro ($SMCI) close
- **BACKUP 2** `vQZWPdVNZPdDKnXQG822J4zKWbHthUq1ydeazaq475X`. Cisco FY2026 AI orders

All three named and in the **primary** phase. Full script: `docs/DEMO_SCRIPT.md`.

---

## Submission Checklist

- [x] Repository public and pushed
- [x] English throughout
- [x] Panta integration explained (`README.md`, `docs/ARCHITECTURE.md`, `docs/SUBMISSION.md`)
- [x] "Powered by Panta" on every Panta-powered surface, exact wording
- [x] Working prototype against live production Panta
- [x] Quality gate green
- [ ] Deployed URL
- [ ] Colosseum submission
- [ ] Panta Sidetrack submission (Superteam Earn)
- [ ] Demo video
- [ ] Screenshots
- [ ] Traction figures
- [ ] One real trade signature as evidence

---

## Known Limitations

Nothing hidden. Most are properties of the current Panta API rather than unfinished work.

1. **No transaction has been signed or broadcast.** Everything up to the signature is verified.
2. **Upstream instability is mitigated, not eliminated.** Retry raised market detail to 12/12; Panta can still fail a request, and the UI then shows an honest retryable error.
3. **`status` phase filtering is broken upstream**, so phase filters client-side over loaded markets.
4. **Pagination does not advance upstream**, so practical reach is one page (50 markets) per category.
5. **No catalog text search exists**, so search filters loaded markets, labelled as such.
6. **Most live markets have no question text on the list endpoint.** Detail is merged for the leading rows; genuinely nameless markets show their id.
7. **No P&L**, because positions carry no entry price. Estimated mark-to-market where a price exists; "Value unavailable" otherwise.
8. **Created Markets is account-scoped**, not wallet-scoped, where Panta does not expose `creatorAddress`. Disclosed in the UI; Panta enforces ownership on the claim.
9. **AI rate limiter is in-process**: per-instance on serverless, not a global quota.
10. **`/markets` cold load is ~10 s** (12 detail enrichments); warm is sub-second and a skeleton streams immediately.
11. **Visual responsive, browser-console and screen-reader checks were not executed**: no browser available. Code-level audits passed; manual steps are in the Responsive section.
12. **One high `npm audit` advisory remains** (`postcss`, transitive via Next). It is build-time CSS tooling exploited through attacker-controlled CSS, which this project does not process. Clearing it requires Next 16, evaluated and deliberately deferred (Bug 20).
