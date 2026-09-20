# Demo script: Panta Pulse

Written for: whoever is presenting this to the Colosseum / Panta Sidetrack judges.

**Target length: 2–4 minutes.** Practise once end-to-end before recording.

---

## Demo markets: verified live during the final audit

All three are **named** and in the **primary** phase, so they are tradable and readable.
Markets change phase without warning: re-check all three immediately before recording and
keep the backups open in other tabs.

| Role | Market | Id |
| --- | --- | --- |
| **PRIMARY** | *Will Prime Minister Andy Burnham formally announce a delay, reduction, or full cancellation…* | `FFFcvy12DfhFMQTPieuGFHgzdXwkk24oXTRpbpXJPF9` |
| **BACKUP 1** | *Will Super Micro Computer's stock price ($SMCI) close at or above $37.00…* | `dsaUrqmxNRtGeEhYZv4hPeWRKXQbVY6LcxgDrA6cUSe` |
| **BACKUP 2** | *Will Cisco Systems (CSCO) report cumulative FY2026 AI infrastructure orders…* | `vQZWPdVNZPdDKnXQG822J4zKWbHthUq1ydeazaq475X` |

> **Catalog caveat, worth knowing before a judge asks.** Most live Panta markets currently
> return no question text on the list endpoint. Panta Pulse merges market detail into the
> leading cards so real questions appear, but some rows are genuinely nameless upstream and
> show their market id instead. Say exactly that if asked, it is upstream data, and
> inventing a title would be fabrication.

---

## Before you start

- [ ] `.env.local` filled in with a real `PANTA_API_KEY` and `GROQ_API_KEY`
- [ ] `npm run build && npm run start`, or open the deployed URL
- [ ] Wallet connected **and already funded** (a few USDC + 0.05 SOL), do not spend demo
      time on a faucet
- [ ] All three markets above re-confirmed as `primary`
- [ ] Pre-run the AI analysis once on your chosen market so it is warm in session cache,
      then click **Regenerate** on camera so the judges see it generate live
- [ ] Browser zoom at 100%, devtools closed, notifications off

---

## The run

### 0:00–0:20: What this is

Open `/`.

> "Panta Pulse turns Panta prediction markets into an AI intelligence and trading terminal.
> Panta provides the market infrastructure, the catalog, the pricing, the settlement.
> Panta Pulse provides the research layer and the user experience on top of it."

Point at the trending cards.

> "Every market here is live from the Panta catalog, with real YES/NO pricing."

### 0:20–0:40: Discovery

Click **Explore Markets**.

> "Category filtering is a real Panta query parameter."

Click a category chip. Click **Primary**.

> "Phase is filtered here on each market's actual phase field, because Panta's status
> parameter doesn't filter reliably, we tested it and it returns cancelled and resolved
> rows for a primary query. We'd rather be correct than pretend. Same with search: Panta's
> catalog has no text-search parameter, so the box filters what's loaded and says so."

### 0:40–1:00: Market detail

Open your chosen market.

> "This is the showpiece. Market header with live YES/NO pricing in USDC per share, each
> winning share settles at one USDC, so a 0.62 price is a 62% implied chance."

Scroll to the chart.

> "This is cumulative YES versus NO share flow, built from Panta's actual trade tape. It is
> deliberately not a price chart. Panta's trade rows carry share quantities and fees, not
> the USDC spent, so an execution price can't be derived from them without inventing a fee
> assumption. We'd rather show what's true than what looks impressive."

*(That line lands well with technical judges. Keep it.)*

### 1:00–1:45: AI Market Intelligence ← **the originality moment**

Click **Regenerate** on the AI panel (or **Analyze with AI** if cold).

> "This is our originality layer. It isn't a chatbot, it's a structured research pass over
> one thing: this market's own live Panta data. Catalog fields, phase, pricing, timing,
> resolution metadata, and the recent trade tape."

As sections appear, point at them:

> "Summary. What the current pricing implies. What the trade tape shows. Then a balanced YES
> case and NO case, not a recommendation, a framing of what each side requires under this
> market's own resolution rule."

Then point specifically at **Data limitations**:

> "And this section is the point. The model has no news feed and no web access, and it's
> required to name exactly what it can't see rather than filling the gap. It never tells you
> what to trade."

### 1:45–2:30: Trading

Scroll to the trade panel (or tap the sticky bar on mobile).

> "The trade ticket is scoped precisely to what Panta's API supports: a side, a USDC amount,
> and a quoted fill on the bonding curve. No fake limit orders, no order book."

Enter `5`, click **Get quote**.

> "That's a real Panta quote, estimated shares, average price, protocol fee, and a live
> expiry countdown, because Panta quotes last about ninety seconds."

Click **Trade YES**, approve in the wallet, and narrate the status line as it moves:

> "Building through Panta, wallet signs in the browser, broadcast on our own RPC, confirmed
> on Solana, then reported back to Panta for attribution and verified."

When it completes:

> "Signature, Panta order status, and attribution status, re-checkable right here. That
> reporting step is how Panta attributes volume to an integration, so we treat it as a
> first-class step rather than a side effect. Panta also embeds an attribution memo in the
> transaction itself."

### 2:30–2:50: Portfolio

Click **View position**.

> "Positions, activity and claims, all read live from Panta for the connected wallet."

Point at the value column.

> "Estimated value is shares times the current side price for open markets, and settlement
> value once resolved. There's no P&L, because Panta doesn't return an entry price, so
> computing one would be a guess. Where there's no usable price we say 'value unavailable'."

Open the **Claimable** tab.

> "Winnings appear here only once Panta marks a position claimable. The claim builds through
> Panta, signs in your wallet, broadcasts, and gets reported for attribution."

*(If you have a genuinely claimable position, claim it here. If not, say exactly that,
do not stage one.)*

### 2:50–3:20: Creator loop

Open `/create`.

> "The creator side is complete too. Question, resolution rule, sources of truth, category
> and timing, all mapped to Panta's creation schema. The image goes through Panta's own
> upload helper straight to storage, never through our server."

Click **Get creation quote**.

> "Panta validates everything and returns the exact creation fee before anything is signed.
> Sign, broadcast, and register, and Panta verifies the on-chain transaction fail-closed
> before the market is listed."

*(Only complete the purchase if you intend to spend the fee on camera.)*

Mention creator fees:

> "Created markets show up in the portfolio with a creator-fee claim. That one deliberately
> skips the trade-report step, because Panta rejects creator-fee signatures for attribution."

### 3:20–3:40: Close on architecture

> "So: Panta provides the market infrastructure. Panta Pulse provides the intelligence and
> the user experience on top of it.
>
> The developer key never reaches the browser, every Panta call is proxied server-side.
> We never hold keys or funds; your wallet signs everything. And there's no database:
> Panta is the source of truth for markets and positions, Solana for transactions, and
> the AI analysis is generated on demand.
>
> Powered by Panta."

---

## If something breaks mid-demo

| Symptom | Say this, then do this |
| --- | --- |
| Market left the primary phase | "Markets move, that's a live catalog." Switch to a backup |
| A card shows a market id instead of a question | "Panta's list endpoint returns no title for some markets. We merge detail where we can, and never invent one" |
| An error says "try again" | "Panta's API intermittently rejects valid requests. We classify that as transient and retry reads automatically" |
| Quote returns `MARKET_NOT_IN_PRIMARY` | "This one left the primary phase." Switch markets |
| `QUOTE_STALE` | "The curve moved past our slippage tolerance. Panta caught it." Re-quote |
| Wallet prompt is slow | Keep talking about the status line; it is showing the real stage |
| AI is slow | "It's doing a full structured pass", let it finish, do not reload |
| RPC broadcast fails | "Public RPCs are rate-limited", retry; this is why a dedicated RPC matters |
| Position not visible yet | Point at the "Position is updating" state: "Panta's indexer lags the chain briefly, we show that honestly instead of claiming failure" |

**Every one of these is a real state the product handles.** Narrating it calmly is better
than a demo that only works on rails.

---

## Points worth hitting if you have spare seconds

- Every Panta-powered surface shows **"Powered by Panta"**, per Panta's Terms §6.
- The whole thing is responsive: on mobile the trade ticket is a proper bottom sheet.
- 133 unit tests, clean lint, clean typecheck, clean production build.
- No database, no login, no custody, the connected wallet *is* the identity.
