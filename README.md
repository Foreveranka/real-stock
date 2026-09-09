# Real Stock

**Is that stock token real?**

Tokenized stocks are now issued onchain by Coinbase (on Base) and by Robinhood (on Robinhood Chain). Both issuers publish a canonical list, and both are surrounded by tokens that copy the ticker, the name and even the address prefix. Real Stock answers the three questions a trader actually needs answered before buying one:

1. Is this token really issued by the official issuer?
2. What is it worth right now against the reference price, and how stale is that reference?
3. Is my wallet even allowed to receive it?

Built for the Base Builder Quest (Tokenized Stocks), September 2026.

## Why

Memecoins are being launched in liquidity pairs with tokenized stock tokens. Two happened in the week before this was built, and they were not the same kind of thing at all.

- One was paired with a stock token that **no issuer had published**, an independently deployed contract carrying a real ticker.
- The other was paired with the **genuine issuer token** for the same style of asset.

From the outside the two look identical: same ticker, same kind of pool, same chain. Telling them apart by hand took twenty minutes of RPC calls. This page does it from one pasted address, and shows the evidence rather than a badge.

The observed market activity around those events is reported elsewhere; this project makes no claim about what caused it.

## What it checks

| Check | Base (Coinbase) | Robinhood Chain (Robinhood) |
|---|---|---|
| Canonical list | Exact address match against base.org/stocks | Exact address match against Robinhood's asset registry |
| Contract fingerprint | `contractURI()` metadata resolves to metadata.coinbase.com | Beacon proxy points at Robinhood's beacon, name ends with the official suffix |
| Corporate actions | `multiplier()` | `multiplier()` plus the registry's pending multiplier |
| Reference price | Chainlink total return feed on Base | Chainlink feed of the same underlying on Base |
| Market price | Best DEX pool, premium versus reference | Best DEX pool, premium versus reference |
| Transfer policy | Simulated transfer from the deepest pool to your wallet | Same, plus `paused()` |
| Look alikes | DexScreener search on ticker and company name | Same |

### The trap this exists for

On Base, `B20Factory.isB20()` returns **true for impostors too**. The factory is open to anyone, so a token can be a genuine B20, carry a `0xb2` address prefix, and still have nothing to do with Coinbase. `0xb2000000000000000000008b79a7be3f03091001` is a real B20 called "Apple Juice". Only the address on Coinbase's published list, plus the issuer metadata, proves the token.

On Robinhood Chain the fingerprint is cleaner: every official Stock Token is a beacon proxy pointing at the same beacon contract. A fake carrying the same ticker fails that check immediately.

### Cross issuer premium

Robinhood Chain has no price oracle of its own. Real Stock uses the Chainlink feed of the same underlying stock on Base as the reference, so for the thirteen stocks both issuers have listed you can see what the same company costs on each chain.

## Pages

- `index.html` — what it does, search, live totals
- `stocks.html` — every issued stock on the selected network with reference price, DEX price, 24h change, premium, multiplier, liquidity, volume and feed age, sortable and filterable
- `check.html?q=<address or ticker>` — the full check for one token, with look alikes and a shareable link
- `portfolio.html` — holdings on the selected network, valued at the reference price, with a per token transfer policy verdict

The network selector in the header switches every page between Base and Robinhood Chain, and the choice persists.

## How it is built

Static HTML, one shared script, one stylesheet. No backend, no build step, no API keys. Everything is read in the browser from:

- Base RPC: B20 precompiles, `B20Factory`, Chainlink feeds
- Robinhood Chain RPC: token calls, beacon storage slot, transfer simulation
- DexScreener public API: pools, prices, liquidity, volume
- `data/robinhood.json`: a cached snapshot of Robinhood's asset registry, because that endpoint sends no CORS header

Transfer policy is checked with `eth_call`, simulating a one unit transfer from the deepest liquidity pool to the connected wallet. Nothing is signed and no transaction is sent.

## Run it

```
python3 -m http.server 8934
```

Then open `http://localhost:8934/`.

## Machine readable directory

`data/directory.json` is the verified instrument directory in one versioned file: both issuers, every published token, the underlying, the reference feed address where one exists, and the source each entry came from with its capture date. Membership in that file is what makes a token issuer issued. Fingerprints and metadata are corroboration, and absence means not found in the issuer source at capture time, not proof of fraud.

## Sources

- Coinbase tokenized stocks on Base: base.org/stocks, docs.base.org
- Robinhood Stock Tokens: docs.robinhood.com/chain/contracts, api.robinhood.com/rhj/assets
- Chainlink tokenized equity feeds on Base

## Disclaimer

Informational only, not investment advice. Tokenized stocks are available only in eligible jurisdictions outside the US. Market hours ignore exchange holidays. Reference feeds freeze when US markets close, and the app says so rather than showing a stale number as if it were live.
