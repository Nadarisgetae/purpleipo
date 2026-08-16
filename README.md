# PurpleIPO
A systematic, factor-based IPO analysis engine — RHP scoring + on-demand news sentiment, built as a personal research tool.

PurpleIPO is a private-use application that treats IPO evaluation the way a systematic investing framework treats any other decision: break it into independent, explainable factors, score each one, weight them, and roll them up into a single, auditable read — rather than relying on a single analyst's gut call or an unexplained "buy/avoid" label.

It's built by a builder-investor exploring the intersection of software engineering and quantitative/systematic finance — this project is as much an exercise in designing a small, disciplined "factor model" pipeline as it is a practical tool for tracking real IPOs.

## Table of Contents
- [Why This Exists](#why-this-exists)
- [What It Does](#what-it-does)
- [The Finance Side — Methodology](#the-finance-side--methodology)
- [The Technical Side — Architecture](#the-technical-side--architecture)
- [Data Sources](#data-sources)
- [Tech Stack](#tech-stack)
- [Database Schema (Simplified)](#database-schema-simplified)
- [Getting Started](#getting-started)
- [Roadmap](#roadmap)
- [Disclaimer](#disclaimer)

## Why This Exists
Most retail-facing IPO commentary is either a single analyst's narrative opinion or an unexplained "subscribe/avoid" call with no visible reasoning. PurpleIPO is an attempt to build the opposite: a transparent, factor-decomposed scoring system, in the same spirit as a quant factor model — every output is traceable back to the specific inputs (a financial ratio, a disclosure, a news article) that produced it.

This project doubles as hands-on practice in the kind of thinking that underpins systematic and quantitative trading: turning qualitative judgment into structured, scored, weighted signals; being deliberate about data pipeline design and cost/latency trade-offs; and building toward a feedback loop that can eventually validate whether the scoring actually predicts anything (see Roadmap).

## What It Does
- **Kanban dashboard** — tracks IPOs through four real-world stages: Bidding Not Open → IPO Bidding Window Open → Allotment Status Finalized → Listing Day Debut.
- **Overview cards** — at-a-glance issue mechanics (issue size, price band, lot size, minimum investment, live subscription rate, oversubscription breakdown, fresh issue vs. OFS split) and ownership context (promoters, anchor investors, QIB allocation).
- **RHP Scoring Engine** — parses a company's Red Herring Prospectus and scores it across ~25+ factors spanning financial health, deal structure, governance, business quality, and demand signals, rolling up into a single 0–100 score with a full factor-level breakdown.
- **News Sentiment Engine** — an on-demand, click-triggered search for a specific company's recent news (capped at the top 30 most relevant articles per run), scored for sentiment, topic, and relevance, aggregated into a sentiment score with a trend read across repeated analyses.

## The Finance Side — Methodology
**Factor-based scoring, not a single opaque number**
Every score in PurpleIPO decomposes into individual factors, each backed by a green-flag / red-flag rubric derived from what actually matters in prospectus analysis and equity research practice — for example:

| Category | Sample factors |
|----------|----------------|
| Business & Financial Health | Revenue/margin trend, cash flow quality vs. reported profit, working capital cycle, leverage, contingent liabilities |
| Deal Structure | Fresh issue vs. OFS split, objects-of-issue specificity, valuation vs. listed peers, dilution %, lock-in schedule, ESOP overhang |
| Ownership & Governance | Promoter retained stake, promoter share pledging, related-party transactions, audit history, management stability |
| Business Quality & Risk | Customer concentration, litigation exposure, competitive moat, sector tailwinds, regulatory risk |
| Market Sentiment & Demand | Anchor investor quality, subscription multiples by investor category, grey market premium (treated as a low-weight, informal signal) |

Numeric factors (leverage ratios, dilution %, promoter holding) are scored with deterministic, rule-based thresholds — the same input always produces the same score, no ambiguity. Narrative factors (moat quality, governance tone, litigation severity) are scored by an LLM against the same rubric, returning a score, a confidence level, and the evidence behind it — so every qualitative judgment is still auditable, not a black box.

**Two independent signal layers**
- RHP layer — what the company's own regulatory filing says about itself.
- News layer — what current media coverage says about market perception, right now.

These are deliberately kept as separate, independently-computed scores rather than blended into one number, following the same logic a multi-factor model uses in keeping value, momentum, and quality signals distinct: a company can score well fundamentally while facing a rough news cycle, or vice versa, and collapsing that into a single figure would destroy exactly the information worth having.

**News sentiment as a live, mean-reverting-aware signal**
The news engine doesn't just compute "average sentiment" — it tracks:
- Trend direction (is sentiment improving or deteriorating vs. the last analysis run)
- Dispersion (is coverage in consensus, or genuinely split/controversial)
- Coverage volume/recency (a sudden spike in coverage is itself informative, separate from its tone)
- Topic composition (litigation-driven negativity reads very differently from subscription-demand-driven negativity, even at the same raw sentiment score)

This mirrors how a systematic strategy would treat a sentiment factor — not as a single static reading, but as a time series with its own trend and confidence characteristics.

**Explainability as a design principle**
Every score — RHP or news — is clickable down to the individual factor or article that produced it. This isn't just a UX choice: in any systematic framework, an unexplainable signal is an untrustworthy signal. If a factor can't show its work, it doesn't get to influence the output silently.

## The Technical Side — Architecture
```text
User (password-gated)
  ─▶ Kanban Dashboard (IPOs by stage)
       │
       ▼
  IPO Detail / Overview Page
       ┌─────────┴─────────┐
       ▼                   ▼
RHP Analysis        News Sentiment
(auto-scored)       (click-triggered, top-30)
       │                   │
       ▼                   ▼
Factor Scores ──▶ Category Scores ──▶ Final Scores
```

- **RHP pipeline**: scheduled jobs fetch newly filed prospectuses from public sources, extract and section the PDF text, then run each factor's scoring function (rule-based or LLM-assisted) against the relevant section.
- **News pipeline**: fully on-demand — no background polling. A user click triggers a targeted, company-specific search, a cheap pre-LLM relevance ranking pass to cut the candidate pool down to a bounded top 30, then a single batched LLM call (not 30 separate calls) to score the set. Results are cached with a configurable freshness window so repeated views don't re-trigger analysis unnecessarily.
- **LLM provider**: OpenRouter, routed to NVIDIA's Nemotron 3 Super model. A custom key-rotation client cycles across multiple API keys/accounts automatically on hitting a rate limit, with rotation state persisted in the database (not in-memory) since the app runs on stateless serverless functions.
- **Access model**: no user accounts or auth provider — a single environment-variable-based password gate, appropriate for a tool built for personal and small-group use rather than public distribution.

## Data Sources
All free-tier or publicly available — no paid financial data subscriptions:

| Data | Source(s) |
|------|-----------|
| DRHP/RHP filings | SEBI public filings pages |
| Live IPO status, subscription data | NSE/BSE public pages, cross-checked against Chittorgarh's IPO tracker |
| Anchor investor allocation | NSE/BSE anchor allotment circulars |
| Post-listing price data | Yahoo Finance (via yfinance) |
| News | Google News RSS, Moneycontrol, Economic Times, LiveMint, Business Standard (RSS/scrape), NSE/BSE official corporate announcements |

Each data type has multiple source options wired with fallback logic, since scraping public pages is inherently more fragile than a dedicated paid API — a deliberate trade-off made to keep the project's operating cost at zero.

## Tech Stack
| Layer | Choice |
|-------|--------|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Database | PostgreSQL (Supabase/Neon free tier) with pgvector for RHP section embeddings |
| File storage | Cloudflare R2 (RHP/DRHP PDFs) |
| Scheduled jobs | Vercel Cron |
| LLM | OpenRouter → NVIDIA Nemotron 3 Super, custom multi-key rotation client |
| Market/price data | yfinance |
| Hosting | Vercel |

## Database Schema (Simplified)
- `companies` → name, sector, CIN
- `ipos` → stage, issue size, price band, key dates
- `ipo_documents` → RHP/DRHP file references, parse status
- `factor_scores` → per-factor score, category, confidence, evidence, source section
- `score_snapshots` → RHP score history over an IPO's lifecycle
- `news_articles` → per-run scored articles (sentiment, topic, relevance)
- `news_sentiment_snapshots` → aggregate sentiment score + trend per analysis run
- `llm_key_state` → API key rotation state

## Getting Started
```bash
git clone https://github.com/Nadarisgetae/purpleipo.git
cd purpleipo
npm install
cp .env.example .env.local
# add your database, R2, and OpenRouter credentials
npm run dev
```

**Required environment variables:**
```env
APP_PASSWORD=
DATABASE_URL=
CLOUDFLARE_R2_ACCESS_KEY=
CLOUDFLARE_R2_SECRET_KEY=
OPENROUTER_API_KEYS= # comma-separated list, for key rotation
```

## Roadmap
- [x] RHP-based scoring engine (rule-based + LLM-assisted factors)
- [x] On-demand news sentiment engine with capped, batched LLM scoring
- [ ] Post-listing outcome tracking — compare predicted scores against actual listing-day and 30/90-day price performance, to start validating (and eventually recalibrating) the factor weights against real outcomes
- [ ] Independent fundamental/technical signal layer (ratio benchmarking, DCF, market regime indicators) as a third, separately-weighted score
- [ ] Backtestable factor weight tuning once enough historical outcome data has accumulated

## Disclaimer
PurpleIPO is a personal research and learning project. Nothing it produces — scores, recommendations, or sentiment reads — constitutes investment advice. It is not registered with, endorsed by, or affiliated with SEBI, NSE, BSE, or any regulatory body. Use it as a research aid, not a substitute for independent due diligence.
