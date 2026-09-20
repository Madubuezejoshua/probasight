# Traction checklist

Written for: whoever fills in the traction section of the submission.

**Rule: never fabricate a number.** An honest "8 testers, 12 trades" is worth more to a judge
than an unverifiable "hundreds of users", and a fabricated figure is disqualifying if
checked. Every metric below has a stated source. If you cannot source it, leave it blank and
say why.

No analytics backend was built for this. Everything below uses either hosting analytics that
already exist or Panta's own attribution data.

---

## 1. Panta-attributed trades: the strongest metric

This is the number the Panta Sidetrack cares about most, and it is the one you can prove.

Because Panta Pulse reports every primary buy and win claim to `POST /trades/`, all volume
routed through it is attributed to your API key's account.

**How to read it:**

```bash
curl https://live-api.panta.market/api/v1/account/metrics/ \
  -H "X-Api-Key: pk_live_…"
```

Record from the response:

| Figure | Field |
| --- | --- |
| Total attributed trades | `summary.trades.total` |
| Attributed volume (USDC base units) | `summary.trades.volumeUsdcBase`, divide by 1,000,000 |
| Breakdown by kind (buy vs claim) | `summary.trades.byKind` |
| Markets created via Panta Pulse | `summary.creates.total` |

Also available: `GET /account/dashboard/` for the same counters in aggregate form.

**Record:**

- Attributed trades: _____
- Attributed volume: _____ USDC
- Markets created: _____
- Date/time measured: _____

> Note: attributed volume is not revenue. Panta's docs note protocol trading fees are not
> returned as a separate field and would have to be estimated from on-chain `MarketConfig`
> (often 200 bps). If you quote a fee figure at all, label it as an estimate.

## 2. Individual trade verification

For each trade you want to cite, capture the signature and confirm its attribution status:

```bash
curl https://live-api.panta.market/api/v1/trades/<signature>/ -H "X-Api-Key: pk_live_…"
```

`"status": "processed"` is proof of attribution. Keep a short table:

| # | Signature | Market | Status | Date |
| --- | --- | --- | --- | --- |
| 1 | | | | |
| 2 | | | | |

Solscan links make this independently checkable by a judge.

## 3. Deployed visitors

If deployed on Vercel: **Project → Analytics**. Record unique visitors and page views for a
stated window.

- Unique visitors: _____
- Page views: _____
- Window measured: _____ to _____
- Source: _____

If analytics are not enabled, write "not measured" rather than guessing.

## 4. Wallets connected

There is no server-side user tracking in this product, and none should be added for a
hackathon metric.

Two honest options:

1. **Derive it from Panta.** Distinct wallets appearing in your attributed trade rows
   (`GET /account/metrics/` → `trades[].wallet`) is a real, verifiable count of wallets that
   actually transacted.
2. **Count testers manually.** Ask each tester to confirm they connected. Report the count
   and say it was self-reported.

- Distinct transacting wallets (from Panta): _____
- Testers who confirmed connecting: _____

## 5. Testers who completed the core flow

The core loop is: discover → analyse → connect → trade → see the position.

Ask each tester directly and count confirmations. Record honestly:

- Testers who completed the full loop: _____
- Testers who started but did not finish: _____
- Where they dropped off: _____

Drop-off data is genuinely useful to a judge, it reads as real usage, not marketing.

## 6. Markets created

From `GET /account/metrics/` → `summary.creates.total`, and cross-checkable in the app at
**Portfolio → Created Markets**.

- Markets created: _____
- Market IDs: _____

## 7. Tester feedback

Collect 3–5 short verbatim quotes. Get permission to attribute, or anonymise as
"a tester" / "a first-time prediction-market user".

| # | Quote | Attribution | Consent given |
| --- | --- | --- | --- |
| 1 | | | |
| 2 | | | |
| 3 | | | |

Include at least one piece of **critical** feedback and what you changed in response.
Judges respond well to it and it signals real testing.

---

## Fastest path to real traction before submission

If you have a few hours:

1. Deploy and enable hosting analytics. *(15 min)*
2. Complete one real trade yourself, end to end, and capture the signature. *(10 min)*
3. Create one real market and capture the market id. *(15 min)*
4. Get 5–10 people to run the core loop on a funded wallet. *(1–2 hours)*
5. Pull `GET /account/metrics/` and record every figure with a timestamp. *(5 min)*
6. Collect written feedback from each tester. *(30 min)*
7. Fill in `SUBMISSION.md` with the real numbers and delete every placeholder.

---

## Final check before submitting

- [ ] Every number in `SUBMISSION.md` traces to a source listed here
- [ ] No placeholder underscores remain in `SUBMISSION.md`
- [ ] Attributed trade count verified against `GET /account/metrics/`
- [ ] At least one trade signature is independently checkable on Solscan
- [ ] Any unmeasured metric says "not measured" rather than showing a guess
- [ ] Tester quotes have consent
- [ ] The measurement date/time is stated for every figure
