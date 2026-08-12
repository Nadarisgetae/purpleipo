# PurpleIPO — Master Plan (Personal-Use Edition)

**How to use this document:** this is the single, self-contained brief for building **PurpleIPO** as a personal tool — for you and 2–3 friends, always running on Vercel, gated by one hardcoded password in the codebase. No public users, no pricing, no marketing site, no per-user accounts, no payment processing. Hand this file to any AI assistant or developer at any point and they should be able to pick up exactly where the project was left off.

---

# PART A — PRODUCT OVERVIEW

## A.1 What PurpleIPO is

A private web app, always live on Vercel, that:
1. Shows a **kanban dashboard** of upcoming IPOs grouped by lifecycle stage (Part B), with a live financial news feed alongside.
2. Lets you select an IPO and get it scored in three layers:
   - **Layer 1 — RHP-based score** (the foundation — build this first)
   - **Layer 2 — Independent fiscal signals** (fundamental + technical, toggle on/off)
   - **Layer 3 — News sentiment** (later addition)
3. Shows a **per-factor score**, rolled into category scores, rolled into a **composite score**, with a **buy / hold / avoid** style read.
4. Lets you **adjust the weighting** between the three layers yourself (W1/W2/W3) — this stays, since it's genuinely useful for your own judgment, not because it's a "product feature" for other users.

## A.2 Access model — the one thing that's different from a normal app

- **No signup, no user accounts, no per-user database rows.** The whole app sits behind one password.
- The password lives as an environment variable in the codebase (e.g., `APP_PASSWORD` in Vercel's environment settings — **never hardcode it directly into a committed file**, even though the ask was "in the codebase," an env var is the codebase-adjacent equivalent that doesn't leak the password if the repo is ever made public or shared).
- A simple middleware checks for a cookie/session token; if absent, it shows a single password-entry screen. Enter the right password once, get a session cookie, and you're in until it expires or you clear cookies.
- Anyone with the password (you + your 2–3 friends) gets full access — no roles, no permissions tiers, no billing. This is intentionally as simple as it can be.

## A.3 Core design principles to keep

- **Transparency over black-box scoring** — every score should be explainable, click into it and see which factors drove it. Worth keeping even for personal use, since "trust the score" only works if you can audit it.
- **Stage-aware scoring** — an IPO's score should evolve as more data becomes available through its lifecycle, not appear falsely final too early.
- **Everything else marked "fancy" in the earlier plan — pricing pages, multi-tenant auth, Telegram onboarding, payment integration, a marketing site — is dropped entirely.** This plan only covers the tool itself.

---

# PART B — IPO LIFECYCLE STAGES (kanban dashboard)

Kept exactly as before — this is the one structural piece explicitly worth preserving.

| # | Stage | What's available for scoring at this stage |
|---|---|---|
| 1 | Appoint Merchant Bankers | Basic company info only — no scoring yet |
| 2 | Conduct Due Diligence | No scoring yet |
| 3 | Draft and File the DRHP | Preliminary RHP module can run on DRHP data — flag as "draft, subject to change" |
| 4 | Receive Regulatory Approvals | DRHP-based score, updated if SEBI observations change disclosures |
| 5 | File the Final Prospectus (RHP) | Full RHP module unlocked — Layer 1 scoring becomes reliable |
| 6 | Conduct Marketing and Roadshows | RHP score stable; news module starts becoming meaningful |
| 7 | Open Anchor Book | Add anchor investor quality signal (Independent Signals) |
| 8 | Open Public Bidding Window | Add live subscription data (QIB/HNI/retail) |
| 9 | Price the Issue | Valuation-vs-peers signal finalized |
| 10 | Execute Allotment and Refunds | Score is "final pre-listing" — informational only |
| 11 | Credit Demat Accounts | Same as above |
| 12 | List on Exchanges | Post-listing tracking: predicted score vs. actual price performance |

Each IPO's score should carry a timestamp history so you can see how it evolved stage to stage. Store every snapshot, not just the latest.

---

# PART C — SIMPLIFIED SYSTEM ARCHITECTURE

```
You (password-gated) → Kanban dashboard (IPOs by stage + news feed)
                      → select an IPO
                      → Analysis: RHP module → Independent Signals (optional) → News (optional)
                      → Composite Score (your own adjustable weights)
                      → Buy / Hold / Avoid read, with full factor breakdown
```

No auth service, no user table, no subscription/billing logic, no multi-tenant anything. One password gate, one shared dataset, everyone who has the password sees the same thing.

---

# PART D — PAGE STRUCTURE (stripped down)

- **`/` (the whole app, post-password):** kanban dashboard of IPOs by stage, news feed sidebar.
- **IPO detail page — tabs:** Overview | RHP Analysis | Independent Signals | News & Sentiment | Composite Score (with your weight sliders).
- **Score history view:** a simple line chart of the score over time/stage — worth keeping, it's genuinely useful for your own review, not fancy.
- That's it. No settings page, no billing page, no contact page, no pricing page, no landing page — the app itself is the whole product now.

---

# PART E — SCORING ENGINE (unchanged logic, still the core of the tool)

## E.1 Factor-level scoring (Layer 1: RHP)

Every factor (Part F) gets a 0–10 score, interpolated between the red-flag and green-flag description — rule-based where the data is numeric (e.g., debt-to-equity), LLM-assisted with a stated confidence where it's narrative (e.g., "quality of moat").

## E.2 Category weights (Layer 1 composition)

| Category | Suggested weight |
|---|---|
| Business & Financial Health | 25% |
| Deal Structure | 20% |
| Ownership & Governance | 20% |
| Business Quality & Risk | 20% |
| Market Sentiment & Demand (RHP-adjacent) | 15% |

**RHP Score (0–100)** = weighted sum of category averages.

## E.3 Independent Signals (Layer 2 — toggle on/off)

**Fundamental sub-group:** independent ratio benchmarking, independent DCF, MCA/RoC cross-check, credit rating agency rationale, broker/analyst notes, promoter group's other companies, sector external data, peer IPO post-listing performance.

**Technical/market sub-group:** Nifty/Sensex trend, India VIX, FII/DII flows, sector index momentum, recent IPO cycle sentiment, global cues, anchor investor quality (Stage 7+), subscription levels (Stage 8+), GMP (flagged as informal, lower default weight).

**Independent Signals Score (0–100)** — equal weighting within each sub-group by default; you can adjust further since you're the only user tuning this.

## E.4 News Sentiment (Layer 3)

Pull recent articles per company/sector, classify sentiment (positive/neutral/negative) plus topic tag (litigation/business/macro), weight by recency and source credibility → **News Sentiment Score (0–100)**.

## E.5 Composite score

```
Composite Score = (RHP Score × W1) + (Independent Signals Score × W2) + (News Sentiment Score × W3)
```

Default W1=50%, W2=30%, W3=20%, fully adjustable via sliders on the IPO detail page.

**Recommendation bands:**

| Score | Read |
|---|---|
| 80–100 | Strong buy signal |
| 65–79 | Buy |
| 50–64 | Neutral / watch |
| 35–49 | Caution |
| Below 35 | Avoid |

Always show the factor-level breakdown behind the number.

---

# PART F — FULL IPO EVALUATION CHECKLIST (unchanged — this is the factor library)

## F.1 Business & Financial Health

**Financial track record (revenue, profit, margins over 3–5 yrs)** — Green: consistent growth, stable/improving margins. Red: growth with widening losses, no path to profit. Source: 5-year restated financials in the RHP.

**Cash flow quality vs. reported profit** — Green: operating cash flow tracks or exceeds net profit. Red: profits rising while cash flow is flat/negative (revenue stuck in receivables). Source: cash flow statement vs. P&L.

**Working capital cycle** — Green: stable/shortening cycle. Red: lengthening cycle despite steady revenue. Source: DSO/DIO/DPO trend in MD&A.

**Debt levels / use of proceeds for debt repayment** — Green: low leverage or clear debt reduction. Red: IPO used mainly for recurring debt repayment. Source: debt-to-equity trend, Objects of the Issue.

**Contingent liabilities** — Green: small relative to net worth. Red: large disputed tax/claims relative to net worth. Source: notes to financial statements.

## F.2 Deal Structure

**Purpose of the issue (fresh issue vs. OFS)** — Green: meaningful fresh issue for growth/debt reduction. Red: large OFS, insiders cashing out. Source: issue structure table.

**Objects of the issue specificity** — Green: itemized, specific plans. Red: large % to vague "general corporate purposes." Source: Objects of the Issue section.

**Valuation vs. peers** — Green: in line with or below listed peers. Red: priced well above peers with no clear justification. Source: Basis for Issue Price section.

**Dilution %** — Green: moderate, proportionate. Red: very large issue relative to post-listing market cap. Source: calculate issue size ÷ post-issue market cap.

**Lock-in periods** — Green: staggered, longer lock-ins. Red: short lock-ins on large pre-IPO stakes. Source: Capital Structure section.

**ESOP overhang** — Green: modest, well-vested pool. Red: large unvested pool vesting soon after listing. Source: ESOP scheme disclosures.

## F.3 Ownership & Governance

**Promoter holding post-IPO** — Green: large retained stake. Red: diluted to a small minority. Source: shareholding pattern table.

**Promoter share pledging** — Green: minimal/no pledging. Red: large % pledged as loan collateral. Source: shareholding disclosures.

**Related-party transactions** — Green: minimal, transparent. Red: frequent, large, opaque. Source: Related Party Transactions note.

**Corporate governance history** — Green: clean audits, independent board. Red: auditor resignations, restatements, regulatory action. Source: Risk Factors, auditor's report history.

**Historical restatement of financials** — Green: none or minor. Red: multiple restatements pre-IPO. Source: auditor's notes.

**Management background** — Green: experienced, stable team. Red: frequent CFO/CEO churn, past regulatory action. Source: Management section.

## F.4 Business Quality & Risk

**Revenue/customer concentration** — Green: diversified base. Red: top customers = very large % of revenue. Source: top-customer disclosure.

**Litigation/regulatory risk** — Green: minimal pending litigation. Red: multiple/large pending cases. Source: Outstanding Litigation section.

**Market share and moat** — Green: category leadership, pricing power. Red: small player, no differentiation. Source: Industry section, competitor comparison.

**Industry/sector tailwinds** — Green: growing sector, structural demand. Red: declining/cyclical, easily disrupted. Source: Industry Overview.

**Regulatory/sector-specific risk** — Green: stable regulatory environment. Red: pending policy changes flagged as risk. Source: Risk Factors.

**Dividend history / capital discipline** — Green: sustainable dividend history or credible reinvestment story. Red: no dividends, no credible explanation. Source: dividend history table, cash flow statement.

## F.5 Market Sentiment & Demand Signals

**Anchor investor quality** — Green: strong, diverse anchor book. Red: missing or unknown/small players. Source: anchor allotment list.

**Subscription levels (QIB/HNI/Retail)** — Green: heavy QIB oversubscription. Red: retail-only interest. Source: live NSE/BSE subscription data.

**GMP** — Green: positive, stable. Red: volatile, falling, negative. Source: informal — cross-check against subscription data and peer valuation.

**Broader market conditions at listing** — Green: healthy risk appetite. Red: downturn, high volatility, negative macro news. Source: Nifty/Sensex trend.

## F.6 Independent Financial Analysis (beyond the RHP)

**Independent ratio benchmarking** — calculate ROE, ROCE, ROIC, asset turnover yourself vs. your own peer set (Screener.in, Tijori, Moneycontrol).

**Independent DCF/intrinsic valuation** — build your own conservative DCF, compare gap to IPO price.

**MCA/RoC filings cross-check** — pull financials from mca.gov.in, compare to RHP disclosures.

**Credit rating agency reports** — read the full rationale, not just the letter grade.

**Broker/analyst notes** — read 3–4 brokerage notes, note where they disagree.

**Promoter group's other companies** — check financial health/default history of other group entities.

**Sector-specific external data** — cross-check RHP industry claims against RBI/CMIE/independent sources.

**Peer IPO post-listing performance** — check last 3–5 sector IPOs' post-listing price behavior.

## F.7 Technical/Market-Based Signals

**Broader market trend** — Nifty/Sensex trend over preceding 1–3 months.

**India VIX** — above ~18–20 signals nervous markets.

**FII/DII flow trends** — persistent FII selling is a headwind.

**Sector index momentum** — check the relevant sector index, not just Nifty 50.

**Recent IPO cycle sentiment** — last 10–15 IPOs' listing-day performance as a base rate.

**Global cues** — dollar index, crude, Fed decisions (for export/commodity-linked sectors).

**IPO grading** — check if any agency published one (rare since 2013, optional).

**Listing-day volume/price action** — first-day volume vs. issue size, price behavior over the following 1–2 weeks.

## F.8 Quick reference: where in the RHP to look

| Section of RHP | What it reveals |
|---|---|
| Risk Factors | Litigation, regulatory risk, concentration risk, governance issues |
| Financial Statements & Notes | Financial track record, cash flow quality, contingent liabilities, related-party transactions |
| Objects of the Issue | Use of proceeds, fresh issue vs. OFS split |
| Basis for Issue Price | Valuation vs. peers |
| Capital Structure | Shareholding pattern, promoter holding, lock-in schedule |
| Management | Key personnel background, board composition |
| Industry Overview | Sector tailwinds, market size, competitive landscape |
| Outstanding Litigation | Pending legal/regulatory cases |

**Mental model:** RHP tells you what the company *is*; independent analysis tells you if that's a fair story; market/technical signals tell you if the *timing* is right. Keep the three layers separately weighted rather than blending them.

---

# PART G — TECH STACK (still fully free-tier — simplified further for single-app, single-password use)

| Layer | Choice | Why |
|---|---|---|
| Frontend + light backend | **Next.js 14+ (App Router), TypeScript, React** | One deployable app, no separate backend service needed for something this size — API routes inside Next.js handle everything |
| Styling | **Tailwind CSS + shadcn/ui** | Fast, clean, free |
| Charts | **Recharts** | Score history chart |
| Password gate | **Next.js Middleware** checking a cookie set after matching `process.env.APP_PASSWORD` | No auth vendor needed at all — this replaces Clerk/Supabase Auth/NextAuth entirely, since there's no per-user data |
| Database | **PostgreSQL on Supabase or Neon (free tier)** | Still needed for IPOs, factor scores, score history — just no `users`/`subscriptions` tables anymore |
| Vector storage | **pgvector on the same free Postgres** | For RHP section embeddings/search |
| File storage | **Cloudflare R2 (free tier, 10GB, no egress fees)** | Store RHP/DRHP PDFs |
| Background jobs | **Vercel Cron Jobs (free on Hobby tier)** instead of a separate queue service | For something this small, scheduled Vercel Cron functions (parsing checks, market data pulls, news pulls) are simpler than standing up BullMQ/Redis — only add Redis/BullMQ later if job volume genuinely needs it |
| Parsing & scoring logic | **Python scripts, run as scheduled/triggered Vercel Serverless Functions or a small always-on free-tier service (Render free tier)** if parsing is too heavy for serverless timeouts | Keep this simple; only split into a separate always-on service if a single serverless function's timeout becomes a real constraint |
| LLM calls | **Google Gemini API (free tier)** + **Groq API (free tier)** | Narrative extraction, qualitative scoring, news sentiment |
| News/market data | **Free RSS feeds** (Google News, Moneycontrol, ET), **yfinance**, **NSE/BSE public data**, **SEBI filings** | No paid data API |
| Hosting | **Vercel (Hobby/free tier)** | Always-on for a Next.js app at this scale, per your ask |
| Monitoring | **Sentry free tier** (optional — nice to have for a 3-4 person tool, not essential) | Skip if you want to keep this as lean as possible |

**What got removed from the earlier plan, specifically:** Clerk/Supabase Auth as an auth vendor, the `users`/`subscriptions`/`weight_presets`-per-user/`usage_counters` tables, BullMQ+Redis as a hard requirement (Vercel Cron covers it at this scale), NestJS as a separate backend service (Next.js API routes are enough for single-digit users), the entire marketing site, pricing page, contact page, Telegram bot flow, and Razorpay integration.

---

# PART H — SIMPLIFIED DATABASE SCHEMA

```
companies
  id, name, sector, cin

ipos
  id, company_id, current_stage (1-12), issue_size, price_band,
  fresh_issue_amount, ofs_amount, issue_open_date, issue_close_date,
  listing_date, created_at, updated_at

ipo_documents
  id, ipo_id, type (DRHP/RHP), file_url, filed_date, parsed_at

factor_scores
  id, ipo_id, factor_key, layer (rhp/independent/news), category,
  score (0-10), confidence, evidence_text, source_section, computed_at

score_snapshots
  id, ipo_id, stage_at_time, rhp_score, independent_score, news_score,
  composite_score, weights_used (jsonb: {w1, w2, w3}), created_at

news_articles
  id, ipo_id, company_id, headline, url, source, published_at,
  sentiment_score, topic_tag

market_data_snapshots
  id, date, nifty_level, sensex_level, india_vix, fii_flow, dii_flow

subscription_data
  id, ipo_id, category (QIB/HNI/Retail), times_subscribed, recorded_at
```

No `users`, `subscriptions`, `weight_presets`, or `usage_counters` tables — weight adjustments can just be client-side state (a slider you move per session) since there's no need to persist per-user preferences for 2–4 people who can just re-set the sliders each visit, or, if you want the last-used weights remembered, store a single `app_settings` row (no user_id needed) with the last weights used.

---

# PART I — PHASE-BY-PHASE IMPLEMENTATION PLAN (simplified, start to always-on deployment)

### Phase 0 — Foundations
1. Create a single Next.js repo (TypeScript, App Router, Tailwind, shadcn/ui).
2. Set up free-tier accounts: Supabase or Neon (Postgres), Cloudflare R2, Google Gemini API, Groq API.
3. Set `APP_PASSWORD` as an environment variable in Vercel (and locally in `.env.local`, gitignored).
4. Build the password-gate middleware: unauthenticated request → redirect to a single password entry page; correct password → set a signed cookie → allow through.
5. Deploy an empty gated app to Vercel to confirm the password flow works end-to-end before building anything else.

### Phase 1 — Dashboard & Data Model
1. Write the Postgres schema from Part H.
2. Build basic API routes: `GET /api/ipos`, `GET /api/ipos/[id]`.
3. Seed 10–15 real IPOs manually from SEBI/NSE public filings.
4. Build the kanban dashboard: IPOs grouped by `current_stage`.
5. Build the IPO detail page shell (tabs, mostly placeholders at this point).
6. Wire in the free RSS news feed into a sidebar component.

**Deliverable:** password-gated, always-on dashboard with real IPO data and a news feed, live on Vercel.

### Phase 2 — RHP Ingestion & Parsing
1. Build a script (can run as a Vercel Cron job or manually triggered API route) that fetches DRHP/RHP PDFs from SEBI, stores them in R2, logs in `ipo_documents`.
2. Extract text/tables (pdfplumber-equivalent — if going pure Node, consider `pdf-parse` or shell out to a Python script; if the parsing gets heavy, this is the one part worth running as its own small Python service on Render's free tier rather than forcing it into serverless).
3. Section the extracted text into the known RHP sections (Risk Factors, Financials, etc.) — pattern matching first, LLM fallback for ambiguous cases.
4. Store sections (and optionally embeddings via pgvector) linked to `ipo_documents`.

**Deliverable:** given a filed RHP, the app can fetch, parse, and section it automatically.

### Phase 3 — RHP Scoring Engine (Layer 1)
1. Implement one scoring function per factor from Part F.1–F.5 — numeric factors computed directly, narrative factors scored via Gemini/Groq with structured JSON output (`{score, confidence, evidence}`).
2. Aggregate into category scores, then the RHP Score (Part E.2), written to `score_snapshots`.
3. Build the RHP Analysis tab: category cards, expandable factor-level breakdown with evidence.

**Deliverable:** real, explainable RHP-based scores for any IPO with a parsed RHP — a genuinely usable v1.

### Phase 4 — Independent Signals (Layer 2)
1. Set up a Vercel Cron job pulling Nifty/Sensex/VIX/FII-DII data daily into `market_data_snapshots`.
2. Compute fundamentals (ROE/ROCE/ROIC) from already-parsed financials.
3. Implement Part F.6–F.7 scoring functions.
4. Poll subscription data during Stage 8, anchor data during Stage 7.
5. Add the Independent Signals Score to `score_snapshots`; build the toggle UI.

### Phase 5 — News Sentiment (Layer 3)
1. Classify pulled news articles with Gemini/Groq (batch requests to stay within free-tier limits) or a lightweight open-source sentiment library.
2. Compute the News Sentiment Score; build the News & Sentiment tab.

### Phase 6 — Composite Score & Weight Sliders
1. Implement the composite formula (Part E.5) — simple enough to compute client-side or in a lightweight API route.
2. Build the weight sliders (W1/W2/W3) on the IPO detail page, recalculating live.
3. Build the recommendation band display and the full drill-down (composite → layers → categories → factors).

### Phase 7 — Score History
1. Build the score history chart (Recharts) plotting `score_snapshots` over time/stage per IPO.
2. Once IPOs you've tracked actually list, add a simple post-listing price check (via yfinance) to compare your predicted score to what happened — genuinely useful for calibrating your own trust in the tool over time.

### Phase 8 — Polish & Always-On Confirmation
1. Confirm Vercel Cron jobs are firing reliably (parsing checks, market data pulls, news pulls).
2. Basic error handling so a single failed parse/job doesn't take down the dashboard.
3. Share the password with your 2–3 friends and confirm the gate works cleanly for them too.
4. Done — this is a complete, always-on, personal-use PurpleIPO.

---

# PART J — DATA FRESHNESS & PER-FACTOR SOURCE/LOGIC REFERENCE

## J.1 Update cadence (Vercel Cron jobs — not live/real-time)

| Data type | Pull frequency | Why |
|---|---|---|
| SEBI DRHP/RHP filings, stage changes | 1–2x/day | Filings don't appear minute-to-minute |
| News (RSS) | Every 1–4 hours | Fastest-moving input |
| Market data (Nifty/Sensex/VIX/FII-DII) | Once daily, after market close | These are daily figures anyway |
| Subscription data (QIB/HNI/Retail) | Every 30–60 min, **only during Stage 8 (active bidding window)** | Time-boxed to a few days, no need to poll outside that window |
| Anchor investor list | Once, when Stage 7 hits | Published once, a day before issue opens |

Every pull writes a timestamp to the DB — the dashboard shows "last updated X ago" rather than pretending to be live.

## J.2 General scoring mechanism

- **Numeric factors** → rule-based threshold functions. Compute the number, map onto 0–10 via bands defined once (e.g., debt-to-equity <0.5 → 9–10, 0.5–1.5 → 5–8, >2 → 0–3). Deterministic.
- **Narrative factors** → sent to the LLM (Gemini/Groq) with the factor's red-flag/green-flag description from Part F, returns `{score: 0-10, confidence: 0-1, evidence: "..."}`. Not deterministic — this is exactly why every score shows its evidence, so it can be sanity-checked rather than trusted blindly.

## J.3 Layer 1 (RHP) — data source & logic per factor

| Factor | Data source (exact) | Logic |
|---|---|---|
| Financial track record | Parsed 5-yr restated financials from RHP PDF | Rule: YoY revenue CAGR + margin trend direction |
| Cash flow quality | Cash flow statement vs. P&L, parsed from RHP | Rule: (operating cash flow ÷ net profit) avg over 3 yrs |
| Working capital cycle | Parsed balance sheet + MD&A | Rule: trend in (DSO+DIO−DPO) over 3 yrs |
| Debt levels | Parsed balance sheet, Objects of the Issue | Rule: D/E trend + % proceeds to debt repayment |
| Contingent liabilities | Notes to financial statements | Rule: contingent liabilities ÷ net worth, banded |
| Fresh issue vs. OFS | Issue structure table (RHP cover) | Rule: % fresh issue of total |
| Objects of issue specificity | Objects of the Issue section text | LLM: itemized vs. vague judgment |
| Valuation vs. peers | "Basis for Issue Price" section | Rule: company P/E or EV/EBITDA vs. stated peer average |
| Dilution % | Issue size ÷ post-issue market cap (RHP-stated) | Rule: calculated %, banded (<15% high, >30% low) |
| Lock-in periods | Capital Structure section | Rule: length/staggering of schedule |
| ESOP overhang | ESOP scheme disclosures | Rule: unvested pool as % of total shares |
| Promoter holding post-IPO | Pre/post shareholding pattern table | Rule: post-issue promoter % |
| Promoter share pledging | Shareholding pattern disclosures | Rule: pledged % of promoter holding |
| Related-party transactions | RPT note in financials | Rule: RPT value as % of revenue/expenses |
| Governance history | Risk Factors + auditor's report | LLM: severity of disclosed past issues |
| Restatements | Auditor's notes | Rule: count of restatements disclosed |
| Management background | Management section | LLM: tenure stability, disciplinary history |
| Customer concentration | Business overview / risk factors | Rule: top-customer % of revenue, if disclosed |
| Litigation risk | Outstanding Litigation section | Rule: count + aggregate claim value, banded by company size |
| Market share/moat | Industry section + competitor comparison | LLM: competitive positioning judgment |
| Sector tailwinds | Industry Overview section | LLM: growth narrative strength |
| Regulatory risk | Risk Factors section | LLM: severity of disclosed regulatory risk language |
| Dividend/capital discipline | Dividend history table + cash flow statement | Rule (or LLM if no dividend history) |

## J.4 Layer 2 (Independent Signals) — data source & logic per factor

| Factor | Data source (exact) | Logic |
|---|---|---|
| Ratio benchmarking (ROE/ROCE/ROIC) | Computed from parsed RHP financials — no external API | Rule: vs. a manually-curated per-sector peer average |
| Independent DCF | Computed in-app from parsed financials + your own assumptions | Rule: gap between DCF value and IPO price |
| MCA/RoC cross-check | mca.gov.in (scraped, no formal API) | Rule: pass/fail — RHP figures match RoC filings? |
| Credit rating reports | CRISIL/ICRA/CARE public rationale pages (scraped/manual, no free API) | LLM: tone/severity of flagged risks in rationale text |
| Broker/analyst notes | Public brokerage IPO notes (manually sourced — no free API) | LLM: consensus summary + disagreement flags |
| Promoter's other companies | mca.gov.in search by promoter/director name | Manual/rule: flags financial stress in group companies — hard to fully automate |
| Sector external data | RBI reports, CMIE (public, often manual pulls) | LLM: cross-checks RHP industry claims |
| Peer IPO post-listing performance | yfinance — last 3–5 sector IPOs' price history | Rule: avg listing-day and 30-day return |
| Nifty/Sensex trend | yfinance (`^NSEI`, `^BSESN`, free) | Rule: 1–3 month trend direction/magnitude |
| India VIX | yfinance (`^INDIAVIX`) | Rule: banded (<15 calm, >20 nervous) |
| FII/DII flows | NSE public daily provisional data page (scraped) | Rule: net flow direction, recent weeks |
| Sector index momentum | yfinance sector tickers (e.g., `^NSEBANK`) | Rule: same trend logic, sector-specific |
| Recent IPO cycle sentiment | yfinance, your own logged recent-IPO list | Rule: % listed at premium vs. discount |
| Global cues | yfinance (dollar index, crude oil tickers) | Rule: weighted only for export/commodity sectors |
| Anchor investor quality | NSE/BSE anchor allotment page (scraped, Stage 7) | Hybrid: reputation-score vs. a maintained known-fund list |
| Subscription levels | NSE/BSE live subscription page (scraped, Stage 8) | Rule: QIB/HNI/Retail multiples, banded |
| GMP | Public grey market tracking sites (informal) | Rule, low-weighted: direction/stability pre-listing |

## J.5 Layer 3 (News Sentiment) — data source & logic

| Factor | Data source (exact) | Logic |
|---|---|---|
| News articles | Google News RSS (company + sector keywords), Moneycontrol/ET/LiveMint RSS | — |
| Sentiment per article | LLM (Gemini/Groq) on article text | LLM: positive/neutral/negative + confidence |
| Topic tagging | Same LLM call | LLM: litigation vs. business vs. macro |
| Recency weighting | Computed from stored `published_at` | Rule: exponential decay, newer counts more |
| Source credibility | Small manually-maintained weight table (e.g., ET/Moneycontrol weighted higher) | Rule: multiply sentiment by source weight |

## J.6 Known automation gap — flag honestly, decide per-factor

MCA/RoC lookups, credit rating rationale pages, brokerage notes, and promoter-group-company checks don't have clean free APIs — they need either scraping fragile public pages or manual data entry per IPO. This isn't a plan flaw, it's where automation runs out on a zero-cost stack. Decide per factor whether it's worth building a scraper (which will need occasional patching as source pages change format) or just checking manually — manual may genuinely be faster for low-frequency factors like promoter-group checks.

--- — is the complete, portable brief for building PurpleIPO as a private tool for you and a few friends: product, scoring engine, full evaluation checklist, simplified free tech stack, schema, and phase-by-phase plan through to an always-on Vercel deployment gated by a single password. No public users, no pricing, no marketing site, no payments.*
