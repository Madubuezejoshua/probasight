# Panta Pulse

**An AI-powered prediction-market intelligence and trading terminal built on Panta.**

Panta Pulse turns Panta's prediction-market infrastructure into a professional research
and trading surface: discover markets, understand them through structured AI analysis,
connect a Solana wallet, trade YES/NO, track positions, claim winnings, create new markets,
and claim creator fees, all non-custodially.

Powered by Panta.

---

## Contents

- [What this is](#what-this-is)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Install](#install)
- [Environment setup](#environment-setup)
- [Run in development](#run-in-development)
- [Production build](#production-build)
- [Panta integration](#panta-integration)
- [Wallet security model](#wallet-security-model)
- [Routes](#routes)
- [Testing](#testing)
- [Deployment](#deployment)
- [Attribution requirement](#attribution-requirement)
- [Known limitations](#known-limitations)

---

## What this is

A single Next.js application with five pages and a server-side Panta integration layer.

| Surface | Purpose |
| --- | --- |
| `/` | Compact hero, live trending Panta markets, intelligence showcase, how-it-works |
| `/markets` | Discovery: category filter (server-side), phase + text filters (client-side), readable YES/NO pricing |
| `/markets/[marketId]` | Showpiece: market header, activity chart, AI intelligence, trade ticket, tape |
| `/portfolio` | Positions, claimable winnings, wallet activity, created markets + creator fees |
| `/create` | Market creation: form, live preview, Panta fee quote, sign, register |

There is **no user database, no login, and no custody**. A connected Solana wallet is the
user's identity for everything wallet-scoped. Panta is the source of truth for markets,
prices, positions and settlement; Solana is the source of truth for transactions.

---

## Architecture

```
Browser
  ├── Public market UI (server components where practical)
  ├── Solana wallet adapter (Phantom, Solflare)
  └── User-signed transactions ───────────────────────┐
         │                                            │
         │ fetch /api/*                                │ sendRawTransaction
         ▼                                            ▼
Next.js server (single deployable)              Solana RPC
  ├── /api/panta/*  ──► Panta API               (NEXT_PUBLIC_SOLANA_RPC_URL)
  │      with server-only PANTA_API_KEY
  └── /api/ai/market-analysis ──► Groq
         with server-only GROQ_API_KEY
```

Key properties:

- **The browser never holds the Panta developer key.** Every authenticated Panta call is
  proxied through our own route handlers. Public reads are proxied too, for one consistent
  architecture and immunity to upstream CORS/auth changes.
- **One Panta client.** `src/lib/panta/client.ts` owns the base URL, the API key, Panta's
  required trailing slashes, timeouts, rate-limit headers, error normalisation and safe
  logging. No component makes a raw `fetch` to Panta.
- **No database.** Nothing is persisted server-side. AI results are cached in the browser's
  `sessionStorage` only.
- **Every write is a Panta session.** Quote → build → sign in wallet → broadcast on our RPC
  → confirm with Panta. Sessions expire, and expired sessions are rebuilt rather than reused.

### Directory layout

```
src/
  app/
    page.tsx                     home
    markets/page.tsx             discovery
    markets/[marketId]/page.tsx  market detail
    portfolio/page.tsx           positions + claims
    create/page.tsx              market creation
    api/panta/*                  Panta proxy routes (server-only key)
    api/ai/market-analysis       Groq analysis route
    layout.tsx, globals.css, error.tsx, not-found.tsx
    (home)/          route group: homepage + its own loading boundary
    markets/(list)/  route group: list page + its own loading boundary
  components/
    layout/  wallet/  markets/  trading/  portfolio/  creation/  ai/  common/
  lib/
    panta/     client, markets, orders, positions, claims, create-market,
               trades, categories, enrich, errors, types
    solana/    connection, instructions, broadcast
    ai/        groq, prompts, market-context, schema
    validation/ schemas (Zod)
    utils/     format, time, cn
    env.ts, api-route.ts, client-api.ts, rate-limit.ts, image-upload.ts
tests/         unit tests (Vitest)
docs/          architecture, demo script, submission, keys, QA, traction
```

---

## Prerequisites

- **Node.js 20 or newer** (built and verified on Node 24)
- **npm 10+**
- A **Panta API key**: see [Environment setup](#environment-setup)
- A **Solana wallet** (Phantom or Solflare) for any wallet-scoped action
- USDC + a little SOL in that wallet to actually trade or create a market

---

## Install

```bash
npm install
```

---

## Environment setup

Copy the template and fill it in:

```bash
cp .env.example .env.local
```

`.env.local` is gitignored and must never be committed.

| Variable | Required | Side | Purpose |
| --- | --- | --- | --- |
| `PANTA_API_KEY` | **Yes** | Server | Authenticates every Panta call |
| `PANTA_API_BASE_URL` | No | Server | Defaults to `https://live-api.panta.market/api/v1` |
| `GROQ_API_KEY` | No | Server | AI Market Intelligence only |
| `GROQ_MODEL` | No | Server | Defaults to `openai/gpt-oss-120b`. Never set a `groq/compound*` model, those have built-in web search |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Recommended | Public | Broadcasting and confirming transactions |
| `NEXT_PUBLIC_SOLANA_NETWORK` | No | Public | Explorer links; defaults to `mainnet-beta` |

### Getting a Panta API key

Panta's public API requires a developer account. Per
[the Panta quickstart](https://docs.panta.market/quickstart):

1. `POST https://live-api.panta.market/api/v1/auth/register/` with your email, password and
   name, this returns an `access` JWT.
2. `POST https://live-api.panta.market/api/v1/account/keys/` with
   `Authorization: Bearer <access>`, this returns the plaintext `secret`
   (`pk_test_…` or `pk_live_…`) **once and only once**.
3. Put that secret in `PANTA_API_KEY`.

`canCreateMarkets` defaults to `true` on signup, which is what the `/create` page needs.

**`PANTA_API_KEY` and `GROQ_API_KEY` must never be prefixed with `NEXT_PUBLIC_`.** Doing so
would inline them into the browser bundle.

---

## Run in development

```bash
npm run dev
```

Open <http://localhost:3000>.

Without `PANTA_API_KEY` the application still builds and every page still renders, each
Panta-backed surface shows an explicit `PANTA_NOT_CONFIGURED` error state rather than
fabricated placeholder data.

---

## Production build

```bash
npm run build
npm run start
```

Or run the whole gate at once:

```bash
npm run verify   # lint + typecheck + tests + build
```

---

## Panta integration

Every Panta capability this product uses, and where it appears:

| Panta endpoint | Our route | Where it surfaces |
| --- | --- | --- |
| `GET /categories/` | `/api/panta/categories` | Markets filters, create form |
| `GET /markets/` | `/api/panta/markets` | Home, markets grid, created markets |
| `GET /markets/{id}/` | `/api/panta/markets/[marketId]` | Market detail, card prices, position values |
| `GET /markets/{id}/trades/` | `/api/panta/markets/[marketId]/trades` | Activity chart, trade tape, AI context |
| `GET /wallets/{wallet}/trades/` | `/api/panta/wallet-trades` | Portfolio → Activity |
| `GET /positions/?wallet=` | `/api/panta/positions` | Portfolio → Open + Claimable |
| `POST /primaryorderquote/` | `/api/panta/trade/quote` | Trade panel, quote preview |
| `POST /primaryorderbuild/` | `/api/panta/trade/build` | Trade panel, pre-signature |
| `POST /primaryordersubmit/` | `/api/panta/trade/submit` | Trade panel, post-broadcast |
| `POST /primaryorderverify/` | `/api/panta/trade/verify` | Trade panel, final status |
| `POST /trades/` | `/api/panta/trades/report` | Trade + win-claim attribution |
| `GET /trades/{signature}/` | `/api/panta/trades/[signature]` | Attribution status lookup |
| `POST /claim/build/` | `/api/panta/claims/winnings/build` | Portfolio → Claimable |
| `POST /claim/creator-fees/build/` | `/api/panta/claims/creator-fees/build` | Portfolio → Created Markets |
| `POST /markets/create/image-upload/` | `/api/panta/create/image` | Create form image upload |
| `POST /markets/create/quote/` | `/api/panta/create/quote` | Create form fee quote |
| `POST /markets/create/build/` | `/api/panta/create/build` | Create form, pre-signature |
| `POST /markets/register/` | `/api/panta/create/register` | Create form, post-broadcast |

### Transaction shapes

Panta returns two different things depending on the flow, and this matters:

- **Primary buy, win claim, creator-fee claim** return an **instruction list** plus a
  `recentBlockhash`. We compile a v0 `VersionedTransaction` in the browser
  (`src/lib/solana/instructions.ts`).
- **Market creation** returns a **fully-assembled base64 `VersionedTransaction`**, which we
  deserialise directly.

### Attribution asymmetry

Win claims and primary buys are reported to `POST /trades/` for volume attribution.
**Creator-fee claims are deliberately not reported**: Panta rejects those signatures with
`TX_MISMATCH`. This asymmetry is implemented explicitly in
`src/components/portfolio/useClaimFlow.ts`.

---

## Wallet security model

- Panta Pulse **never** asks for, receives, stores or transmits a private key or seed phrase.
- The wallet adapter yields a **public key** and a **signature**, nothing more.
- Every on-chain action requires an **explicit in-wallet approval**. There is no automatic
  signing and no silent retry of a signing prompt.
- Signed bytes are broadcast from the browser to the configured Solana RPC. The server never
  handles a signed transaction.
- A user rejection is classified distinctly (`WALLET_REJECTED`) from an API or RPC failure, so
  the UI never blames the network for a deliberate decline.
- Success is only declared once Panta acknowledges the signature. If the chain succeeded but
  a post-broadcast bookkeeping step failed, the UI says exactly that and shows the signature.

---

## Routes

**Pages:** `/`, `/markets`, `/markets/[marketId]`, `/portfolio`, `/create`

**API:** 21 route handlers under `/api/panta/*` and `/api/ai/*`, see the
[Panta integration](#panta-integration) table, plus `/api/panta/created-markets`.

Every mutating route validates its payload with Zod, enforces its HTTP method, normalises
upstream errors into one envelope, and returns:

```json
{ "error": { "code": "…", "message": "…", "details": { }, "retryable": false } }
```

---

## Testing

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest unit tests
npm run build       # production build
npm run verify      # all of the above
```

Unit coverage focuses on the logic where a silent bug would be most costly:

- USDC base-unit vs decimal formatting (Panta uses both, in different places)
- position value estimation, including resolved-market settlement
- Panta error normalisation across every documented code
- AI JSON schema parsing and rejection of malformed/partial output
- Zod route-input validation
- Solana instruction decoding, v0 compilation and signing-error classification

See `docs/QA_REPORT.md` for the full record of what was executed and what remains.

**Automated tests never spend funds.** No test signs a transaction, executes a trade, or
creates a paid market.

---

## Deployment

Target: **Vercel**.

1. Push the repository to GitHub.
2. Import it in Vercel (framework auto-detects as Next.js).
3. Add the environment variables from [Environment setup](#environment-setup).
   Set `PANTA_API_KEY` and `GROQ_API_KEY` as server variables, do **not** prefix them.
4. Deploy.

Use a dedicated Solana RPC (Helius, QuickNode, Triton, Alchemy) rather than the public
endpoint, which is heavily rate-limited and will make broadcasting unreliable.

Note: the AI rate limiter is in-process. On serverless it applies per instance, which is
adequate for abuse-resistance at this scale but is not a global quota.

---

## Attribution requirement

Panta's [Terms of Use §6](https://docs.panta.market/guides/terms-of-use) require any product
using the Panta API to display the exact wording **"Powered by Panta"**, clearly and
prominently, in a location associated with the Panta-powered functionality.

This is implemented in `src/components/common/PoweredByPanta.tsx` and rendered on the
homepage, markets page, market detail header, trade panel, AI panel, portfolio, create page
and footer. **Do not remove, abbreviate, hide or conditionally render it.**

---

## Known limitations

These are properties of the current Panta API, stated plainly rather than papered over:

1. **No text search.** `GET /markets/` supports `category`, `status`, `createdBy`, `cursor`
   and `limit`, there is no search parameter. The search box filters markets already
   loaded, and the UI says so.
2. **List rows carry no prices.** Panta documents that list rows do not live-RPC for prices.
   We enrich the first 12 rows per page via market detail; beyond that, cards show
   "Live price available on the market page" rather than an invented number.
3. **No price chart is possible from the public tape.** Catalog trade rows return share
   quantities, a fee and a block time, never the USDC spent. A per-trade execution price
   cannot be derived without assuming a fee rate, which would be fabricated. The market page
   therefore charts *cumulative YES/NO share flow*, which is genuinely derivable, and says so.
4. **No P&L.** Positions return current shares only, with no entry price or cost basis, so
   profit and loss cannot be computed unambiguously. We show estimated mark-to-market value
   where a price exists, and "Value unavailable" where it does not.
5. **Created markets are account-scoped, not wallet-scoped.** `createdBy=me` returns markets
   created by the *API account*. If catalog rows expose `creatorAddress` we filter to the
   connected wallet; otherwise the Created Markets tab shows all markets created through this
   application and says so. Panta still enforces ownership on the claim itself
   (`NOT_MARKET_CREATOR`). We did not add a database to work around this.
6. **Position valuation fans out.** Valuing positions requires one market-detail call per
   distinct market. We cap this at 24 per request and flag when it was truncated.
7. **Secondary-phase trading is not offered.** Panta's primary-buy endpoint is what the API
   exposes for this integration; there is no sell or order-book endpoint, so the trade ticket
   does not pretend to offer one.
