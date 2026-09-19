# Architecture

Written for: an engineer picking this codebase up cold.

---

## 1. Shape of the system

One Next.js App Router application. No separate backend, no database, no queue.

```
Browser                                  Next.js server              External
────────────────────────────────────────────────────────────────────────────────
Server components ──── render ─────────► lib/panta/*  ──────────────► Panta API
                                          (PANTA_API_KEY)
Client components ──── fetch ──────────► /api/panta/* ──────────────► Panta API
                  ──── fetch ──────────► /api/ai/*    ──────────────► Groq

Wallet adapter ───── sign ─────────────────────────────────────────► user's wallet
Signed bytes  ───── sendRawTransaction ────────────────────────────► Solana RPC
Image bytes   ───── multipart POST ────────────────────────────────► Cloudinary
```

Three things never touch our server: the user's private key, the signed transaction, and
market image bytes. Two things never touch the browser: `PANTA_API_KEY` and `GROQ_API_KEY`.

---

## 2. The Panta client layer

`src/lib/panta/client.ts` is the only place that talks to Panta. It owns:

- base URL resolution from `PANTA_API_BASE_URL`
- the `X-Api-Key` header, and optional `X-User-Id` for attribution
- **trailing-slash enforcement** — Panta requires it on every path, and omitting it fails
- a 15s timeout via `AbortController`
- cache policy: `revalidate` for public reads, `no-store` for anything wallet-scoped
- rate-limit header capture (`X-RateLimit-*`)
- error normalisation through `normalizePantaError`
- logging that records route, status, Panta code and duration — and never a body or a secret

Everything above it is a thin typed wrapper: `markets.ts`, `orders.ts`, `positions.ts`,
`claims.ts`, `create-market.ts`, `trades.ts`, `categories.ts`. Each is marked
`import "server-only"` so a client component importing one fails at build time rather than
leaking a key at runtime.

### Error model

One shape everywhere:

```ts
{ code: string; message: string; details?: Record<string, unknown>; retryable: boolean }
```

`code` is Panta's documented code passed through verbatim (`QUOTE_STALE`, `NOT_CLAIMABLE`,
`TX_MISMATCH`, …) plus our own transport codes (`PANTA_NOT_CONFIGURED`, `WALLET_REJECTED`,
`BLOCKHASH_EXPIRED`, …). `message` is human copy mapped from the code, falling back to
Panta's own message for codes we have not mapped. `retryable` drives whether the UI offers a
retry button.

`REBUILD_CODES` marks the failures where the correct recovery is a fresh quote/build rather
than a retry: `QUOTE_EXPIRED`, `QUOTE_STALE`, `CREATE_EXPIRED`, `BLOCKHASH_EXPIRED`. Stale
session data is never re-signed.

---

## 3. Transaction handling

Panta returns two different payload shapes and they are handled differently:

| Flow | Panta returns | We do |
| --- | --- | --- |
| Primary buy | `instructions[]` + `recentBlockhash` | compile a v0 `VersionedTransaction` |
| Win claim | `instructions[]` + `recentBlockhash` | compile a v0 `VersionedTransaction` |
| Creator-fee claim | `instructions[]` + `recentBlockhash` | compile a v0 `VersionedTransaction` |
| Market creation | base64 `VersionedTransaction` | deserialise directly |

`src/lib/solana/instructions.ts` does the conversion, following the official Panta
playground's `instructionsToVersionedTx`: each instruction's base64 `data` becomes a Buffer,
each account's `{pubkey, isSigner, isWritable}` becomes an `AccountMeta`, and the whole list
is compiled with `TransactionMessage.compileToV0Message()` using the wallet as fee payer and
Panta's blockhash. Instruction order is preserved — Panta declares it significant.

`src/lib/solana/broadcast.ts` handles signing, broadcasting and confirmation, and
`classifySigningError` maps wallet/RPC failures onto distinct codes. This matters because
wallet adapters do not share an error type: Phantom uses `code: 4001`, Solflare throws a
`WalletSignTransactionError`, and various paths just throw an `Error` with a message. A user
declining must never be reported as a network failure.

### Lifecycle state machines

Three hooks own the multi-step flows, each with an explicit stage enum surfaced to the UI:

- `useTradeFlow` — quote → build → sign → broadcast → confirm → submit → report → verify
- `useClaimFlow` — build → sign → broadcast → confirm → (report, win claims only)
- `useCreateFlow` — quote → build → sign → broadcast → confirm → register

**The post-broadcast boundary is the important design point.** Once a transaction is on
chain, the user's funds have moved. A failure *after* that point is a bookkeeping problem,
not a lost trade, and the UI says so and shows the signature — rather than reporting a
generic failure that would make a user think their money vanished.

---

## 4. The attribution asymmetry

This is easy to get wrong, so it is deliberate and documented in the code:

| Flow | Reported to `POST /trades/`? |
| --- | --- |
| Primary buy | **Yes** (`kind: buy`) |
| Win claim | **Yes** (`kind: claim`) |
| Creator-fee claim | **No** — Panta returns `TX_MISMATCH` |

`useClaimFlow` branches on `kind` for exactly this reason.

---

## 5. Honest-data rules in code

The specification's absolute rule — never fabricate market data — shows up as concrete
decisions:

| Situation | What we do |
| --- | --- |
| List rows have `yesPrice: null` | Enrich the first 12 rows via market detail; beyond that show "Live price available on the market page" |
| A price is outside 0–1 | `priceToImpliedPercent` returns `null`; no percentage is shown |
| Trade rows have no USDC amount | No price chart. Chart cumulative share flow instead, and label it |
| Fewer than 2 timestamped trades | No chart at all, with an explanation |
| No entry price in positions | No P&L, anywhere |
| Position with no usable price reference | "Value unavailable", not 0 |
| Resolved market | Settlement (1/0), never a stale spot price |
| AI has no data for a section | The prompt requires it to say so; empty arrays fail schema validation |
| Panta key missing | `PANTA_NOT_CONFIGURED` error state, never placeholder markets |

Every formatter returns `—` for missing input rather than a substituted zero.

---

## 6. AI layer

`/api/ai/market-analysis` is the only AI surface:

1. Rate-limit by client IP (10/min, in-process).
2. Validate `marketId`.
3. Fetch market detail + up to 40 trade rows from Panta.
4. `buildMarketContext` assembles a snapshot where every missing field is the literal string
   `"unavailable"` — the model is told what it does *not* know.
5. Call Groq with a system prompt that forbids external facts, trade recommendations,
   guarantees and partisan framing, and demands strict JSON.
6. Parse against a Zod schema. On failure, retry **once** with a repair instruction. On a
   second failure, error out — malformed text is never rendered as trusted content.

Results are cached in the browser's `sessionStorage` keyed by market id. Nothing is stored
server-side.

---

## 7. Caching

| Data | Policy | Why |
| --- | --- | --- |
| Categories | 3600s revalidate | Effectively static allowlist |
| Market list | 30s revalidate | Public, changes slowly |
| Market detail | 10s revalidate | Public but carries live prices |
| Positions, wallet trades | `no-store` | Wallet-scoped; must never be shared |
| All mutations | `no-store` | Obviously |
| AI analysis | Browser session only | On demand, never automatic |

Public reads are amortised through Next's fetch cache, which is what makes the bounded
price-enrichment in `enrich.ts` affordable rather than N+1 abuse.

---

## 8. Design system

Tokens live in `@theme` in `src/app/globals.css` and are consumed as CSS variables.

Background `#080B10`, surfaces `#0E131A` / `#131A23` / `#171F2A`, border `#222B36`, text
`#F5F7FA`, muted `#8A96A8`, accent `#4FE0D0`. YES `#22C55E` and NO `#F43F5E` are **semantic
only** — they mark outcomes and never brand surfaces.

Accessibility decisions that are load-bearing rather than cosmetic:

- YES/NO always carry a text label, never colour alone; the selected side also gets a `✓`
  and `aria-pressed`
- visible focus rings via `:focus-visible`, and a skip link
- the mobile trade sheet is a real `role="dialog"` with focus trapping, Escape-to-close,
  scroll lock and focus restoration
- `prefers-reduced-motion` disables all animation
- tables become stacked cards below `sm` rather than being squeezed

---

## 9. What is deliberately absent

No database. No auth. No custom smart contract. No order book or sell flow (the API does not
expose one). No news provider. No leaderboard, chat, referrals or notifications. No Sentry.
No analytics backend.

Adding any of these would mean either duplicating what Panta already owns, or shipping a
feature the API cannot honestly back.
