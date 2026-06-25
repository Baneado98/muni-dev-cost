// muni-dev-cost MCP server (THIN CLIENT — the moat).
//
// This module ships in the npm tarball. It runs NO aggregation locally: the
// jurisdiction resolver, the normalized fee KB, the grouping/compare logic and
// the accumulating per-jurisdiction cache ALL live on the hosted server. The
// client only forwards the call and RENDERS the JSON it gets back. The premium
// material (fee-by-fee detail, per-meter schedules, comparisons) is therefore
// impossible to extract from the package.
//
//   • get_dev_costs        → POST ${PRO_BASE}/dev-costs            (FREE — the hook)
//   • get_fee_breakdown    → POST ${PRO_BASE}/pro/fee-breakdown    (PAID)
//   • compare_jurisdictions→ POST ${PRO_BASE}/pro/compare          (PAID)
//   • get_water_sewer_detail→POST ${PRO_BASE}/pro/water-sewer      (PAID)
//   • estimate_dev_cost    → POST ${PRO_BASE}/pro/estimate         (PAID)
//
// Without a key, the paid tools show the UPSELL (they do NOT compute anything).
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { SERVER_VERSION, SERVER_NAME } from "./version.js";
const PRO_BASE = (process.env.MUNI_DEV_COST_PRO_URL ?? "https://muni-dev-cost-mcp.vercel.app").replace(/\/+$/, "");
const PRO_KEY = (process.env.MUNI_DEV_COST_KEY ?? "").trim();
const CHECKOUT_URL = (process.env.CHECKOUT_URL ?? "https://muni-dev-cost-mcp.vercel.app/#pro").trim();
const CHECKOUT_BASE = CHECKOUT_URL.replace(/#pro$/, "").replace(/\/+$/, "");
// ---- upsell copy ---------------------------------------------------------
function unlockBlock(httpPath) {
    return [
        "Two ways to unlock it — pick whichever fits you:",
        "",
        "  💳  Card (Stripe) — for humans/teams:",
        `      Buy a prepaid API key at  ${CHECKOUT_BASE}/pro/checkout`,
        "      then set it in your MCP config:",
        '          "env": { "MUNI_DEV_COST_KEY": "<your-key>" }',
        "",
        "  🪙  Pay per call with x402 (USDC) — for AI agents with a wallet:",
        `          POST ${PRO_BASE}${httpPath}   (an x402-aware client pays automatically)`,
        "",
        "Tip: get_dev_costs is free — it gives the aggregated headline number right now.",
    ];
}
const BREAKDOWN_PITCH = [
    "EVERY fee broken out line by line — water impact, sewer impact, water/sewer TAP & meter, transportation, parks, drainage — not just the aggregated total",
    "each line tagged with its BASIS (per-dwelling / per-LUE / per-meter / per-trip) and whether it's a PUBLISHED schedule figure or a regional estimate",
    "the full PER-METER-SIZE schedule where the city publishes one (5/8\" → 12\"), so you can price the actual meter your project needs",
    "fees GROUPED (Water / Sewer / Transportation / Parks / Drainage) with the % each is of the total — so you see what's actually driving the number",
    "the source URL + effective date for each jurisdiction, so the figure is defensible in a pro-forma",
];
function upsellBreakdown(label) {
    return [
        `🔒 The full fee breakdown for "${label}" is a premium check.`,
        "",
        "get_dev_costs (free) gives the aggregated development cost. get_fee_breakdown",
        "opens the fee-by-fee detail behind that number:",
        ...BREAKDOWN_PITCH.map((p) => `  • ${p}`),
        "",
        ...unlockBlock("/pro/fee-breakdown"),
    ].join("\n");
}
const COMPARE_PITCH = [
    "two-to-twelve jurisdictions side by side, RANKED cheapest-to-priciest on municipal development cost per unit",
    "the water+sewer vs other-impact split for each, so you see WHERE one market is dearer",
    "the dollar SPREAD and % gap between the cheapest and priciest — and what that spread costs on a 100-unit project",
    "the site-selection insight: which jurisdiction's fees make or break the pro-forma",
];
function upsellCompare(label) {
    return [
        `🔒 Multi-jurisdiction comparison (${label}) is a premium check.`,
        "",
        "get_dev_costs (free) gives one jurisdiction's number. compare_jurisdictions",
        "ranks several side by side for site selection:",
        ...COMPARE_PITCH.map((p) => `  • ${p}`),
        "",
        ...unlockBlock("/pro/compare"),
    ].join("\n");
}
const WATERSEWER_PITCH = [
    "water and sewer development cost split into IMPACT/capacity fee vs physical TAP/connection",
    "the full PER-METER-SIZE table (5/8\", 3/4\", 1\", 1.5\", 2\"… up to 12\") where the city publishes one — the figure that changes most with project size",
    "the right number for the ACTUAL meter your building needs (a 2\" meter can be 8–12× the residential 5/8\" fee)",
    "source + effective date, so the water/sewer line in your budget is defensible",
];
function upsellWaterSewer(label) {
    return [
        `🔒 Water/sewer detail by meter size for "${label}" is a premium check.`,
        "",
        "get_dev_costs (free) gives the aggregated number. get_water_sewer_detail opens",
        "the water & sewer connection cost by meter size:",
        ...WATERSEWER_PITCH.map((p) => `  • ${p}`),
        "",
        ...unlockBlock("/pro/water-sewer"),
    ].join("\n");
}
const ESTIMATE_PITCH = [
    "the total municipal fees for a WHOLE project — fees × number of units — not just the per-unit number",
    "per-unit and extended line items for every fee, so the developer sees the fee bill before breaking ground",
    "dev-type aware (single-family / multifamily / commercial / retail / office / industrial) with the per-unit basis",
    "explicit caveats: what's EXCLUDED (land, construction, financing) so the number isn't mistaken for total project cost",
];
function upsellEstimate(label) {
    return [
        `🔒 A project development-cost estimate for "${label}" is a premium check.`,
        "",
        "get_dev_costs (free) gives the per-home number. estimate_dev_cost scales it to",
        "your whole project (fees × units) with line items:",
        ...ESTIMATE_PITCH.map((p) => `  • ${p}`),
        "",
        ...unlockBlock("/pro/estimate"),
    ].join("\n");
}
const JURISDICTIONS_PITCH = [
    "the FULL coverage map — every jurisdiction we cover, its depth (deep / partial) and the per-fee data freshness",
    "which jurisdictions publish a per-meter schedule (the detail that drives a connection budget) vs a flat per-dwelling fee",
    "the headline water+sewer figure and source effective-date for each, so you know how current the data is before you rely on it",
    "the benchmark states where any city returns an honest state estimate when it's not yet in the deep KB",
];
function upsellJurisdictions() {
    return [
        "🔒 The full coverage map (which jurisdictions, how deep, how fresh) is a premium check.",
        "",
        "list_jurisdictions returns the directory an agent can't assemble itself:",
        ...JURISDICTIONS_PITCH.map((p) => `  • ${p}`),
        "",
        ...unlockBlock("/pro/jurisdictions"),
    ].join("\n");
}
const SOURCE_PITCH = [
    "the exact PUBLISHED document (name + URL + effective date) behind each jurisdiction's number — the trazabilidad a pro-forma needs",
    "per-fee provenance: which lines are lifted from the city's own schedule (published) vs a regional estimate, with the basis of each",
    "the published-vs-estimated share, so you know exactly how defensible the figure is before you put it in an underwriting model",
];
function upsellSource(label) {
    return [
        `🔒 The fee-schedule source & provenance for "${label}" is a premium check.`,
        "",
        "get_fee_schedule_source makes the number defensible:",
        ...SOURCE_PITCH.map((p) => `  • ${p}`),
        "",
        ...unlockBlock("/pro/source"),
    ].join("\n");
}
const TREND_PITCH = [
    "the REAL dated revision history of a jurisdiction's headline development fee — prior years + officially adopted future steps",
    "the year-over-year delta and the compound annual growth rate across the published span",
    "the underwriting signal: which rate to budget for the date you'll actually pull permits — not just today's",
    "never a forward projection by us — only the jurisdiction's own dated/adopted schedules",
];
function upsellTrend(label) {
    return [
        `🔒 The fee-revision history (cost trend) for "${label}" is a premium check.`,
        "",
        "get_cost_trend shows where the fee has been and where it's adopted to go:",
        ...TREND_PITCH.map((p) => `  • ${p}`),
        "",
        ...unlockBlock("/pro/trend"),
    ].join("\n");
}
const METERCOMPARE_PITCH = [
    "one jurisdiction's water/sewer development cost across EVERY meter size it publishes (5/8\" → 12\")",
    "the ratio of each meter to the 5/8\" residential base — a 2\" meter is often 8–12× the residential fee",
    "the single biggest swing in a utility-connection budget made explicit, so you size the right meter cost up front",
];
function upsellMeterCompare(label) {
    return [
        `🔒 The per-meter-size cost curve for "${label}" is a premium check.`,
        "",
        "compare_by_meter_size lays out the whole meter schedule:",
        ...METERCOMPARE_PITCH.map((p) => `  • ${p}`),
        "",
        ...unlockBlock("/pro/meter-compare"),
    ].join("\n");
}
const ESTIMATEUNITS_PITCH = [
    "a multifamily / mixed-use fee estimate by LUE (Living Unit Equivalent) — units × LUE-per-unit, the way cities actually bill MF",
    "captures that a small apartment unit is a FRACTION of a single-family LUE (≈0.6), not a full unit — the flat per-unit estimate overstates MF fees",
    "per-unit and extended line items, override the LUE factor with the jurisdiction's adopted one",
    "explicit about exclusions (land, construction, financing) so it isn't mistaken for total project cost",
];
function upsellEstimateUnits(label) {
    return [
        `🔒 An LUE-based multifamily estimate for "${label}" is a premium check.`,
        "",
        "estimate_by_units sizes the fee bill for a multifamily/mixed project:",
        ...ESTIMATEUNITS_PITCH.map((p) => `  • ${p}`),
        "",
        ...unlockBlock("/pro/estimate-units"),
    ].join("\n");
}
const TOTALCOST_PITCH = [
    "the GRAND TOTAL municipal development cost — every fee category we hold, not just water+sewer: transportation/streets, parks, drainage, fire, police, library, plus water & sewer",
    "bucketed (Water+Sewer / Transportation / Parks / Drainage / Public Safety / Other Public) with each category's % of the total",
    "the number a developer actually underwrites — in cities like Phoenix or Fresno the non-utility fees rival the water+sewer bill",
    "honest about $0 buckets: a city that doesn't levy a parks/transport impact fee shows $0 there ('not assessed', not 'missing')",
];
function upsellTotalCost(label) {
    return [
        `🔒 The grand-total development cost (all fee categories) for "${label}" is a premium check.`,
        "",
        "get_total_dev_cost sums the WHOLE municipal fee bill, bucketed:",
        ...TOTALCOST_PITCH.map((p) => `  • ${p}`),
        "",
        ...unlockBlock("/pro/total-cost"),
    ].join("\n");
}
const CATEGORY_PITCH = [
    "every fee line within ONE category you name (parks / transportation / water / sewer / fire / police / drainage / library)",
    "the per-meter-size schedule for that category where the city publishes one",
    "lets your agent pull just the parks or just the transportation cost without parsing the whole breakdown",
];
function upsellCategory(label, cat) {
    return [
        `🔒 The ${cat || "fee-category"} breakdown for "${label}" is a premium check.`,
        "",
        "breakdown_by_fee_category isolates one category's fee lines:",
        ...CATEGORY_PITCH.map((p) => `  • ${p}`),
        "",
        ...unlockBlock("/pro/category"),
    ].join("\n");
}
const RANK_PITCH = [
    "EVERY covered US jurisdiction ranked cheapest→priciest on municipal development cost — the national site-selection leaderboard",
    "rank on water+sewer only OR the grand total across every fee category (water, sewer, transport, parks, drainage, fire, police, library)",
    "the cheapest, median and priciest markets, the dollar spread and what it costs on a 100-unit project — the single biggest controllable line in site selection",
    "filter by state or coverage; only the jurisdiction's OWN published figures are ranked (state-benchmark estimates excluded)",
    "the one answer an agent can't assemble itself: it needs the full normalized cross-jurisdiction dataset to produce it",
];
function upsellRank() {
    return [
        "🔒 The national development-cost ranking (cheapest→priciest to build) is a premium check.",
        "",
        "rank_jurisdictions_by_cost turns the whole normalized dataset into a leaderboard:",
        ...RANK_PITCH.map((p) => `  • ${p}`),
        "",
        ...unlockBlock("/pro/rank"),
    ].join("\n");
}
const STATE_SUMMARY_PITCH = [
    "every covered US state rolled up: how many cities we cover, and the min / median / max municipal development cost across them",
    "the cheapest and priciest city in each state, plus which fee categories the state's cities actually assess",
    "rank on water+sewer only OR the grand total across every fee category — the state-tier site-selection map a developer scans first",
    "a national roll-up too: the cheapest and priciest city anywhere we cover, and the national median",
    "computable only over the full normalized cross-jurisdiction dataset — it sharpens with every city added",
];
function upsellStateSummary() {
    return [
        "🔒 The state-by-state development-cost summary is a premium check.",
        "",
        "summarize_by_state rolls the whole normalized dataset up to the state tier:",
        ...STATE_SUMMARY_PITCH.map((p) => `  • ${p}`),
        "",
        ...unlockBlock("/pro/state-summary"),
    ].join("\n");
}
async function postHosted(path, body, paid) {
    const headers = {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": paid ? "muni-dev-cost-mcp/pro" : "muni-dev-cost-mcp/free",
    };
    if (paid && PRO_KEY)
        headers["Authorization"] = `Bearer ${PRO_KEY}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25_000);
    try {
        const res = await fetch(`${PRO_BASE}${path}`, { method: "POST", signal: ctrl.signal, headers, body: JSON.stringify(body) });
        if (res.status === 401 || res.status === 402 || res.status === 403)
            return { ok: false, status: res.status, error: "payment-required" };
        if (res.status === 429)
            return { ok: false, status: 429, error: "rate-limited" };
        if (res.status === 400 || res.status === 404 || res.status === 422) {
            try {
                const j = await res.json();
                return { ok: false, status: res.status, error: j?.error || `server responded ${res.status}` };
            }
            catch {
                return { ok: false, status: res.status, error: `server responded ${res.status}` };
            }
        }
        if (!res.ok)
            return { ok: false, status: res.status, error: `server responded ${res.status}` };
        return { ok: true, status: 200, result: (await res.json()) };
    }
    catch (err) {
        return { ok: false, status: 0, error: String(err?.message ?? err) };
    }
    finally {
        clearTimeout(t);
    }
}
function hostUnavailableText(label, detail) {
    return [
        `⚠️ muni-dev-cost is temporarily unavailable for "${label}".`,
        `   ${detail}`,
        "   The aggregation engine runs server-side; please retry shortly.",
    ].join("\n");
}
// ---- renderers -----------------------------------------------------------
function covBadge(c) {
    return c === "deep" ? "🟢 deep" : c === "partial" ? "🟡 partial" : "🟠 estimated";
}
function usd(n) { return "$" + Math.round(n).toLocaleString("en-US"); }
export function renderDevCosts(r) {
    const L = [];
    L.push(`🏗️  ${r.jurisdiction.name}  ·  coverage ${covBadge(r.jurisdiction.coverage)}`);
    L.push(`   Municipal development cost, single-family home: ${usd(r.singleFamily.total)}`);
    L.push(`     • Water + sewer (impact + tap): ${usd(r.singleFamily.waterSewer)}`);
    if (r.singleFamily.otherImpact > 0)
        L.push(`     • Other impact (transport/parks/drainage): ${usd(r.singleFamily.otherImpact)}`);
    L.push("");
    if (r.summary.length) {
        L.push("   Fees included (one line each):");
        for (const s of r.summary) {
            const tag = s.source === "published" ? "" : " [est]";
            L.push(`     • ${s.label}: ${usd(s.amount)}  (${s.basis.replace(/_/g, " ")})${tag}`);
        }
        L.push("");
    }
    L.push(`   ${r.coverageNote}`);
    if (r.sources.length) {
        const s = r.sources[0];
        L.push(`   Source: ${s.name}${s.effectiveDate ? ` (eff. ${s.effectiveDate})` : ""}${s.url ? `\n           ${s.url}` : ""}`);
    }
    L.push("");
    L.push("   🔒 For the fee-by-fee breakdown, per-meter water/sewer schedule, multi-jurisdiction");
    L.push("      comparison or a whole-project estimate, use the premium tools.");
    L.push(`   ⚠️  ${r.disclaimer}`);
    return L.join("\n");
}
export function renderBreakdown(r) {
    const L = [];
    L.push(`🧾 ${r.jurisdiction.name}  ·  ${r.devType.replace("_", "-")}  ·  coverage ${covBadge(r.jurisdiction.coverage)}  —  FEE BREAKDOWN`);
    L.push("");
    L.push("   Fee                                          Amount      Basis           Src");
    for (const l of r.lines) {
        const tag = l.source === "published" ? "pub" : "est";
        L.push(`   • ${l.label.padEnd(42).slice(0, 42)} ${usd(l.amount).padStart(9)}  ${l.basis.replace(/_/g, " ").padEnd(13)} ${tag}`);
        if (l.meterTable && l.meterTable.length) {
            const tbl = l.meterTable.map((m) => `${m.meter} ${usd(m.amount)}`).join("  ·  ");
            L.push(`        per-meter: ${tbl}`);
        }
    }
    L.push("   ════════════════════════════════════════════════════════════");
    L.push(`   TOTAL: ${usd(r.total)}`);
    L.push("");
    if (r.groups.length) {
        L.push("   By group:");
        for (const g of r.groups)
            L.push(`     • ${g.group.padEnd(20)} ${usd(g.total).padStart(9)}  (${g.pctOfTotal}%)`);
        L.push("");
    }
    if (r.notes.length) {
        for (const n of r.notes)
            L.push(`   ℹ️  ${n}`);
        L.push("");
    }
    if (r.sources.length)
        for (const s of r.sources)
            L.push(`   Source: ${s.name}${s.effectiveDate ? ` (eff. ${s.effectiveDate})` : ""}`);
    L.push("");
    L.push(`   ⚠️  ${r.disclaimer}`);
    return L.join("\n");
}
export function renderCompare(r) {
    const L = [];
    L.push(`📊 Jurisdiction comparison  ·  ${r.devType.replace("_", "-")}  —  ${r.jurisdictions.length} markets, ranked cheapest→priciest`);
    L.push("");
    L.push("   #  Jurisdiction              Total        Water+Sewer   Other     Cov");
    for (const j of r.jurisdictions) {
        L.push(`   ${String(j.rank).padStart(2)}  ${j.name.padEnd(24).slice(0, 24)} ${usd(j.total).padStart(10)}  ${usd(j.waterSewer).padStart(11)}  ${usd(j.otherImpact).padStart(8)}  ${j.coverage[0].toUpperCase()}`);
    }
    L.push("");
    L.push(`   🟢 Cheapest: ${r.cheapest.name} (${usd(r.cheapest.total)})`);
    L.push(`   🔴 Priciest: ${r.priciest.name} (${usd(r.priciest.total)})`);
    L.push(`   Spread: ${usd(r.spread.absUsd)} (+${r.spread.pct}%)`);
    L.push("");
    L.push(`   💡 ${r.insight}`);
    L.push("");
    L.push(`   ⚠️  ${r.disclaimer}`);
    return L.join("\n");
}
export function renderWaterSewer(r) {
    const L = [];
    L.push(`🚰 ${r.jurisdiction.name}  ·  meter ${r.meterSize}  ·  coverage ${covBadge(r.jurisdiction.coverage)}  —  WATER & SEWER DETAIL`);
    L.push("");
    L.push(`   Water:  impact ${usd(r.water.impact)}  +  tap ${usd(r.water.tap)}  =  ${usd(r.water.total)}`);
    if (r.water.meterTable?.length)
        L.push(`           by meter: ${r.water.meterTable.map((m) => `${m.meter} ${usd(m.amount)}`).join("  ·  ")}`);
    L.push(`   Sewer:  impact ${usd(r.sewer.impact)}  +  tap ${usd(r.sewer.tap)}  =  ${usd(r.sewer.total)}`);
    if (r.sewer.meterTable?.length)
        L.push(`           by meter: ${r.sewer.meterTable.map((m) => `${m.meter} ${usd(m.amount)}`).join("  ·  ")}`);
    L.push("   ════════════════════════════════════════");
    L.push(`   COMBINED water+sewer at ${r.meterSize}: ${usd(r.combinedTotal)}`);
    L.push("");
    L.push(`   ℹ️  ${r.note}`);
    if (r.sources.length)
        for (const s of r.sources)
            L.push(`   Source: ${s.name}${s.effectiveDate ? ` (eff. ${s.effectiveDate})` : ""}`);
    L.push("");
    L.push(`   ⚠️  ${r.disclaimer}`);
    return L.join("\n");
}
export function renderEstimate(r) {
    const L = [];
    L.push(`🧮 ${r.jurisdiction.name}  ·  ${r.project.units}× ${r.project.devType.replace("_", "-")}  ·  meter ${r.project.meterSize}  —  DEV-COST ESTIMATE`);
    L.push("");
    L.push("   Fee                                        Per-unit     Extended");
    for (const l of r.lines) {
        L.push(`   • ${l.label.padEnd(40).slice(0, 40)} ${usd(l.perUnit).padStart(9)}  ${usd(l.extended).padStart(11)}`);
    }
    L.push("   ════════════════════════════════════════════════════════════");
    L.push(`   Per unit:        ${usd(r.perUnit)}`);
    L.push(`   PROJECT TOTAL:   ${usd(r.feesTotal)}   (municipal fees only)`);
    L.push("");
    for (const c of r.caveats)
        L.push(`   • ${c}`);
    L.push("");
    L.push(`   ⚠️  ${r.disclaimer}`);
    return L.join("\n");
}
export function renderJurisdictions(r) {
    const L = [];
    L.push(`🗺️  muni-dev-cost coverage map  —  ${r.count.deep} deep · ${r.count.partial} partial · ${r.count.total} cities · ${r.count.benchmarkStates} benchmark states`);
    L.push("");
    L.push("   Cov  Jurisdiction              Water+Sewer  Meter?  Source eff.");
    for (const j of r.jurisdictions) {
        L.push(`   ${j.coverage[0].toUpperCase()}    ${j.name.padEnd(24).slice(0, 24)} ${usd(j.headlineWaterSewer).padStart(10)}   ${(j.hasPerMeterTable ? "yes" : "—").padEnd(5)}  ${j.source.effectiveDate ?? "n/a"}`);
    }
    L.push("");
    L.push(`   Benchmark states (any city returns a state estimate): ${r.benchmarkStates.join(", ")}`);
    L.push("");
    L.push(`   ℹ️  ${r.note}`);
    L.push(`   ⚠️  ${r.disclaimer}`);
    return L.join("\n");
}
export function renderSource(r) {
    const L = [];
    L.push(`📑 ${r.jurisdiction.name}  ·  coverage ${covBadge(r.jurisdiction.coverage)}  —  FEE-SCHEDULE SOURCE & PROVENANCE`);
    L.push("");
    L.push("   Published sources:");
    for (const s of r.sources) {
        L.push(`     • ${s.name}${s.effectiveDate ? `  (eff. ${s.effectiveDate})` : ""}`);
        if (s.url)
            L.push(`       ${s.url}`);
        if (s.retrievedDate)
            L.push(`       retrieved ${s.retrievedDate}; covers: ${s.covers.map((c) => c.replace(/_/g, " ")).join(", ")}`);
    }
    L.push("");
    L.push("   Per-fee provenance:");
    for (const f of r.perFeeProvenance) {
        L.push(`     • ${f.label.padEnd(44).slice(0, 44)} [${f.source}]  (${f.basis.replace(/_/g, " ")})`);
    }
    L.push("");
    L.push(`   Published share: ${r.publishedShare.published}/${r.publishedShare.published + r.publishedShare.estimated} fee lines published (${r.publishedShare.pctPublished}%)`);
    if (r.notes.length) {
        L.push("");
        for (const n of r.notes)
            L.push(`   ℹ️  ${n}`);
    }
    L.push("");
    L.push(`   ⚠️  ${r.disclaimer}`);
    return L.join("\n");
}
export function renderTrend(r) {
    const L = [];
    L.push(`📈 ${r.jurisdiction.name}  ·  coverage ${covBadge(r.jurisdiction.coverage)}  —  FEE COST TREND`);
    L.push(`   Metric: ${r.metric}`);
    L.push("");
    L.push("   Effective      Amount      Δ vs prev          Status");
    for (const rv of r.revisions) {
        const delta = rv.deltaFromPrev ? `${rv.deltaFromPrev.absUsd >= 0 ? "+" : ""}${usd(rv.deltaFromPrev.absUsd)} (${rv.deltaFromPrev.pct >= 0 ? "+" : ""}${rv.deltaFromPrev.pct}%)` : "—";
        L.push(`   ${rv.effectiveDate}  ${usd(rv.amount).padStart(9)}   ${delta.padEnd(17)}  ${rv.status}`);
        if (rv.note)
            L.push(`                  ${rv.note}`);
    }
    L.push("");
    if (r.cagrPct !== undefined && r.span)
        L.push(`   CAGR (published span ${r.span.from}→${r.span.to}, ${r.span.years}y): ~${r.cagrPct}%/yr`);
    L.push(`   💡 ${r.insight}`);
    L.push("");
    L.push(`   ℹ️  ${r.note}`);
    if (r.sources.length)
        for (const s of r.sources)
            L.push(`   Source: ${s.name}${s.effectiveDate ? ` (eff. ${s.effectiveDate})` : ""}`);
    L.push("");
    L.push(`   ⚠️  ${r.disclaimer}`);
    return L.join("\n");
}
export function renderMeterCompare(r) {
    const L = [];
    L.push(`📏 ${r.jurisdiction.name}  ·  ${r.category}  ·  coverage ${covBadge(r.jurisdiction.coverage)}  —  COST BY METER SIZE`);
    L.push("");
    L.push("   Meter     Cost        ×5/8\"");
    for (const row of r.rows) {
        L.push(`   ${row.meter.padEnd(7)} ${usd(row.amount).padStart(10)}   ${row.ratioTo58}×`);
    }
    L.push("");
    L.push(`   ℹ️  ${r.note}`);
    if (r.sources.length)
        for (const s of r.sources)
            L.push(`   Source: ${s.name}${s.effectiveDate ? ` (eff. ${s.effectiveDate})` : ""}`);
    L.push("");
    L.push(`   ⚠️  ${r.disclaimer}`);
    return L.join("\n");
}
export function renderEstimateUnits(r) {
    const L = [];
    L.push(`🏢 ${r.jurisdiction.name}  ·  ${r.project.units}× ${r.project.devType.replace("_", "-")}  ·  ${r.project.luePerUnit} LUE/unit = ${r.project.totalLue} LUE  —  LUE-BASED ESTIMATE`);
    L.push("");
    L.push("   Fee                                        Per-unit     Extended");
    for (const l of r.lines) {
        L.push(`   • ${l.label.padEnd(40).slice(0, 40)} ${usd(l.perUnit).padStart(9)}  ${usd(l.extended).padStart(11)}`);
    }
    L.push("   ════════════════════════════════════════════════════════════");
    L.push(`   Per unit:        ${usd(r.perUnit)}`);
    L.push(`   PROJECT TOTAL:   ${usd(r.feesTotal)}   (municipal fees only)`);
    L.push("");
    for (const c of r.caveats)
        L.push(`   • ${c}`);
    L.push("");
    L.push(`   ⚠️  ${r.disclaimer}`);
    return L.join("\n");
}
export function renderTotalCost(r) {
    const L = [];
    L.push(`🏛️ ${r.jurisdiction.name}  ·  ${r.devType.replace("_", "-")}  ·  meter ${r.meterSize}  ·  coverage ${covBadge(r.jurisdiction.coverage)}  —  TOTAL DEVELOPMENT COST`);
    L.push("");
    L.push(`   GRAND TOTAL (all municipal fees): ${usd(r.grandTotal)}`);
    L.push("");
    L.push("   By bucket:");
    const b = r.buckets;
    const rows = [
        ["Water + Sewer", b.waterSewer], ["Transportation/Streets", b.transportation],
        ["Parks", b.parks], ["Drainage/Stormwater", b.drainage],
        ["Public Safety (fire+police)", b.publicSafety], ["Other Public Facilities", b.otherPublic],
    ];
    for (const [name, val] of rows)
        if (val > 0)
            L.push(`     • ${name.padEnd(28)} ${usd(val).padStart(11)}`);
    L.push("");
    L.push("   By category:");
    for (const c of r.categories) {
        const tag = c.source === "published" ? "" : " [est]";
        L.push(`     • ${c.label.padEnd(34).slice(0, 34)} ${usd(c.total).padStart(10)}  (${c.pctOfTotal}%)${tag}`);
    }
    L.push("");
    if (!r.coversBeyondWaterSewer)
        L.push("   ℹ️  This jurisdiction's schedule covers water/sewer only (no transport/parks/fire impact fee assessed).");
    for (const n of r.notes.slice(0, 3))
        L.push(`   ℹ️  ${n}`);
    if (r.sources.length)
        for (const s of r.sources)
            L.push(`   Source: ${s.name}${s.effectiveDate ? ` (eff. ${s.effectiveDate})` : ""}`);
    L.push("");
    L.push(`   ⚠️  ${r.disclaimer}`);
    return L.join("\n");
}
export function renderCategory(r) {
    const L = [];
    L.push(`🗂️  ${r.jurisdiction.name}  ·  ${r.categoryLabel}  ·  coverage ${covBadge(r.jurisdiction.coverage)}  —  CATEGORY BREAKDOWN`);
    L.push("");
    for (const l of r.lines) {
        const tag = l.source === "published" ? "pub" : "est";
        L.push(`   • ${l.label.padEnd(44).slice(0, 44)} ${usd(l.amount).padStart(10)}  (${l.basis.replace(/_/g, " ")}) ${tag}`);
        if (l.meterTable && l.meterTable.length)
            L.push(`        per-meter: ${l.meterTable.map((m) => `${m.meter} ${usd(m.amount)}`).join("  ·  ")}`);
        if (l.note)
            L.push(`        ${l.note}`);
    }
    L.push("   ════════════════════════════════════════");
    L.push(`   ${r.categoryLabel} TOTAL: ${usd(r.total)}`);
    L.push("");
    L.push(`   ℹ️  ${r.note}`);
    if (r.sources.length)
        for (const s of r.sources)
            L.push(`   Source: ${s.name}${s.effectiveDate ? ` (eff. ${s.effectiveDate})` : ""}`);
    L.push("");
    L.push(`   ⚠️  ${r.disclaimer}`);
    return L.join("\n");
}
export function renderRank(r) {
    const L = [];
    const basisLabel = r.basis === "water_sewer" ? "water+sewer" : "total municipal (all categories)";
    L.push(`🏆 muni-dev-cost ranking  ·  ${r.devType.replace("_", "-")}  ·  meter ${r.meterSize}  —  cheapest→priciest by ${basisLabel}`);
    L.push(`   ${r.counted.deep} deep · ${r.counted.partial} partial · ${r.counted.total} jurisdictions ranked`);
    L.push("");
    L.push("   #   Jurisdiction              Total        Water+Sewer   Other     Cov");
    for (const j of r.rows) {
        L.push(`   ${String(j.rank).padStart(2)}  ${j.name.padEnd(24).slice(0, 24)} ${usd(j.total).padStart(10)}  ${usd(j.waterSewer).padStart(11)}  ${usd(j.otherImpact).padStart(8)}  ${j.coverage[0].toUpperCase()}`);
    }
    L.push("");
    L.push(`   🟢 Cheapest: ${r.cheapest.name} (${usd(r.cheapest.total)})`);
    L.push(`   ⚪ Median:   ${r.median.name} (${usd(r.median.total)})`);
    L.push(`   🔴 Priciest: ${r.priciest.name} (${usd(r.priciest.total)})`);
    L.push(`   Spread: ${usd(r.spread.absUsd)} (+${r.spread.pct}%)`);
    L.push("");
    L.push(`   💡 ${r.insight}`);
    L.push(`   ℹ️  ${r.note}`);
    L.push("");
    L.push(`   ⚠️  ${r.disclaimer}`);
    return L.join("\n");
}
export function renderStateSummary(r) {
    const L = [];
    const basisLabel = r.basis === "water_sewer" ? "water+sewer" : "total municipal (all categories)";
    L.push(`🗺️  muni-dev-cost STATE summary  ·  ${r.devType.replace("_", "-")}  ·  meter ${r.meterSize}  —  by ${basisLabel}`);
    L.push(`   ${r.states.length} states · ${r.national.citiesCovered} cities covered`);
    L.push("");
    L.push("   ST  Cities  Min          Median       Max          Cheapest → Priciest");
    for (const s of r.states) {
        L.push(`   ${s.state.padEnd(3)} ${String(s.citiesCovered).padStart(5)}  ${usd(s.minUsd).padStart(10)}  ${usd(s.medianUsd).padStart(10)}  ${usd(s.maxUsd).padStart(10)}   ${s.cheapestCity} → ${s.priciestCity}`);
    }
    L.push("");
    L.push(`   🟢 National cheapest: ${r.national.cheapest.city} (${usd(r.national.cheapest.usd)})`);
    L.push(`   ⚪ National median:   ${usd(r.national.medianUsd)}`);
    L.push(`   🔴 National priciest: ${r.national.priciest.city} (${usd(r.national.priciest.usd)})`);
    L.push("");
    L.push(`   ℹ️  ${r.note}`);
    L.push("");
    L.push(`   ⚠️  ${r.disclaimer}`);
    return L.join("\n");
}
function q(a) {
    return String(a.jurisdiction ?? a.address ?? "").trim();
}
const DEV_TYPES = new Set(["single_family", "multifamily", "commercial", "industrial", "office", "retail"]);
function devType(s) {
    const v = String(s ?? "single_family").toLowerCase().replace(/[\s-]/g, "_");
    return DEV_TYPES.has(v) ? v : "single_family";
}
// =========================================================================
//  server
// =========================================================================
export function buildMcpServer() {
    const server = new Server({ name: SERVER_NAME, version: SERVER_VERSION }, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: [
            {
                name: "get_dev_costs",
                description: "Get the total MUNICIPAL DEVELOPMENT COST to build in a US jurisdiction — the impact/development fees, water & sewer tap (connection) fees and capital-recovery charges a real-estate developer must pay the city/utility before breaking ground — for a standard single-family home. Returns ONE aggregated USD figure, the water+sewer vs other-impact split, and a one-line summary of each fee included. " +
                    "This is the number a development-feasibility / pro-forma analysis needs and that today costs weeks of manual digging across municipal ordinances, utility fee schedules and county portals. We AGGREGATE and NORMALIZE it from public, government-published fee schedules so your agent doesn't have to. " +
                    "Pass a 'jurisdiction' ('Phoenix, AZ', 'Raleigh, NC') or a US 'address'. Coverage is honest: 'deep' = the city's own water/sewer schedule was ingested (per-meter detail); 'partial' = headline figures from public schedules; 'estimated' = a regional benchmark when the exact city isn't in our deep KB yet (clearly marked, never passed off as the city's published number). " +
                    "FREE. For the fee-by-fee breakdown, per-meter water/sewer schedule, multi-jurisdiction comparison or a whole-project estimate, use the premium tools. Indicative — verify with the jurisdiction.",
                inputSchema: {
                    type: "object",
                    properties: {
                        jurisdiction: { type: "string", description: "Jurisdiction as 'City, ST' ('Phoenix, AZ') or a city name ('Raleigh'). Provide this OR address." },
                        address: { type: "string", description: "A US street address ('123 Main St, Raleigh, NC 27601'); the city+state are extracted from it. Provide this OR jurisdiction." },
                    },
                },
            },
            {
                name: "get_fee_breakdown",
                description: "Get the FEE-BY-FEE breakdown behind a jurisdiction's development cost — every impact/development fee and water/sewer tap charge listed separately, each tagged with its calculation basis (per-dwelling / per-LUE / per-meter / per-trip) and whether it's a published schedule figure or a regional estimate, plus the full per-meter-size schedule where the city publishes one (5/8\" → 12\"). Fees are grouped (Water / Sewer / Transportation / Parks / Drainage) with the % each is of the total, and each jurisdiction carries its source URL + effective date so the figure is defensible in a pro-forma. " +
                    "Pass 'jurisdiction' or 'address', and optionally 'dev_type' (single_family / multifamily / commercial / retail / office / industrial; defaults to single_family). " +
                    "PREMIUM: pay per call with x402 (USDC on Base) or set a prepaid key (MUNI_DEV_COST_KEY).",
                inputSchema: {
                    type: "object",
                    properties: {
                        jurisdiction: { type: "string", description: "'City, ST' or city name. Provide this OR address." },
                        address: { type: "string", description: "US street address. Provide this OR jurisdiction." },
                        dev_type: { type: "string", description: "Development type: single_family / multifamily / commercial / retail / office / industrial. Optional; defaults to single_family." },
                    },
                },
            },
            {
                name: "compare_jurisdictions",
                description: "Compare the municipal development cost of TWO OR MORE US jurisdictions side by side, ranked cheapest-to-priciest per unit — the site-selection question a developer asks before buying land. Returns each market's total with its water+sewer vs other-impact split, the dollar spread and % gap between the cheapest and priciest, and what that spread costs on a 100-unit project. " +
                    "Pass 'jurisdictions' as an array (e.g. ['Phoenix, AZ', 'Raleigh, NC', 'Austin, TX']) and optionally 'dev_type'. " +
                    "PREMIUM: pay per call with x402 (USDC on Base) or set a prepaid key (MUNI_DEV_COST_KEY).",
                inputSchema: {
                    type: "object",
                    properties: {
                        jurisdictions: { type: "array", items: { type: "string" }, description: "2–12 jurisdictions as 'City, ST' strings." },
                        dev_type: { type: "string", description: "Development type (default single_family)." },
                    },
                    required: ["jurisdictions"],
                },
            },
            {
                name: "get_water_sewer_detail",
                description: "Get the WATER & SEWER development cost for a jurisdiction broken down by meter size — impact/capacity fee vs physical tap/connection, with the full per-meter-size table (5/8\", 3/4\", 1\", 1.5\", 2\"… up to 12\") where the city publishes one. The right number for the ACTUAL meter a project needs: a 2\" meter can be 8–12× the residential 5/8\" fee, the single biggest swing in a utility connection budget. " +
                    "Pass 'jurisdiction' or 'address' and optionally 'meter_size' (default 5/8\"). " +
                    "PREMIUM: pay per call with x402 (USDC on Base) or set a prepaid key (MUNI_DEV_COST_KEY).",
                inputSchema: {
                    type: "object",
                    properties: {
                        jurisdiction: { type: "string", description: "'City, ST' or city name. Provide this OR address." },
                        address: { type: "string", description: "US street address. Provide this OR jurisdiction." },
                        meter_size: { type: "string", description: "Water meter size: '5/8\"', '3/4\"', '1\"', '1.5\"', '2\"', '3\"', '4\"', '6\"'. Optional; defaults to 5/8\"." },
                    },
                },
            },
            {
                name: "estimate_dev_cost",
                description: "Estimate the total MUNICIPAL FEES for a whole development project — fees × number of units — with per-unit and extended line items. The number a developer needs to size the fee line of a pro-forma before breaking ground. Dev-type aware and explicit about what's EXCLUDED (land, hard construction, soft costs, financing, profit) so it isn't mistaken for total project cost. " +
                    "Pass 'jurisdiction' or 'address', 'dev_type', 'units' (the unit count), and optionally 'meter_size'. " +
                    "PREMIUM: pay per call with x402 (USDC on Base) or set a prepaid key (MUNI_DEV_COST_KEY).",
                inputSchema: {
                    type: "object",
                    properties: {
                        jurisdiction: { type: "string", description: "'City, ST' or city name. Provide this OR address." },
                        address: { type: "string", description: "US street address. Provide this OR jurisdiction." },
                        dev_type: { type: "string", description: "Development type: single_family / multifamily / commercial / retail / office / industrial (default single_family)." },
                        units: { type: "number", description: "Number of units in the project (REQUIRED)." },
                        meter_size: { type: "string", description: "Water meter size per unit (default 5/8\")." },
                    },
                    required: ["units"],
                },
            },
            {
                name: "list_jurisdictions",
                description: "List the FULL coverage map of muni-dev-cost — every US jurisdiction we cover, its depth (deep = the city's own per-meter schedule was ingested; partial = published headline figures) and the data freshness (source effective date) per jurisdiction, which jurisdictions publish a per-meter schedule, plus the benchmark states where any city returns an honest state estimate. The directory an agent needs to know WHAT it can ask for and HOW current the answer is — something it cannot assemble itself. " +
                    "Optionally filter by 'coverage' (deep / partial) or 'state' (2-letter). " +
                    "PREMIUM: pay per call with x402 (USDC on Base) or set a prepaid key (MUNI_DEV_COST_KEY).",
                inputSchema: {
                    type: "object",
                    properties: {
                        coverage: { type: "string", description: "Filter: 'deep' or 'partial'. Optional." },
                        state: { type: "string", description: "Filter by 2-letter state code (e.g. 'TX'). Optional." },
                    },
                },
            },
            {
                name: "get_fee_schedule_source",
                description: "Get the PUBLISHED fee-schedule SOURCE and per-fee provenance behind a jurisdiction's development cost — the exact document name + URL + effective date the figures were lifted from, which fee lines are published (from the city's own schedule) vs estimated (regional benchmark), with the basis of each, and the published-vs-estimated share. This is the trazabilidad that makes a number defensible in a real pro-forma / underwriting model. " +
                    "Pass 'jurisdiction' or 'address'. " +
                    "PREMIUM: pay per call with x402 (USDC on Base) or set a prepaid key (MUNI_DEV_COST_KEY).",
                inputSchema: {
                    type: "object",
                    properties: {
                        jurisdiction: { type: "string", description: "'City, ST' or city name. Provide this OR address." },
                        address: { type: "string", description: "US street address. Provide this OR jurisdiction." },
                    },
                },
            },
            {
                name: "get_cost_trend",
                description: "Get the REAL dated revision history of a jurisdiction's headline development fee — prior years' adopted/charged figures plus officially adopted FUTURE steps (e.g. a council-adopted Oct-1 increase) — with the year-over-year delta and the compound annual growth rate across the published span. NOT a forward projection: only the jurisdiction's own dated/adopted schedules. The signal a developer needs to budget the fee line at the rate in effect when they'll actually pull permits, not today's. Only returns where the city publishes multiple dated schedules. " +
                    "Pass 'jurisdiction' or 'address'. " +
                    "PREMIUM: pay per call with x402 (USDC on Base) or set a prepaid key (MUNI_DEV_COST_KEY).",
                inputSchema: {
                    type: "object",
                    properties: {
                        jurisdiction: { type: "string", description: "'City, ST' or city name. Provide this OR address." },
                        address: { type: "string", description: "US street address. Provide this OR jurisdiction." },
                    },
                },
            },
            {
                name: "compare_by_meter_size",
                description: "Get one jurisdiction's water/sewer development cost across EVERY meter size it publishes (5/8\" → 12\"), each with its ratio to the 5/8\" residential base. A larger meter (a 2\" meter is often 8–12× the residential fee) is the single biggest swing in a utility-connection budget — this lays out the whole curve so you size the right meter cost up front. " +
                    "Pass 'jurisdiction' or 'address' and optionally 'category' ('water' / 'sewer' / 'water+sewer', default 'water+sewer'). Only works for jurisdictions that publish a per-meter schedule. " +
                    "PREMIUM: pay per call with x402 (USDC on Base) or set a prepaid key (MUNI_DEV_COST_KEY).",
                inputSchema: {
                    type: "object",
                    properties: {
                        jurisdiction: { type: "string", description: "'City, ST' or city name. Provide this OR address." },
                        address: { type: "string", description: "US street address. Provide this OR jurisdiction." },
                        category: { type: "string", description: "'water', 'sewer', or 'water+sewer' (default)." },
                    },
                },
            },
            {
                name: "estimate_by_units",
                description: "Estimate the total MUNICIPAL FEES for a MULTIFAMILY / mixed-use project by LUE (Living Unit Equivalent) — units × LUE-per-unit — the way cities actually bill multifamily. Captures that a small apartment unit is a FRACTION of a single-family LUE (≈0.6), so it doesn't overstate MF fees the way a flat per-unit estimate does. Returns per-unit and extended line items; override the LUE factor with the jurisdiction's adopted one. Explicit about exclusions (land, construction, financing). " +
                    "Pass 'jurisdiction' or 'address', 'units', optionally 'dev_type' (default multifamily), 'lue_per_unit' and 'meter_size'. " +
                    "PREMIUM: pay per call with x402 (USDC on Base) or set a prepaid key (MUNI_DEV_COST_KEY).",
                inputSchema: {
                    type: "object",
                    properties: {
                        jurisdiction: { type: "string", description: "'City, ST' or city name. Provide this OR address." },
                        address: { type: "string", description: "US street address. Provide this OR jurisdiction." },
                        units: { type: "number", description: "Number of units in the project (REQUIRED)." },
                        dev_type: { type: "string", description: "Development type (default multifamily)." },
                        lue_per_unit: { type: "number", description: "LUE per unit override (default by dev_type, e.g. multifamily ≈ 0.6)." },
                        meter_size: { type: "string", description: "Water meter size per unit (default 5/8\")." },
                    },
                    required: ["units"],
                },
            },
            {
                name: "get_total_dev_cost",
                description: "Get the GRAND TOTAL municipal development cost for a US jurisdiction across EVERY fee category we hold — not just water+sewer, but also transportation/street, parks, drainage/stormwater, fire, police and library impact fees where the city levies them. Returns one grand-total USD figure plus a roll-up by bucket (Water+Sewer / Transportation / Parks / Drainage / Public Safety / Other Public) and each category's share. This is the number a developer actually underwrites: in cities like Phoenix or Fresno the non-utility impact fees rival the water+sewer bill, so water-only numbers badly understate the cost to build. Honest about $0 buckets (a city that doesn't assess a parks/transport impact fee shows $0, meaning 'not assessed', not 'missing'). " +
                    "Pass 'jurisdiction' or 'address', optionally 'dev_type' and 'meter_size'. " +
                    "PREMIUM: pay per call with x402 (USDC on Base) or set a prepaid key (MUNI_DEV_COST_KEY).",
                inputSchema: {
                    type: "object",
                    properties: {
                        jurisdiction: { type: "string", description: "'City, ST' or city name. Provide this OR address." },
                        address: { type: "string", description: "US street address. Provide this OR jurisdiction." },
                        dev_type: { type: "string", description: "Development type (default single_family)." },
                        meter_size: { type: "string", description: "Water meter size (default 5/8\")." },
                    },
                },
            },
            {
                name: "breakdown_by_fee_category",
                description: "Get every fee line within ONE named category for a US jurisdiction — e.g. just the parks impact fees, just the transportation/street fees, just the water impact, or fire/police/drainage/library — with the per-meter-size schedule where the city publishes one. Lets your agent pull exactly the cost component it needs (e.g. 'what are Fresno's parks fees?') without parsing the whole breakdown. " +
                    "Pass 'jurisdiction' or 'address' and a 'category' (water / water_tap / sewer / transportation / parks / drainage / fire / police / library / school / general). " +
                    "PREMIUM: pay per call with x402 (USDC on Base) or set a prepaid key (MUNI_DEV_COST_KEY).",
                inputSchema: {
                    type: "object",
                    properties: {
                        jurisdiction: { type: "string", description: "'City, ST' or city name. Provide this OR address." },
                        address: { type: "string", description: "US street address. Provide this OR jurisdiction." },
                        category: { type: "string", description: "Fee category: water, water_tap, sewer, transportation, parks, drainage, fire, police, library, school, general." },
                    },
                    required: ["category"],
                },
            },
            {
                name: "rank_jurisdictions_by_cost",
                description: "Rank EVERY covered US jurisdiction cheapest-to-priciest on municipal development cost — the national site-selection leaderboard a developer wants when the question is 'where in the country is it cheapest (or most expensive) to build?'. Rank on water+sewer only or on the GRAND TOTAL across every fee category (water, sewer, transportation, parks, drainage, fire, police, library). Returns the full ranked list with each market's water+sewer vs other split, plus the cheapest / median / priciest, the dollar spread and what that spread costs on a 100-unit project. Filter by 'state' or 'coverage'. Only jurisdictions with the city's OWN published figures are ranked (state-benchmark estimates are excluded). This is computable only over the full normalized cross-jurisdiction dataset — exactly what an agent can't assemble itself. " +
                    "Optionally pass 'basis' ('total' default, or 'water_sewer'), 'dev_type', 'meter_size', 'state', 'coverage', 'limit'. " +
                    "PREMIUM: pay per call with x402 (USDC on Base) or set a prepaid key (MUNI_DEV_COST_KEY).",
                inputSchema: {
                    type: "object",
                    properties: {
                        basis: { type: "string", description: "'total' (grand total across all fee categories, default) or 'water_sewer' (water+sewer only)." },
                        dev_type: { type: "string", description: "Development type (default single_family)." },
                        meter_size: { type: "string", description: "Water meter size for per-meter-table jurisdictions (default 5/8\")." },
                        state: { type: "string", description: "Filter to a 2-letter state code (e.g. 'TX'). Optional." },
                        coverage: { type: "string", description: "Filter: 'deep' or 'partial'. Optional." },
                        limit: { type: "number", description: "Return only the top N rows. Optional (default: all)." },
                    },
                },
            },
            {
                name: "summarize_by_state",
                description: "Roll the entire covered dataset up to the STATE tier: for every US state we hold real city schedules in, get the number of cities covered, the min / median / max municipal development cost across them, the cheapest and priciest city, and which fee categories the state's cities assess. Plus a national roll-up (cheapest / priciest city anywhere, national median). This is the state-level site-selection map a developer scans before drilling into cities — 'which states are cheap or expensive to build in, and how many of my candidate markets do you actually cover?'. Rank on water+sewer only or on the GRAND TOTAL across every fee category. Computable only over the full normalized cross-jurisdiction dataset, and it sharpens as coverage grows. " +
                    "Optionally pass 'basis' ('total' default, or 'water_sewer'), 'dev_type', 'meter_size'. " +
                    "PREMIUM: pay per call with x402 (USDC on Base) or set a prepaid key (MUNI_DEV_COST_KEY).",
                inputSchema: {
                    type: "object",
                    properties: {
                        basis: { type: "string", description: "'total' (grand total across all fee categories, default) or 'water_sewer' (water+sewer only)." },
                        dev_type: { type: "string", description: "Development type (default single_family)." },
                        meter_size: { type: "string", description: "Water meter size for per-meter-table jurisdictions (default 5/8\")." },
                    },
                },
            },
        ],
    }));
    server.setRequestHandler(CallToolRequestSchema, async (req) => {
        const { name, arguments: rawArgs } = req.params;
        try {
            if (name === "get_dev_costs") {
                const a = (rawArgs ?? {});
                const query = q(a);
                if (!query)
                    return { content: [{ type: "text", text: "Error: provide a 'jurisdiction' ('Phoenix, AZ') or a US 'address'." }], isError: true };
                const r = await postHosted("/dev-costs", { jurisdiction: query }, false);
                if (r.ok && r.result)
                    return { content: [{ type: "text", text: renderDevCosts(r.result) }] };
                if (r.error === "rate-limited")
                    return { content: [{ type: "text", text: `⏳ The free tier is rate-limited (HTTP 429). Wait a little, or use a premium tool → ${CHECKOUT_BASE}/pro/checkout` }], isError: true };
                if (r.status === 400 || r.status === 404 || r.status === 422)
                    return { content: [{ type: "text", text: `ℹ️ ${r.error}` }], isError: true };
                return { content: [{ type: "text", text: hostUnavailableText(query, `dev costs unavailable — ${r.error}`) }], isError: true };
            }
            if (name === "get_fee_breakdown") {
                const a = (rawArgs ?? {});
                const query = q(a);
                if (!query)
                    return { content: [{ type: "text", text: "Error: provide a 'jurisdiction' or 'address'." }], isError: true };
                if (!PRO_KEY)
                    return { content: [{ type: "text", text: upsellBreakdown(query) }] };
                const r = await postHosted("/pro/fee-breakdown", { jurisdiction: query, dev_type: devType(a.dev_type) }, true);
                if (r.ok && r.result)
                    return { content: [{ type: "text", text: renderBreakdown(r.result) }] };
                if (r.error === "payment-required")
                    return { content: [{ type: "text", text: `🔒 Your MUNI_DEV_COST_KEY was rejected (HTTP ${r.status}). It may be invalid or expired.\n\nGet or renew a key → ${CHECKOUT_BASE}/pro/checkout` }] };
                if (r.status === 400 || r.status === 404 || r.status === 422)
                    return { content: [{ type: "text", text: `ℹ️ ${r.error}` }], isError: true };
                return { content: [{ type: "text", text: hostUnavailableText(query, `fee breakdown unavailable — ${r.error}`) }], isError: true };
            }
            if (name === "compare_jurisdictions") {
                const a = (rawArgs ?? {});
                const list = Array.isArray(a.jurisdictions) ? a.jurisdictions.map((x) => String(x).trim()).filter(Boolean) : [];
                if (list.length < 2)
                    return { content: [{ type: "text", text: "Error: provide 'jurisdictions' as an array of at least 2 (e.g. ['Phoenix, AZ', 'Raleigh, NC'])." }], isError: true };
                const label = list.join(" vs ");
                if (!PRO_KEY)
                    return { content: [{ type: "text", text: upsellCompare(label) }] };
                const r = await postHosted("/pro/compare", { jurisdictions: list, dev_type: devType(a.dev_type) }, true);
                if (r.ok && r.result)
                    return { content: [{ type: "text", text: renderCompare(r.result) }] };
                if (r.error === "payment-required")
                    return { content: [{ type: "text", text: `🔒 Your MUNI_DEV_COST_KEY was rejected (HTTP ${r.status}). It may be invalid or expired.\n\nGet or renew a key → ${CHECKOUT_BASE}/pro/checkout` }] };
                if (r.status === 400 || r.status === 404 || r.status === 422)
                    return { content: [{ type: "text", text: `ℹ️ ${r.error}` }], isError: true };
                return { content: [{ type: "text", text: hostUnavailableText(label, `comparison unavailable — ${r.error}`) }], isError: true };
            }
            if (name === "get_water_sewer_detail") {
                const a = (rawArgs ?? {});
                const query = q(a);
                if (!query)
                    return { content: [{ type: "text", text: "Error: provide a 'jurisdiction' or 'address'." }], isError: true };
                if (!PRO_KEY)
                    return { content: [{ type: "text", text: upsellWaterSewer(query) }] };
                const r = await postHosted("/pro/water-sewer", { jurisdiction: query, meter_size: a.meter_size }, true);
                if (r.ok && r.result)
                    return { content: [{ type: "text", text: renderWaterSewer(r.result) }] };
                if (r.error === "payment-required")
                    return { content: [{ type: "text", text: `🔒 Your MUNI_DEV_COST_KEY was rejected (HTTP ${r.status}). It may be invalid or expired.\n\nGet or renew a key → ${CHECKOUT_BASE}/pro/checkout` }] };
                if (r.status === 400 || r.status === 404 || r.status === 422)
                    return { content: [{ type: "text", text: `ℹ️ ${r.error}` }], isError: true };
                return { content: [{ type: "text", text: hostUnavailableText(query, `water/sewer detail unavailable — ${r.error}`) }], isError: true };
            }
            if (name === "estimate_dev_cost") {
                const a = (rawArgs ?? {});
                const query = q(a);
                if (!query)
                    return { content: [{ type: "text", text: "Error: provide a 'jurisdiction' or 'address'." }], isError: true };
                const units = Number(a.units);
                if (!Number.isFinite(units) || units <= 0)
                    return { content: [{ type: "text", text: "Error: provide a positive 'units' count for the project." }], isError: true };
                if (!PRO_KEY)
                    return { content: [{ type: "text", text: upsellEstimate(query) }] };
                const r = await postHosted("/pro/estimate", { jurisdiction: query, dev_type: devType(a.dev_type), units, meter_size: a.meter_size }, true);
                if (r.ok && r.result)
                    return { content: [{ type: "text", text: renderEstimate(r.result) }] };
                if (r.error === "payment-required")
                    return { content: [{ type: "text", text: `🔒 Your MUNI_DEV_COST_KEY was rejected (HTTP ${r.status}). It may be invalid or expired.\n\nGet or renew a key → ${CHECKOUT_BASE}/pro/checkout` }] };
                if (r.status === 400 || r.status === 404 || r.status === 422)
                    return { content: [{ type: "text", text: `ℹ️ ${r.error}` }], isError: true };
                return { content: [{ type: "text", text: hostUnavailableText(query, `estimate unavailable — ${r.error}`) }], isError: true };
            }
            if (name === "list_jurisdictions") {
                const a = (rawArgs ?? {});
                if (!PRO_KEY)
                    return { content: [{ type: "text", text: upsellJurisdictions() }] };
                const r = await postHosted("/pro/jurisdictions", { coverage: a.coverage, state: a.state }, true);
                if (r.ok && r.result)
                    return { content: [{ type: "text", text: renderJurisdictions(r.result) }] };
                if (r.error === "payment-required")
                    return { content: [{ type: "text", text: `🔒 Your MUNI_DEV_COST_KEY was rejected (HTTP ${r.status}). It may be invalid or expired.\n\nGet or renew a key → ${CHECKOUT_BASE}/pro/checkout` }] };
                if (r.status === 400 || r.status === 404 || r.status === 422)
                    return { content: [{ type: "text", text: `ℹ️ ${r.error}` }], isError: true };
                return { content: [{ type: "text", text: hostUnavailableText("coverage map", `jurisdiction list unavailable — ${r.error}`) }], isError: true };
            }
            if (name === "get_fee_schedule_source") {
                const a = (rawArgs ?? {});
                const query = q(a);
                if (!query)
                    return { content: [{ type: "text", text: "Error: provide a 'jurisdiction' or 'address'." }], isError: true };
                if (!PRO_KEY)
                    return { content: [{ type: "text", text: upsellSource(query) }] };
                const r = await postHosted("/pro/source", { jurisdiction: query }, true);
                if (r.ok && r.result)
                    return { content: [{ type: "text", text: renderSource(r.result) }] };
                if (r.error === "payment-required")
                    return { content: [{ type: "text", text: `🔒 Your MUNI_DEV_COST_KEY was rejected (HTTP ${r.status}). It may be invalid or expired.\n\nGet or renew a key → ${CHECKOUT_BASE}/pro/checkout` }] };
                if (r.status === 400 || r.status === 404 || r.status === 422)
                    return { content: [{ type: "text", text: `ℹ️ ${r.error}` }], isError: true };
                return { content: [{ type: "text", text: hostUnavailableText(query, `source detail unavailable — ${r.error}`) }], isError: true };
            }
            if (name === "get_cost_trend") {
                const a = (rawArgs ?? {});
                const query = q(a);
                if (!query)
                    return { content: [{ type: "text", text: "Error: provide a 'jurisdiction' or 'address'." }], isError: true };
                if (!PRO_KEY)
                    return { content: [{ type: "text", text: upsellTrend(query) }] };
                const r = await postHosted("/pro/trend", { jurisdiction: query }, true);
                if (r.ok && r.result)
                    return { content: [{ type: "text", text: renderTrend(r.result) }] };
                if (r.error === "payment-required")
                    return { content: [{ type: "text", text: `🔒 Your MUNI_DEV_COST_KEY was rejected (HTTP ${r.status}). It may be invalid or expired.\n\nGet or renew a key → ${CHECKOUT_BASE}/pro/checkout` }] };
                if (r.status === 400 || r.status === 404 || r.status === 422)
                    return { content: [{ type: "text", text: `ℹ️ ${r.error}` }], isError: true };
                return { content: [{ type: "text", text: hostUnavailableText(query, `cost trend unavailable — ${r.error}`) }], isError: true };
            }
            if (name === "compare_by_meter_size") {
                const a = (rawArgs ?? {});
                const query = q(a);
                if (!query)
                    return { content: [{ type: "text", text: "Error: provide a 'jurisdiction' or 'address'." }], isError: true };
                if (!PRO_KEY)
                    return { content: [{ type: "text", text: upsellMeterCompare(query) }] };
                const r = await postHosted("/pro/meter-compare", { jurisdiction: query, category: a.category }, true);
                if (r.ok && r.result)
                    return { content: [{ type: "text", text: renderMeterCompare(r.result) }] };
                if (r.error === "payment-required")
                    return { content: [{ type: "text", text: `🔒 Your MUNI_DEV_COST_KEY was rejected (HTTP ${r.status}). It may be invalid or expired.\n\nGet or renew a key → ${CHECKOUT_BASE}/pro/checkout` }] };
                if (r.status === 400 || r.status === 404 || r.status === 422)
                    return { content: [{ type: "text", text: `ℹ️ ${r.error}` }], isError: true };
                return { content: [{ type: "text", text: hostUnavailableText(query, `meter comparison unavailable — ${r.error}`) }], isError: true };
            }
            if (name === "estimate_by_units") {
                const a = (rawArgs ?? {});
                const query = q(a);
                if (!query)
                    return { content: [{ type: "text", text: "Error: provide a 'jurisdiction' or 'address'." }], isError: true };
                const units = Number(a.units);
                if (!Number.isFinite(units) || units <= 0)
                    return { content: [{ type: "text", text: "Error: provide a positive 'units' count for the project." }], isError: true };
                if (!PRO_KEY)
                    return { content: [{ type: "text", text: upsellEstimateUnits(query) }] };
                const r = await postHosted("/pro/estimate-units", { jurisdiction: query, units, dev_type: devType(a.dev_type ?? "multifamily"), lue_per_unit: a.lue_per_unit, meter_size: a.meter_size }, true);
                if (r.ok && r.result)
                    return { content: [{ type: "text", text: renderEstimateUnits(r.result) }] };
                if (r.error === "payment-required")
                    return { content: [{ type: "text", text: `🔒 Your MUNI_DEV_COST_KEY was rejected (HTTP ${r.status}). It may be invalid or expired.\n\nGet or renew a key → ${CHECKOUT_BASE}/pro/checkout` }] };
                if (r.status === 400 || r.status === 404 || r.status === 422)
                    return { content: [{ type: "text", text: `ℹ️ ${r.error}` }], isError: true };
                return { content: [{ type: "text", text: hostUnavailableText(query, `units estimate unavailable — ${r.error}`) }], isError: true };
            }
            if (name === "get_total_dev_cost") {
                const a = (rawArgs ?? {});
                const query = q(a);
                if (!query)
                    return { content: [{ type: "text", text: "Error: provide a 'jurisdiction' or 'address'." }], isError: true };
                if (!PRO_KEY)
                    return { content: [{ type: "text", text: upsellTotalCost(query) }] };
                const r = await postHosted("/pro/total-cost", { jurisdiction: query, dev_type: devType(a.dev_type), meter_size: a.meter_size }, true);
                if (r.ok && r.result)
                    return { content: [{ type: "text", text: renderTotalCost(r.result) }] };
                if (r.error === "payment-required")
                    return { content: [{ type: "text", text: `🔒 Your MUNI_DEV_COST_KEY was rejected (HTTP ${r.status}). It may be invalid or expired.\n\nGet or renew a key → ${CHECKOUT_BASE}/pro/checkout` }] };
                if (r.status === 400 || r.status === 404 || r.status === 422)
                    return { content: [{ type: "text", text: `ℹ️ ${r.error}` }], isError: true };
                return { content: [{ type: "text", text: hostUnavailableText(query, `total cost unavailable — ${r.error}`) }], isError: true };
            }
            if (name === "breakdown_by_fee_category") {
                const a = (rawArgs ?? {});
                const query = q(a);
                const category = String(a.category ?? "").trim();
                if (!query)
                    return { content: [{ type: "text", text: "Error: provide a 'jurisdiction' or 'address'." }], isError: true };
                if (!category)
                    return { content: [{ type: "text", text: "Error: provide a 'category' (e.g. 'parks', 'transportation', 'water', 'fire')." }], isError: true };
                if (!PRO_KEY)
                    return { content: [{ type: "text", text: upsellCategory(query, category) }] };
                const r = await postHosted("/pro/category", { jurisdiction: query, category }, true);
                if (r.ok && r.result)
                    return { content: [{ type: "text", text: renderCategory(r.result) }] };
                if (r.error === "payment-required")
                    return { content: [{ type: "text", text: `🔒 Your MUNI_DEV_COST_KEY was rejected (HTTP ${r.status}). It may be invalid or expired.\n\nGet or renew a key → ${CHECKOUT_BASE}/pro/checkout` }] };
                if (r.status === 400 || r.status === 404 || r.status === 422)
                    return { content: [{ type: "text", text: `ℹ️ ${r.error}` }], isError: true };
                return { content: [{ type: "text", text: hostUnavailableText(query, `category breakdown unavailable — ${r.error}`) }], isError: true };
            }
            if (name === "rank_jurisdictions_by_cost") {
                const a = (rawArgs ?? {});
                if (!PRO_KEY)
                    return { content: [{ type: "text", text: upsellRank() }] };
                const r = await postHosted("/pro/rank", { basis: a.basis, dev_type: devType(a.dev_type), meter_size: a.meter_size, state: a.state, coverage: a.coverage, limit: a.limit }, true);
                if (r.ok && r.result)
                    return { content: [{ type: "text", text: renderRank(r.result) }] };
                if (r.error === "payment-required")
                    return { content: [{ type: "text", text: `🔒 Your MUNI_DEV_COST_KEY was rejected (HTTP ${r.status}). It may be invalid or expired.\n\nGet or renew a key → ${CHECKOUT_BASE}/pro/checkout` }] };
                if (r.status === 400 || r.status === 404 || r.status === 422)
                    return { content: [{ type: "text", text: `ℹ️ ${r.error}` }], isError: true };
                return { content: [{ type: "text", text: hostUnavailableText("ranking", `ranking unavailable — ${r.error}`) }], isError: true };
            }
            if (name === "summarize_by_state") {
                const a = (rawArgs ?? {});
                if (!PRO_KEY)
                    return { content: [{ type: "text", text: upsellStateSummary() }] };
                const r = await postHosted("/pro/state-summary", { basis: a.basis, dev_type: devType(a.dev_type), meter_size: a.meter_size }, true);
                if (r.ok && r.result)
                    return { content: [{ type: "text", text: renderStateSummary(r.result) }] };
                if (r.error === "payment-required")
                    return { content: [{ type: "text", text: `🔒 Your MUNI_DEV_COST_KEY was rejected (HTTP ${r.status}). It may be invalid or expired.\n\nGet or renew a key → ${CHECKOUT_BASE}/pro/checkout` }] };
                if (r.status === 400 || r.status === 404 || r.status === 422)
                    return { content: [{ type: "text", text: `ℹ️ ${r.error}` }], isError: true };
                return { content: [{ type: "text", text: hostUnavailableText("state summary", `state summary unavailable — ${r.error}`) }], isError: true };
            }
            return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
        }
        catch (err) {
            return { content: [{ type: "text", text: `Error: ${String(err?.message ?? err)}` }], isError: true };
        }
    });
    return server;
}
