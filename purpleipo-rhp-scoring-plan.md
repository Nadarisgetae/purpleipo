# PurpleIPO — RHP Scoring Engine Plan (Simplified)

**Scope of this plan:** only the RHP-based scoring engine. No Independent Signals layer, no News Sentiment layer, no marketing site, no multi-user accounts. Personal-use, password-gated, always-on Vercel app. Hand this file to any AI assistant/developer and they can build from it directly.

---

## 1. Kanban Dashboard — Stages

Replace the earlier 12-stage pipeline with exactly these:

| # | Stage |
|---|---|
| 1 | Bidding Not Open |
| 2 | IPO Bidding Window Open |
| 3 | Allotment Status Finalized |
| 4 | Listing Day Debut |

Each IPO card sits in one stage, moves right as the real-world IPO progresses. Stage transitions are detected by the scraper/API layer (Section 4) — e.g., an IPO moves from "Bidding Not Open" to "IPO Bidding Window Open" once the scraper sees the issue-open date has passed.

---

## 2. IPO Detail Page — Overview Section (exact fields)

### Card 1 — Issue Overview (Expandable)
- **Total Issue Size** — total fund value of the IPO, in ₹ Crores
- **Price Band** — the bidding range (e.g., ₹585 – ₹615)
- **Lot Size** — minimum shares per lot
- **Min Investment** — calculated as `Lot Size × Upper Price Band` (computed field, not scraped directly)
- **Subscription Rate** — current total bidding progress (e.g., 12.5x)
- **Oversubscription Breakdown** — subscription interest by category (QIB / HNI / Retail) if fully subscribed
- **Fresh Issue Amount** — capital raised that goes directly to the company
- **Offer for Sale (OFS) Amount** — capital representing early investor/promoter cash-outs

### Card 2 — Promoters & Key Institutional Backers (Expandable)
- **Promoters List** — names of key founders/major stakeholders
- **Anchor Investors** — anchor investor block allocation, names of institutional funds
- **QIB Buyers** — allocation details and demand multiples for Qualified Institutional Buyers

Both cards render collapsed by default on the IPO detail page, expand on click. Data for both is scraped/parsed — see Section 4.

---

## 3. RHP Scoring Engine (the only analysis layer in this plan)

Unchanged from the full checklist — every factor from the earlier IPO Evaluation Checklist categories 1–5 (Business & Financial Health, Deal Structure, Ownership & Governance, Business Quality & Risk, Market Sentiment & Demand) still applies. Each factor:
- Numeric factors → rule-based scoring (0–10), computed directly from parsed RHP tables.
- Narrative factors → sent to the LLM (Section 5) with the factor's green-flag/red-flag description, returns `{score: 0-10, confidence: 0-1, evidence: "..."}`.
- Category scores = average of factor scores in that category.
- **RHP Score (0–100)** = weighted sum of category scores (Business & Financial Health 25%, Deal Structure 20%, Ownership & Governance 20%, Business Quality & Risk 20%, Market Sentiment & Demand 15%).
- No Independent Signals layer, no News layer, no composite/weighted-blend step — the RHP Score **is** the final score in this version. Recommendation bands stay the same (80–100 Strong Buy, 65–79 Buy, 50–64 Neutral, 35–49 Caution, <35 Avoid).

---

## 4. Data Acquisition — Scrapers & Free APIs

Use multiple sources per data type so one breaking doesn't take down the pipeline. All free.

| Data needed | Primary source | Backup source(s) |
|---|---|---|
| RHP/DRHP PDF documents | SEBI public filings page (scraped) | Company's own investor-relations page (scraped, if listed there); NSE/BSE IPO document pages |
| Live IPO list, stage/status | Scrape **Chittorgarh** (chittorgarh.com) IPO dashboard — well-structured, widely used, tracks live status | Scrape **NSE India** IPO page; scrape **BSE India** IPO page |
| Subscription data (QIB/HNI/Retail multiples) | Scrape NSE's live IPO bidding-detail page | Scrape Chittorgarh's live subscription tracker; scrape BSE's bidding page |
| Price band, lot size, issue size, dates | Scrape Chittorgarh IPO detail page | Cross-check against the RHP PDF itself (Section 3 parsing) |
| Anchor investor allocation | Scrape NSE/BSE anchor allotment circular (published day before issue opens, as a PDF/notice) | Scrape Chittorgarh's anchor investor page |
| Promoter names | Parsed directly from RHP (Capital Structure / Promoters section) | Chittorgarh company profile page as cross-check |
| Allotment status | Scrape the registrar's allotment-status page (Link Intime / KFin Technologies — whichever registrar is named for that IPO) | Scrape Chittorgarh's allotment status aggregator |
| Post-listing price | **yfinance** (free Python library, pulls from Yahoo Finance/NSE tickers) | NSE India live price page (scraped) |

**Scraper implementation notes:**
- Build each source as an isolated scraper module (`scrapers/sebi.py`, `scrapers/chittorgarh.py`, `scrapers/nse.py`, `scrapers/bse.py`, etc.) with a common output shape, so the pipeline tries primary → falls back automatically on failure/timeout → logs which source actually served the data.
- Run these on Vercel Cron jobs (as in the earlier master plan) — frequency: daily for filings/stage checks, every 30–60 min during "IPO Bidding Window Open" for subscription data, once for anchor data when that stage hits, once for allotment data when "Allotment Status Finalized" hits.
- Expect scrapers to break occasionally when a source changes its page layout — this is normal and why multiple backups exist per data type, not a sign something's wrong with the approach.

---

## 5. LLM Setup — OpenRouter (NVIDIA Nemotron 3 Super) with Multi-Key Rotation

### 5.1 Model
- Primary model: **NVIDIA Nemotron 3 Super**, accessed via **OpenRouter** (`openrouter.ai`) — one API, routes to the model, standard OpenAI-compatible request format.
- Used for exactly the same job as before: narrative/qualitative factor scoring (moat quality, governance tone, litigation severity, objects-of-issue specificity, etc.) — returns structured `{score, confidence, evidence}` JSON.
- Optionally keep 1-2 backup models on OpenRouter (e.g., a free/cheap Llama or Qwen model also available through OpenRouter) purely as a fallback if Nemotron's queue/limits are hit and all your rotated keys are simultaneously exhausted — same rotation logic applies per model.

### 5.2 Key rotation script (multiple OpenRouter accounts/keys, same model)

Since OpenRouter's free/low-cost tier has usage caps per account, the plan is to hold several API keys (one per account you've set up) and rotate automatically when the active key's limit is hit.

**Design:**
```
config/api-keys.json (gitignored, not committed):
{
  "openrouter_keys": [
    "sk-or-key-1",
    "sk-or-key-2",
    "sk-or-key-3"
  ],
  "current_index": 0
}
```

**Rotation logic (pseudocode, implement as a small wrapper module `lib/llmClient.ts` or `.py`):**
```
function callLLM(prompt):
    key = keys[current_index]
    response = callOpenRouter(key, model="nvidia/nemotron-3-super", prompt)

    if response.status == 429 (rate limit) OR response.error indicates quota exhausted:
        current_index = (current_index + 1) % len(keys)
        persist current_index to storage (DB row or the json file)
        if all keys have been tried in this call cycle:
            fall back to backup model (Section 5.1) OR queue the job for retry later
            raise/log a "all keys exhausted" alert
        else:
            retry callLLM(prompt) with the new key

    return response
```

**Implementation notes:**
- Store `current_index` (and optionally a per-key "last known exhausted timestamp") in a small DB table (`llm_key_state`) rather than only in a local file, since Vercel's serverless functions don't share local disk state reliably between invocations — this is the one part of this design that genuinely needs a persisted DB row, not just an env var.
- On a 429/quota error, rotate immediately and retry the same request with the next key before giving up — don't fail the whole scoring job on one exhausted key.
- Add a simple daily reset check: if a key was marked exhausted more than 24 hours ago (most free tiers reset daily), mark it "assume available again" and let it re-enter rotation, rather than needing to manually track exact reset times per provider.
- Log every rotation event (which key, when, why) so you can see key-exhaustion patterns over time and decide if you need to add more keys.
- Keep the actual key values only in environment variables / a gitignored config — never commit them, same rule as the `APP_PASSWORD` from the earlier plan.

---

## 6. Simplified Database Schema (RHP-only version)

```
companies
  id, name, sector, cin

ipos
  id, company_id, current_stage (1-4, per Section 1), issue_size, price_band,
  lot_size, min_investment, fresh_issue_amount, ofs_amount,
  issue_open_date, issue_close_date, allotment_date, listing_date,
  created_at, updated_at

promoters
  id, ipo_id, name

anchor_investors
  id, ipo_id, investor_name, shares_allocated, amount

qib_allocations
  id, ipo_id, category_detail, demand_multiple

ipo_documents
  id, ipo_id, type (DRHP/RHP), file_url, filed_date, parsed_at

factor_scores
  id, ipo_id, factor_key, category, score (0-10), confidence,
  evidence_text, source_section, computed_at

score_snapshots
  id, ipo_id, stage_at_time, rhp_score, created_at

subscription_data
  id, ipo_id, category (QIB/HNI/Retail), times_subscribed, recorded_at

llm_key_state
  id, provider (openrouter), key_index, last_exhausted_at, is_active
```

No `independent_score` / `news_score` / `composite_score` / `weights_used` columns — this version only ever computes and stores `rhp_score`.

---

## 7. Tech Stack (unchanged core, still fully free-tier)

| Layer | Choice |
|---|---|
| Frontend + API routes | Next.js 14+, TypeScript, Tailwind, shadcn/ui |
| Password gate | Next.js Middleware + `APP_PASSWORD` env var (no auth vendor) |
| Database | PostgreSQL on Supabase or Neon (free tier) |
| File storage | Cloudflare R2 (free tier) — RHP/DRHP PDFs |
| Scheduled jobs | Vercel Cron (free on Hobby tier) |
| Scraping | Python (BeautifulSoup/requests, or Playwright if a source needs JS rendering) run as a small always-on free service (Render free tier) if scraping is too heavy for serverless timeouts, otherwise as Vercel serverless functions |
| LLM | OpenRouter → NVIDIA Nemotron 3 Super, multi-key rotation (Section 5) |
| Post-listing price data | yfinance (free) |
| Hosting | Vercel (Hobby/free tier) |

---

## 8. Phase Plan

### Phase 0 — Foundations
1. Next.js repo, password gate middleware, `APP_PASSWORD` env var.
2. Free-tier accounts: Supabase/Neon, Cloudflare R2, OpenRouter (create 2-3 accounts for key rotation).
3. Deploy empty gated shell to Vercel.

### Phase 1 — Dashboard & Data Model
1. Schema from Section 6.
2. Build the 4-stage kanban (Section 1).
3. Seed a few real IPOs manually to start.

### Phase 2 — Scraper Layer
1. Build each scraper module (Section 4) with primary/fallback logic.
2. Wire into Vercel Cron at the frequencies specified.
3. Build the RHP/DRHP fetch-and-store-in-R2 pipeline.

### Phase 3 — RHP Parsing
1. Extract text/tables from stored RHP PDFs.
2. Section into known RHP parts (Risk Factors, Financials, Objects of Issue, etc.).

### Phase 4 — Scoring Engine
1. Implement `lib/llmClient` with OpenRouter + key rotation (Section 5).
2. Implement all factor scoring functions (numeric + LLM-assisted).
3. Aggregate into category scores → RHP Score → `score_snapshots`.
4. Build the RHP Analysis tab with full factor drill-down.

### Phase 5 — Overview Cards
1. Build Card 1 (Issue Overview) and Card 2 (Promoters & Institutional Backers) exactly per Section 2, wired to scraped/parsed data.

### Phase 6 — Polish
1. Confirm all cron jobs fire reliably; confirm key rotation actually switches on a real 429.
2. Basic error handling so one failed scraper doesn't break the dashboard.
3. Share password with friends, done.

---

*This file is the complete, self-contained brief for the RHP-only version of PurpleIPO — 4-stage kanban, RHP scoring engine only, OpenRouter/Nemotron with key rotation, multi-source scraping. No independent signals, no news layer, no marketing site.*
