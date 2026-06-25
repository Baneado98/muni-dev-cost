# muni-dev-cost 🏗️

**What will the city and utility charge me to build here?**

`muni-dev-cost` is an MCP server (and a pay-per-call x402 API) that gives an AI
agent the **municipal development cost** for a US jurisdiction — the
impact/development fees, water & sewer **tap (connection) fees** and
**capital-recovery charges** a real-estate developer must pay before breaking
ground — **aggregated and normalized** from public, government-published fee
schedules into one comparable number.

For a real-estate development-feasibility / pro-forma agent, this number is
load-bearing and, today, costs **weeks of manual digging** across municipal
ordinances, utility fee schedules and county portals. We do the aggregation so
your agent doesn't have to.

```jsonc
// add to your MCP client config
{ "mcpServers": { "muni-dev-cost": { "command": "npx", "args": ["-y", "muni-dev-cost-mcp"] } } }
```

## Tools

| Tool | Tier | What you get |
|---|---|---|
| `get_dev_costs` | **Free** | The aggregated municipal development cost for a jurisdiction (single-family home), split into water+sewer vs other impact, with a per-fee summary and an honest coverage label. |
| `get_fee_breakdown` | Premium | Every fee line by line, grouped (Water / Sewer / Transportation / Parks / Drainage), with the **per-meter-size schedule** and each source + effective date. |
| `compare_jurisdictions` | Premium | Rank 2–12 markets side by side for **site selection** — total, water+sewer split, the dollar/% spread and what it costs on a 100-unit project. |
| `get_water_sewer_detail` | Premium | Water & sewer connection cost **by meter size** (5/8" → 12") — the single biggest swing in a utility connection budget. |
| `estimate_dev_cost` | Premium | Whole-project fees (fees × units) with per-unit and extended line items, dev-type aware, explicit about exclusions. |
| `list_jurisdictions` | Premium | The full **coverage map** — every jurisdiction, its depth and data freshness, which publish a per-meter schedule, plus the benchmark states. |
| `get_fee_schedule_source` | Premium | The published **source document + per-fee provenance** (published vs estimated) behind a jurisdiction's number — defensible *trazabilidad* for a pro-forma. |
| `get_cost_trend` | Premium | The **real dated revision history** of a jurisdiction's headline fee (prior years + adopted future steps) with YoY delta and CAGR — never a projection. |
| `compare_by_meter_size` | Premium | One jurisdiction's water/sewer cost across **every published meter size**, ratioed to the 5/8" residential base. |
| `estimate_by_units` | Premium | **Multifamily/mixed** fee estimate by LUE (units × LUE-per-unit) — the way cities actually bill MF, so it doesn't overstate fees. |
| `get_total_dev_cost` | Premium | The **grand total across every fee category** (water/sewer, transportation, parks, drainage, public-safety, other), bucketed — with honest $0 buckets where a city simply doesn't charge that category. |
| `breakdown_by_fee_category` | Premium | Every line item within **one** category (e.g. all of a city's parks fees) with per-meter detail — errors honestly if the city doesn't levy that category. |
| `rank_jurisdictions_by_cost` | Premium | Rank the **entire covered KB** cheapest→priciest by water+sewer or total, with cheapest/median/priciest, the spread, and a site-selection insight — filterable by state/coverage. |
| `summarize_by_state` | Premium | A **state-level roll-up** over the whole KB: per state, the city count, min/median/max cost, cheapest/priciest city, and which fee categories are assessed — the map for "which states are cheap/expensive to build in." |

> **1 free + 13 premium tools.** The free `get_dev_costs` is the hook; the 13 premium tools are the depth a feasibility agent can't assemble itself.

### Example (free)

```
POST https://muni-dev-cost-mcp.vercel.app/dev-costs
{ "jurisdiction": "Phoenix, AZ" }
```

```
🏗️  Phoenix, AZ  ·  coverage 🟢 deep
   Municipal development cost, single-family home: $29,322
     • Water + sewer (impact + tap): $29,322
   Fees included (one line each):
     • Wastewater Collection impact fee: $5,127  (per dwelling)
     • Wastewater Treatment impact fee: $3,753  (per dwelling)
     • Water Transmission impact fee: $14,046  (per dwelling)
     • Water Treatment impact fee: $4,387  (per dwelling)
     • Water Resource Acquisition fee: $2,009  (per dwelling)
```

## Coverage (honest — *regla 7*)

We never pass off an estimate as a city's published number.

- 🟢 **deep** — the city's own water/sewer fee schedule was ingested, including
  the per-meter table. Figures are `published`.
- 🟡 **partial** — headline impact figures from public schedules; some categories
  estimated.
- 🟠 **estimated** — the exact city isn't in our deep KB yet, so figures are a
  **regional benchmark**, clearly marked. Use as order-of-magnitude only.

**Coverage today: 130 jurisdictions across 38 states — 109 deep (own
per-meter/per-LUE schedule ingested) + 21 partial.** Dense in the
high-growth markets a feasibility agent actually screens: TX (18), CO (18),
FL (18), NC (16), CA (11), plus AZ, GA, WA, OR and more. From the cheapest
covered market (Mobile, AL ~$1,000) to the priciest (Erie, CO ~$78,350),
ranked and queryable. Any US city not yet ingested returns an honest state
benchmark estimate — and the deep KB grows every iteration.

All fee data is sourced from **public, government-published** fee schedules
(works of US municipal government → public domain). Each jurisdiction carries its
source URL and effective date. **Indicative — verify the exact amount with the
jurisdiction.** Not legal or fee-certification advice.

## Two ways to pay for the premium tools

- 💳 **Card (Stripe)** — buy a prepaid API key at `/pro/checkout`, then set
  `"env": { "MUNI_DEV_COST_KEY": "<key>" }`.
- 🪙 **x402 (USDC on Base)** — AI agents pay per call automatically; no signup.

The free `get_dev_costs` works with no key.

## How it stays a moat

The aggregation engine, the normalized fee knowledge base and the accumulating
per-jurisdiction cache run **server-side**. The npm package is a **thin client**:
it forwards your call to the hosted server and renders the response. The fee data
and the premium logic never ship in the tarball — a moat verified on every build
by `npm run test:moat`.

## License

MIT. Source: https://github.com/Baneado98/muni-dev-cost
