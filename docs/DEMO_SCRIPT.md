# Demo script — Panta Pulse

Written for: whoever is presenting this to the Colosseum / Panta Sidetrack judges.

**Target length: 2–4 minutes.** Practise once end-to-end before recording.

---

## Before you start

- [ ] `.env.local` filled in with a real `PANTA_API_KEY` and `GROQ_API_KEY`
- [ ] `npm run build && npm run start`, or open the deployed URL
- [ ] Wallet connected **and already funded** (a few USDC + 0.05 SOL) — do not spend demo
      time on a faucet
- [ ] **Pick two backup markets.** Markets close. Have a second and third `marketId` ready,
      preferably in different categories, all in the `primary` phase
- [ ] Pre-run the AI analysis once on your chosen market so it is warm in session cache —
      then click **Regenerate** on camera so the judges see it generate live
- [ ] Browser zoom at 100%, devtools closed, notifications off

---

## The run

### 0:00–0:20 — What this is

Open `/`.

> "Panta Pulse turns Panta prediction markets into an AI intelligence and trading terminal.
> Panta provides the market infrastructure — the catalog, the pricing, the settlement.
> Panta Pulse provides the research layer and the user experience on top of it."

Point at the trending cards.

> "Every market here is live from the Panta catalog, with real YES/NO pricing."

### 0:20–0:40 — Discovery

Click **Explore Markets**.

> "Filter by category and by market phase — both are real Panta query parameters."

Click a category chip. Click **Primary**.

> "Search filters what's loaded, because Panta's catalog endpoint doesn't expose a text
> search. We label it that way rather than pretending otherwise."

### 0:40–1:00 — Market detail

Open your chosen market.

> "This is the showpiece. Market header with live YES/NO pricing in USDC per share — each
> winning share settles at one USDC, so a 0.62 price is a 62% implied chance."

Scroll to the chart.

> "This is cumulative YES versus NO share flow, built from Panta's actual trade tape. It is
> deliberately not a price chart — Panta's trade rows carry share quantities and fees, not
> the USDC spent, so an execution price can't be derived from them without inventing a fee
> assumption. We'd rather show what's true than what looks impressive."

*(That line lands well with technical judges. Keep it.)*

### 1:00–1:45 — AI Market Intelligence ← **the originality moment**

Click **Regenerate** on the AI panel (or **Analyze with AI** if cold).

> "This is our originality layer. It isn't a chatbot — it's a structured research pass over
> one thing: this market's own live Panta data. Catalog fields, phase, pricing, timing,
> resolution metadata, and the recent trade tape."

As sections appear, point at them:

> "Summary. What the current pricing implies. What the trade tape shows. Then a balanced YES
> case and NO case — not a recommendation, a framing of what each side requires under this
> market's own resolution rule."

Then point specifically at **Data limitations**:

> "And this section is the point. The model has no news feed and no web access, and it's
> required to name exactly what it can't see rather than filling the gap. It never tells you
> what to trade."

### 1:45–2:30 — Trading

Scroll to the trade panel (or tap the sticky bar on mobile).

> "The trade ticket is scoped precisely to what Panta's API supports: a side, a USDC amount,
> and a quoted fill on the bonding curve. No fake limit orders, no order book."

Enter `5`, click **Get quote**.

> "That's a real Panta quote — estimated shares, average price, protocol fee, and a live
> expiry countdown, because Panta quotes last about ninety seconds."

Click **Trade YES**, approve in the wallet, and narrate the status line as it moves:

> "Building through Panta, wallet signs in the browser, broadcast on our own RPC, confirmed
> on Solana, then reported back to Panta for attribution and verified."

When it completes:

> "Signature, Panta order status, and attribution status. That trade-reporting step is
> explicit — it's how Panta attributes volume to an integration, and we treat it as a
> first-class step rather than a side effect."

### 2:30–2:50 — Portfolio

Click **View position**.

> "Positions, activity and claims, all read live from Panta for the connected wallet."

Point at the value column.

> "Estimated value is shares times the current side price for open markets, and settlement
> value once resolved. There's no P&L, because Panta doesn't return an entry price — so
> computing one would be a guess. Where there's no usable price we say 'value unavailable'."

Open the **Claimable** tab.

> "Winnings appear here only once Panta marks a position claimable. The claim builds through
> Panta, signs in your wallet, broadcasts, and gets reported for attribution."

*(If you have a genuinely claimable position, claim it here. If not, say exactly that —
do not stage one.)*

### 2:50–3:20 — Creator loop

Open `/create`.

> "The creator side is complete too. Question, resolution rule, sources of truth, category
> and timing — all mapped to Panta's creation schema. The image goes through Panta's own
> upload helper straight to storage, never through our server."

Click **Get creation quote**.

> "Panta validates everything and returns the exact creation fee before anything is signed.
> Sign, broadcast, and register — and Panta verifies the on-chain transaction fail-closed
> before the market is listed."

*(Only complete the purchase if you intend to spend the fee on camera.)*

Mention creator fees:

> "Created markets show up in the portfolio with a creator-fee claim. That one deliberately
> skips the trade-report step, because Panta rejects creator-fee signatures for attribution."

### 3:20–3:40 — Close on architecture

> "So: Panta provides the market infrastructure. Panta Pulse provides the intelligence and
> the user experience on top of it.
>
> The developer key never reaches the browser — every Panta call is proxied server-side.
> We never hold keys or funds; your wallet signs everything. And there's no database:
> Panta is the source of truth for markets and positions, Solana for transactions, and
> the AI analysis is generated on demand.
>
> Powered by Panta."

---

## If something breaks mid-demo

| Symptom | Say this, then do this |
| --- | --- |
| Market has closed | "Markets close — that's the live catalog." Switch to backup market #2 |
| Quote returns `MARKET_NOT_IN_PRIMARY` | "This one left the primary phase." Switch markets |
| `QUOTE_STALE` | "The curve moved past our slippage tolerance — Panta caught it." Re-quote |
| Wallet prompt is slow | Keep talking about the status line; it is showing the real stage |
| AI is slow | "It's doing a full structured pass" — let it finish, do not reload |
| RPC broadcast fails | "Public RPCs are rate-limited" — retry; this is why a dedicated RPC matters |
| Position not visible yet | Point at the "Position is updating" state: "Panta's indexer lags the chain briefly — we show that honestly instead of claiming failure" |

**Every one of these is a real state the product handles.** Narrating it calmly is better
than a demo that only works on rails.

---

## Points worth hitting if you have spare seconds

- Every Panta-powered surface shows **"Powered by Panta"**, per Panta's Terms §6.
- The whole thing is responsive: on mobile the trade ticket is a proper bottom sheet.
- 81 unit tests, clean lint, clean typecheck, clean production build.
- No database, no login, no custody — the connected wallet *is* the identity.
