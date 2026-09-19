# Panta Pulse — Submission

Written for: Colosseum Crypto World's Fair judges and the Panta API Sidetrack reviewers.

---

## Project name

**Panta Pulse**

## One-line description

An AI-powered prediction-market intelligence and trading terminal built on Panta.

---

## The problem

Prediction markets produce genuinely useful information — a continuously-updated,
money-backed probability for a real-world question. But the interface layer around them is
built for people who already know how to read a market.

A newcomer looking at "YES 0.62" gets no help with the questions that actually matter:

- What does this market resolve on, precisely?
- Is 0.62 the result of broad participation or three wallets?
- What would have to be true for each side to be right?
- What does this data genuinely *not* tell me?

The result is a familiar split: sophisticated traders extract value, everyone else either
bounces or guesses. Meanwhile the tooling that *does* exist tends to fill the comprehension
gap with hype, sportsbook framing, or an AI chatbot that confidently invents facts about the
underlying event.

## The solution

Panta Pulse puts a structured research layer directly between discovery and execution.

Every market page can generate an **AI Market Intelligence** pass built from one source: that
market's own live Panta data — catalog fields, phase, YES/NO pricing, timing, resolution
metadata, and the recent trade tape. It returns a fixed structure: summary, current market
view, activity analysis, a balanced YES case and NO case, key uncertainties, and an explicit
list of data limitations.

It has no news feed and no web access, and it is instructed to say what it cannot support
rather than fill the gap. It never recommends a trade.

That analysis sits inches from the trade ticket, so understanding and execution are one
surface rather than two products.

## Who it is for

- **People new to prediction markets** who can read a probability but not a market.
- **Active traders** who want fast, dense, honest market state without a sportsbook aesthetic.
- **Market creators** who want the full creation and creator-fee loop in one place.
- **Developers evaluating Panta**, as a worked reference for what the API supports end to end.

---

## Why Panta is essential

Panta is not a data source bolted onto this product — it is the entire market layer. Remove
it and there is no product left.

- **Markets** come from the Panta catalog: discovery, detail, pricing, phase, resolution.
- **Trading** is Panta's primary-buy lifecycle: quote → build → sign → broadcast → submit →
  report → verify.
- **Positions and settlement** come from Panta, including claim eligibility.
- **Market creation** is Panta's create session, fee quote, transaction build and register.
- **Creator economics** are Panta's creator-fee vault and claim flow.
- **The AI layer has nothing to analyse without Panta** — the entire context object is
  assembled from Panta responses.

Panta Pulse contributes the intelligence layer, the terminal UX, and the non-custodial
client architecture. Panta contributes everything underneath.

## Exact Panta API features used

All 18 documented endpoints this integration needs, every one wired to a real surface:

| Panta endpoint | Where it appears in the product |
| --- | --- |
| `GET /categories/` | Market filters, create-market category field |
| `GET /markets/` | Homepage trending, markets grid, created markets |
| `GET /markets/{id}/` | Market detail, card pricing, position valuation |
| `GET /markets/{id}/trades/` | Activity chart, trade tape, AI analysis context |
| `GET /wallets/{wallet}/trades/` | Portfolio → Activity |
| `GET /positions/?wallet=` | Portfolio → Open Positions and Claimable |
| `POST /primaryorderquote/` | Trade panel quote preview |
| `POST /primaryorderbuild/` | Trade panel, immediately before signing |
| `POST /primaryordersubmit/` | Trade panel, after broadcast |
| `POST /primaryorderverify/` | Trade panel, final order status |
| `POST /trades/` | Trade attribution for buys and win claims |
| `GET /trades/{signature}/` | Attribution status lookup |
| `POST /claim/build/` | Portfolio → Claim winnings |
| `POST /claim/creator-fees/build/` | Portfolio → Claim creator fees |
| `POST /markets/create/image-upload/` | Create form image upload |
| `POST /markets/create/quote/` | Create form fee quote |
| `POST /markets/create/build/` | Create form, before signing |
| `POST /markets/register/` | Create form, after broadcast |

**Attribution is treated as a first-class step, not an afterthought.** Primary buys and win
claims are explicitly reported to `POST /trades/`. Creator-fee claims deliberately are *not*,
because Panta rejects those signatures with `TX_MISMATCH` — the asymmetry is implemented
rather than glossed over.

---

## Technical architecture

One Next.js App Router application. No separate backend, no database, no queue.

```
Browser                          Next.js server              External
──────────────────────────────────────────────────────────────────────
UI + wallet adapter ──fetch──► /api/panta/*  ──────────────► Panta API
                                (server-only PANTA_API_KEY)
                    ──fetch──► /api/ai/*     ──────────────► Groq
                                (server-only GROQ_API_KEY)
signed bytes ─────────────────────────────────────────────► Solana RPC
image bytes  ─────────────────────────────────────────────► Cloudinary
```

- **Next.js 15 (App Router), React 19, TypeScript (strict), Tailwind CSS v4**
- **`@solana/web3.js` + wallet-adapter** (Phantom, Solflare)
- **Zod** on every mutating route
- **Groq** for analysis
- **Vercel** as the deployment target

Design decisions worth noting:

- **One Panta client.** A single module owns the base URL, key, Panta's mandatory trailing
  slashes, timeouts, rate-limit headers, error normalisation and secret-free logging.
- **Server-only enforcement.** Every module touching a secret is marked `import "server-only"`,
  so a client component importing one fails the build instead of leaking at runtime. The
  built bundle was scanned to confirm no server env var reaches the browser.
- **Post-broadcast honesty.** Once a transaction lands, a later failure is a bookkeeping
  problem, not a lost trade — the UI says exactly that and shows the signature, rather than a
  generic error that would make a user think their funds vanished.
- **Expiry handling.** Panta quotes (~90s), orders (~120s) and create sessions (~5min) are
  counted down in the UI and invalidated on expiry. Stale session data is never re-signed.

## AI approach

- **On demand only.** Groq is never called on render or in bulk across cards.
- **Panta-only context.** Missing fields are passed as the literal string `"unavailable"`, so
  the model is told what it does not know instead of guessing.
- **Strict structured output**, validated with Zod. One repair retry on a schema miss; a
  second failure errors out rather than rendering malformed text as trusted content.
- **Constrained by instruction**: no external facts, no trade recommendations, no guarantees,
  politically neutral on election markets, and required to state its own limitations.
- **No persistence.** Results cache in the browser session only.

## Non-custodial wallet model

- No private key or seed phrase is ever requested, received, stored or transmitted.
- The wallet yields a public key and a signature — nothing else.
- Every on-chain action requires explicit in-wallet approval. No automatic signing, and no
  silent retry of a signing prompt.
- Signed bytes go from the browser straight to the Solana RPC; the server never sees them.
- A user rejection is classified distinctly from an API or RPC failure.
- Success is declared only after Panta acknowledges the signature.

---

## Judging criteria mapping

### 1. Panta API Integration

All 18 endpoints above, spanning every documented functional group: catalog, orders,
positions, claims, creation and attribution. Panta is structurally load-bearing — the product
does not exist without it. "Powered by Panta" appears on every Panta-powered surface per
Terms §6.

### 2. Technical Execution

Non-custodial wallet signing; server-only API key with build-time enforcement; the complete
quote → build → sign → broadcast → confirm → report → verify lifecycle; both Panta
transaction shapes (instruction list and assembled base64 transaction) handled correctly;
distinct error states for 20+ failure modes; quote/session/blockhash expiry handled by
rebuilding; the creator-fee attribution exception implemented; fully typed; clean lint,
clean typecheck, 115 passing unit tests, clean production build.

### 3. Product & User Experience

Public browsing with no login; readable YES/NO pricing with implied percentages; one obvious
trade flow scoped exactly to what the API supports; a real mobile bottom-sheet trade ticket
with focus trapping; a portfolio with positions, activity and claims; the full creator loop;
skeletons, empty states and specific error copy on every surface; a professional dark
terminal aesthetic that is explicitly not a sportsbook.

### 4. Originality

A structured AI intelligence layer over prediction-market data that is defined as much by
what it refuses to do as what it does: no invented external facts, no trade recommendations,
balanced YES/NO framing, and a mandatory data-limitations section. It sits adjacent to the
trade ticket, making research and execution one surface.

The activity chart is a second example of the same principle: rather than fake a price line
from data that cannot support one, it charts cumulative share flow — which is genuinely
derivable — and labels exactly why.

### 5. Impact Potential

One interface works across every Panta category with no per-category code. It demonstrates
Panta as embeddable intelligence and trading infrastructure rather than a single-vertical
integration, and the same architecture — server-side key, non-custodial signing, structured
analysis — is the template any Panta integrator would need.

### 6. Traction

See `TRACTION_CHECKLIST.md` for the measurement plan. Panta attribution is correctly wired,
so trades executed through Panta Pulse are attributable to this integration via
`POST /trades/` and visible in `GET /account/metrics/`. **Traction numbers below are
placeholders and must be filled with real figures before submission.**

---

## Screenshots

*To be captured before submission:*

- [ ] Homepage with live trending markets
- [ ] Markets discovery grid with filters applied
- [ ] Market detail: header, activity chart, trade rail
- [ ] AI Market Intelligence panel, fully populated
- [ ] Trade flow mid-execution, showing the status line
- [ ] Portfolio with positions and claimable state
- [ ] Create market form with the creation quote
- [ ] Mobile: market detail + trade bottom sheet

## Links

- **Demo URL:** _to be filled after deployment_
- **GitHub:** _to be filled_
- **Demo video:** _to be filled_

## Traction

**All figures below are placeholders. Do not submit without replacing them with real
measurements — see `TRACTION_CHECKLIST.md`.**

- Deployed visitors: _____
- Wallets connected: _____
- Panta-attributed trades: _____
- Markets created through Panta Pulse: _____
- Testers completing the full loop: _____
- Tester feedback: _____

---

## Limitations and current scope

Stated plainly. Each is a property of the current Panta API, not an unfinished feature:

1. **No catalog text search** — `GET /markets/` exposes no search parameter, so search
   filters loaded markets and the UI labels it that way.
2. **List rows carry no prices** — we enrich the first 12 per page via market detail; beyond
   that, cards say pricing is on the market page rather than inventing a number.
3. **No price chart is derivable** — trade rows carry share quantities and fees but never the
   USDC spent. We chart cumulative share flow instead and explain why.
4. **No P&L** — positions have no entry price or cost basis, so it cannot be computed
   unambiguously. Estimated mark-to-market value is shown where a price exists;
   "Value unavailable" where it does not.
5. **Created markets are account-scoped** — `createdBy=me` is scoped to the API account, not
   a wallet. We filter by `creatorAddress` when present and disclose when we cannot. We did
   not add a database to work around it; Panta enforces ownership on the claim itself.
6. **Secondary-phase trading is not offered** — the API exposes primary buys for this
   integration, so the ticket does not pretend to offer sells or an order book.
7. **In-process AI rate limiting** — per-instance on serverless, not a global quota.

## Submission checklist

- [ ] Submitted to the official Colosseum hackathon
- [ ] Submitted separately to the Panta Sidetrack on Superteam Earn
- [x] All materials in English
- [ ] Working demo deployed and reachable
- [x] Panta integration explained in detail (this document + `ARCHITECTURE.md`)
- [x] "Powered by Panta" attribution present on all Panta-powered surfaces
- [ ] Screenshots captured
- [ ] Traction placeholders replaced with real numbers
