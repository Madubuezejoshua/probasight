# Required keys & final E2E setup

Everything you must supply before the final end-to-end test, and exactly what each key
unblocks.

Nothing here is invented: every variable maps to a real service this application actually
calls.

---

## 1. Variable table

| Variable | Required? | Server or public | What it is used for | Where you obtain it | Status right now | Final test it unblocks |
| --- | --- | --- | --- | --- | --- | --- |
| `PANTA_API_KEY` | **Required** | **Server only** | Authenticates every Panta call: catalog, market detail, trade tape, positions, quotes, builds, submits, trade reports, claims, market creation, image upload | Register + mint a key against the Panta API: see §2 | **PROVIDED** (`pk_test_`, verified live, sandbox catalog only, see §1a) | Sandbox flows verified. Real markets and real trading need a `pk_live_` key |
| `PANTA_API_BASE_URL` | Optional | Server only | Overrides the Panta base URL | Panta docs. Defaults to `https://live-api.panta.market/api/v1` | Defaulted, no action needed | None; only change if Panta gives you a different environment |
| `GROQ_API_KEY` | Optional (required for AI) | **Server only** | AI Market Intelligence analysis | <https://console.groq.com/keys> | **PROVIDED**: verified live, full 7-section analysis returned | Done |
| `GROQ_MODEL` | Optional | Server only | Groq model id | Groq model list. Defaults to `openai/gpt-oss-120b`, **verified live** | Defaulted, works | None. Do **not** set a `groq/compound*` model: those have built-in web search, which breaks the guarantee that analysis uses only the Panta snapshot |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Strongly recommended | Public (browser) | Broadcasting and confirming signed transactions | Helius / QuickNode / Triton / Alchemy | **PROVIDED**: Helius mainnet, verified live (`getHealth` ok, real blockhash returned) | Done |
| `NEXT_PUBLIC_SOLANA_NETWORK` | Optional | Public (browser) | Explorer link cluster | You choose: `mainnet-beta` / `devnet` / `testnet` | Defaulted to `mainnet-beta` | Correct explorer links only |

### Must stay server-side

`PANTA_API_KEY` and `GROQ_API_KEY` **must never** be renamed with a `NEXT_PUBLIC_` prefix.
That prefix is what tells Next.js to inline a value into the browser bundle. Both are read
only by modules marked `import "server-only"`, and the built client bundle was scanned to
confirm neither value nor any `process.env` server variable reaches it.

---

## 1a. Test key vs live key: read this before demoing

Panta keys are minted per environment via the `env` field:

| Prefix | What it returns |
| --- | --- |
| `pk_test_…` | **Sandbox fixtures.** One synthetic market ("Sandbox test market"), and quotes stamped `"Test mode: … does not access Solana mainnet."` Perfect for wiring and UI work |
| `pk_live_…` | **The real mainnet catalog**: real markets, real pricing, real trading |

Everything in this application works identically against both; the difference is entirely
which catalog Panta serves. **For a demo with real markets you need a `pk_live_` key.**

Mint one with your existing access token or your current key:

```bash
curl -X POST https://live-api.panta.market/api/v1/account/keys/ \
  -H "X-Api-Key: <your existing pk_test_ key>" \
  -H "Content-Type: application/json" \
  -d '{"env":"live","name":"panta-pulse-live","revokeOthers":false}'
```

Copy the returned `secret` into `PANTA_API_KEY`. As always it is shown **once only**.

## 2. Getting the Panta API key

Panta's public API needs a developer account. Per
<https://docs.panta.market/quickstart>:

```bash
# 1. Register: returns { access, refresh, userId, email, name }
curl -X POST https://live-api.panta.market/api/v1/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"<a strong password>","name":"Panta Pulse"}'

# 2. Mint an API key with the access token from step 1.
#    The plaintext `secret` is returned ONCE and never again.
curl -X POST https://live-api.panta.market/api/v1/account/keys/ \
  -H "Authorization: Bearer <access>" \
  -H "Content-Type: application/json" \
  -d '{"name":"panta-pulse"}'

# 3. Confirm it works and that market creation is permitted.
curl https://live-api.panta.market/api/v1/account/ \
  -H "X-Api-Key: pk_test_…"
```

Check that the account response shows `"canCreateMarkets": true`. If it is `false`, the
`/create` page will return `CREATE_NOT_PERMITTED` and you need Panta to enable it.

> I did not register an account on your behalf. Doing so would have created a real account
> tied to an email address on an external service. That is your call to make, and it takes
> about a minute.

---

## 3. Writing the keys

```bash
cp .env.example .env.local
```

Then fill in `.env.local`:

```dotenv
PANTA_API_KEY=pk_test_your_real_key_here
PANTA_API_BASE_URL=https://live-api.panta.market/api/v1
GROQ_API_KEY=gsk_your_real_key_here
GROQ_MODEL=openai/gpt-oss-120b
NEXT_PUBLIC_SOLANA_RPC_URL=https://your-dedicated-rpc-endpoint
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
```

`.env.local` is already in `.gitignore`. Never commit it.

For Vercel, add the same variables in **Project → Settings → Environment Variables**, with
`PANTA_API_KEY` and `GROQ_API_KEY` unprefixed so they stay server-side.

---

## 4. Wallet and funds needed tomorrow

| Need | Why | Roughly how much |
| --- | --- | --- |
| Phantom or Solflare on mainnet | Signs every transaction | N/A |
| SOL in that wallet | Solana network fees | 0.05 SOL is plenty |
| USDC in that wallet | The trade deposit itself | 5–20 USDC for one test trade |
| More USDC | Market creation fee, quoted by Panta before you sign | Panta quotes this exactly; its example is 50 USDC. **Read the quote before approving.** |

The create flow shows the exact fee and a warning that signing spends real funds, before
any wallet prompt appears.

---

## 5. Exact final E2E procedure for tomorrow

Run these in order. Steps 1–5 need no funds.

### Step 0: configure and start

```bash
cp .env.example .env.local     # then paste your real keys in
npm install
npm run verify                 # lint + typecheck + tests + build, all should pass
npm run start
```

### Step 1: confirm the key is live (no funds, 30 seconds)

```bash
curl -s http://localhost:3000/api/panta/categories | head -c 300
```

- **Expect:** `{"categories":["sports","crypto",…]}`
- If you get `UNAUTHORIZED`, the key is wrong or revoked.
- If you get `PANTA_NOT_CONFIGURED`, the server did not pick up `.env.local`, restart it.

Then:

```bash
curl -s "http://localhost:3000/api/panta/markets?limit=3" | head -c 600
```

- **Expect:** a real `items` array. Copy one `marketId`, you will reuse it below.

### Step 2: public browsing (no wallet, no funds)

1. Open `/` → trending markets render with real YES/NO percentages.
2. Open `/markets` → grid populates; click a category chip; click a phase chip; click
   **Load more**; type in the search box.
3. Open a market → header, prices, activity chart and trade tape all render.
4. Confirm **"Powered by Panta"** is visible on each of these pages.

### Step 3: AI analysis (needs `GROQ_API_KEY`, no funds)

On any market page, click **Analyze with AI**.

- **Expect:** all seven sections populate, summary, current market view, activity analysis,
  YES case, NO case, key uncertainties, data limitations.
- Confirm it does **not** cite outside news, and that it names its own data limitations.
- Click **Regenerate** to confirm a second run works.

### Step 4: wallet connect (no funds)

1. Click **Connect Wallet** → choose Phantom or Solflare → approve the connection.
2. The header shows a truncated address pill; open it and confirm copy + disconnect work.
3. Open `/portfolio`. If the wallet has no Panta history, you should see honest empty
   states, not errors.

### Step 5: wallet rejection path (no funds, important)

1. On a **primary-phase** market, enter `5` and click **Get quote**.
2. The quote preview should show estimated shares, average price and fee, with a countdown.
3. Click **Trade YES** → when the wallet prompts, **reject** it.
4. **Expect:** `WALLET_REJECTED`, "You declined the signature request in your wallet."
   It must *not* be reported as a network or API failure, and no retry may happen on its own.

### Step 6: real trade (spends USDC)

1. Same market, enter a small amount (5 USDC).
2. **Get quote** → **Trade YES/NO** → **approve** in the wallet.
3. Watch the status line progress: building → waiting for wallet → sending → confirming →
   reporting to Panta → verifying → completed.
4. **Expect on success:** the signature, a Panta order status (ideally `confirmed`), and an
   attribution status (`processed`, or `pending_attribution` if Panta has not indexed yet).
5. Click the signature link and confirm the transaction on Solscan.
6. Open `/portfolio` → the position appears. If it does not appear instantly, the
   "Position is updating" state is expected. Panta's indexer lags briefly.

### Step 7: attribution check

```bash
curl -s http://localhost:3000/api/panta/trades/<signature-from-step-6> | head -c 300
```

- **Expect:** `{"signature":"…","status":"processed", …}` or `pending_attribution`.
- This is the evidence of Panta trade attribution for the submission.

### Step 8: claims (only if you hold a claimable position)

Claims require a **resolved** market where you hold the winning side. If you do not have
one, open `/portfolio` → **Claimable** and confirm the honest empty state, then say so in
the demo rather than staging a fake claim.

If you do have one: click **Claim winnings** → approve → confirm the signature, and confirm
the win claim is reported to Panta.

### Step 9: market creation (spends the creation fee)

1. Open `/create`, fill in question, resolution rule, at least one source, category and
   timing. Keep the start time **at least an hour out**: Panta enforces this.
2. Upload an image (this exercises Panta's image-upload → Cloudinary path).
3. Click **Get creation quote**. **Read the fee.** It is real money.
4. If you want to go through with it: **Sign & create market** → approve.
5. **Expect:** market id, `registered` status, signature, and a working link to the new
   market page.
6. Open `/portfolio` → **Created Markets** → the new market is listed.

### Step 10: creator fees (only on a graduated market)

In **Created Markets**, click **Claim creator fees**. On a market that has not graduated,
Panta correctly returns `MARKET_NOT_GRADUATED` or `NO_CREATOR_FEES`, that is the flow
working, not a bug.

### Step 11: responsive pass

With devtools device emulation, check 360, 390, 430, 768, 1024 and 1440px on all five pages:

- no horizontal scrolling at any width
- mobile: trade opens as a bottom sheet from the sticky bar
- mobile: the activity and portfolio tables become stacked cards
- desktop: the trade rail sticks beside the market content

---

## 6. What is still missing right now

| Item | Impact | Who unblocks it |
| --- | --- | --- |
| ~~`PANTA_API_KEY`~~ | **Done.** Verified live, account active, `canCreateMarkets: true` | N/A |
| ~~`GROQ_API_KEY`~~ | **Done.** Verified live, full structured analysis returned | N/A |
| **`pk_live_` Panta key** | The current `pk_test_` key serves sandbox fixtures only (one synthetic market). Real markets, real pricing and real trading need a live key, see §1a | You, ~10 seconds |
| ~~Dedicated Solana RPC~~ | **Done.** Helius mainnet configured and verified | N/A |
| Funded wallet (SOL + USDC) | Blocks the real trade, claim and create steps | You |
| A resolved market where you hold the winning side | Blocks a live win-claim demo | Market conditions, not something to fake |

---

## 6a. A note on the RPC URL being public

`NEXT_PUBLIC_SOLANA_RPC_URL` is inlined into the browser bundle by design, the browser is
what broadcasts signed transactions, so it must be able to reach the RPC. The Helius API key
is therefore visible to anyone who opens the site. That is normal and expected for an RPC
endpoint, but before deploying publicly:

- restrict the key by domain/referrer in the Helius dashboard, and
- rotate it after the hackathon.

This is unrelated to `PANTA_API_KEY` and `GROQ_API_KEY`, which stay strictly server-side and
were verified absent from the client bundle.

**Rebuild after changing it.** `NEXT_PUBLIC_*` values are inlined at build time, not read at
runtime, so a change only reaches the browser after `npm run build`.

---

## 7. Also worth knowing

Two things only live testing could reveal, both already fixed in the code:

1. **Panta returns ISO-8601 timestamps, not the Unix integers the docs describe.** Handled:
   `unixToDate` accepts both, with regression tests pinning each format.
2. **Groq retired `llama-3.3-70b-versatile`.** The default is now `openai/gpt-oss-120b`,
   verified against Groq's live model list and confirmed to support JSON mode.
