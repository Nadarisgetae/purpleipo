# PurpleIPO — News Sentiment Engine Plan

**Scope of this plan:** a standalone news sentiment engine that scrapes/pulls IPO-related news, analyzes it, and produces a read on how the market is reacting to a given IPO. This sits alongside the RHP Scoring Engine (`purpleipo-rhp-scoring-plan.md`) as a second, independent analysis layer — same app, same kanban, same password gate, same OpenRouter/Nemotron setup with key rotation. This plan only covers the news layer.

---

## 1. What this engine answers

Not "is this a good company" (that's the RHP engine's job) — this engine answers: **"what is the market/media currently saying and feeling about this IPO, right now, and is that sentiment improving or deteriorating?"** It's a live pulse check, not a fundamental judgment.

## 1.1 On-demand, not continuous — the core design decision

This engine does **not** run a background cron job scoring news for every tracked IPO around the clock. That would burn through OpenRouter free-tier limits fast for no benefit, since you're only ever actually looking at one or two IPOs at a time.

Instead:
- The IPO detail/overview page shows the **RHP score** and, right beside it, a **"News Sentiment" card/button** that's initially unscored/empty (e.g., "Click to analyze news sentiment").
- Clicking it triggers a **targeted, on-demand search** for that specific company's news only — not a scan across every tracked IPO.
- The search pulls the **top 30 most relevant, most recent articles** for that company, scores just those, and returns the aggregate result.
- Result: maximum signal (a real batch of recent coverage) for minimum token/API usage (one bounded search-and-score cycle, only when you actually want it, only for the company you're looking at).

---

## 2. News Sources — Scrapers & Free APIs

Same sources as before, but every query is now **parameterized by the specific company/IPO name** at request time, not run broadly on a schedule — each source is queried with `"<Company Name>" IPO` (or similar targeted query) only when a user actually clicks "Analyze News Sentiment" for that IPO.

Use multiple sources per request so one breaking doesn't limit the result set — but still bounded to a top-30 total across all sources combined (Section 3).

| Source | Type | What it gives |
|---|---|---|
| **Google News RSS** (query: company name + "IPO") | Free RSS, no key needed | Broadest coverage, aggregates across publishers |
| **Moneycontrol RSS/IPO news section** | Free RSS/scrape | India-focused financial news, IPO-specific coverage |
| **Economic Times Markets RSS** | Free RSS | Business/market-focused coverage |
| **LiveMint RSS** | Free RSS | Business/market-focused coverage |
| **Business Standard RSS** | Free RSS | Additional India business coverage, cross-check source |
| **Chittorgarh IPO news/GMP commentary section** | Scrape | IPO-specific retail-investor-facing commentary — useful since it's already IPO-contextualized, not generic news |
| **NSE/BSE circulars & corporate announcements** | Scrape | Official company announcements — not "sentiment" in the media sense, but treated as a distinct high-credibility input (see Section 4) |

**Fallback logic:** same pattern as the RHP plan — each source is an isolated module, pipeline tries all configured sources per run (not primary/fallback in this case, since more sources = more complete picture, not redundancy for a single data point), and a source failing just means fewer articles that cycle, not a broken pipeline.

**Dedup logic:** the same story often gets picked up by multiple outlets or re-published — dedupe by headline similarity + published date proximity before scoring, so one real event doesn't get counted 5 times and skew the sentiment average.

---

## 3. On-Demand Ingestion & Scoring Flow

This replaces a background cron pipeline with a **request-triggered pipeline**, invoked when the user clicks "Analyze News Sentiment" on a specific IPO's overview page.

### 3.1 Trigger flow, step by step

1. **User clicks the News Sentiment button** on the IPO detail page (`POST /api/ipos/[id]/analyze-news`).
2. **Cache check first:** if this IPO's news was already analyzed within the last N hours (configurable — suggest 6–12 hours, since news doesn't need re-scoring every few minutes), return the cached `news_sentiment_snapshots` result immediately, no new fetch or LLM calls at all. Show a "last analyzed X hours ago — refresh?" option instead of forcing a re-run.
3. **If no fresh cache exists,** the API route runs a targeted search across the sources in Section 2, querying specifically `"<Company Name>" IPO` (and a secondary query like `"<Company Name>" stock` for post-listing IPOs, to catch broader coverage once it's trading).
4. **Collect and dedupe results** across all sources (dedupe by headline similarity + published-date proximity, as before) until you have a candidate pool — stop collecting once you've gathered a reasonable pool (e.g., ~50–60 candidates) so there's enough to rank down to a clean top 30.
5. **Rank the candidate pool** by a simple pre-LLM relevance heuristic (keyword match strength in headline, recency, source is on the known-credible list) and **take the top 30** — this ranking step is cheap (no LLM needed) and is what keeps the expensive step (Section 5) bounded.
6. **Send exactly those 30 articles to the LLM**, batched into as few requests as possible (Section 5), for sentiment/topic/relevance scoring.
7. **Aggregate** the 30 scored articles into the metrics in Section 4, write a new `news_sentiment_snapshots` row, and return the result to the page.
8. **Display** the result — score, trend (only computable once there are at least two snapshots over time for this IPO; show "first analysis, no trend yet" otherwise), consensus indicator, topic breakdown, and the 30 articles themselves in the feed below.

### 3.2 Why top 30, and why ranked pre-LLM

- 30 articles is enough to get a statistically meaningful sentiment/consensus read without ballooning LLM token usage — the earlier always-on design could accumulate hundreds of articles per IPO over its lifecycle; this design intentionally never processes more than 30 per analysis run.
- Doing the initial ranking with a cheap heuristic (not the LLM) means you're not spending LLM calls filtering — the LLM only ever sees articles that already cleared the relevance bar, and it's just refining relevance/sentiment/topic on a pre-filtered set, not scoring 60 candidates to find the best 30.

### 3.3 Re-analysis behavior

- A manual "Refresh" button lets the user force a new fetch-and-score cycle even within the cache window — useful right when you know something just broke (e.g., checking again the morning after listing day).
- No automatic background refresh, ever, in this design — the whole point is that it only runs when you ask.

---

## 4. Metrics — how sentiment and market response are actually measured

This is the core of the engine — not just "is this article positive or negative," but a set of metrics that together describe market response.

### 4.1 Per-article metrics (computed once per article, for exactly the 30 articles in that analysis run)

| Metric | Scale | How it's computed |
|---|---|---|
| **Sentiment score** | -1.0 to +1.0 | LLM classifies the article as negative/neutral/positive with a magnitude, not just a 3-way label — lets "cautiously positive" differ from "strongly bullish" |
| **Topic tag** | categorical | LLM tags: `business-performance`, `litigation-regulatory`, `macro-market`, `subscription-demand`, `governance-controversy`, `other` — so an unrelated macro-market article doesn't get treated the same as company-specific bad news |
| **Relevance score** | 0.0–1.0 | LLM judges how directly the article is actually about *this* IPO/company vs. a passing mention — this refines the pre-LLM ranking from Section 3.1, catching cases the cheap heuristic ranked too high |
| **Source credibility weight** | fixed per source | A small manually-maintained table (e.g., ET/Moneycontrol/LiveMint/Business Standard weighted higher than an unrecognized source; official NSE/BSE circulars weighted highest since they're primary-source, not press) |
| **Headline/body sentiment consistency** | flag | LLM checks if the headline's tone matches the body's actual content — flags likely clickbait/sensationalized headlines so they don't overweight the aggregate off a headline alone |

### 4.2 Aggregate metrics (computed once per analysis run, from that run's 30 articles)

| Metric | What it captures |
|---|---|
| **Weighted average sentiment** | The 30 articles' sentiment scores, weighted by source credibility × relevance — this run's snapshot, not a running total |
| **Sentiment trend (direction)** | Compare this run's weighted average sentiment to the **previous stored snapshot** for the same IPO (if one exists) — this is why re-analysis over time, even on-demand, is still useful: two analyses a few days apart give you a real trend read, not a live one |
| **Coverage volume / "buzz"** | How many of the 30 slots were filled with genuinely recent (last 48 hrs) articles vs. older ones — a pool that's mostly last-48-hours coverage signals active/breaking interest; a pool padded with older articles signals the story has gone quiet |
| **Sentiment dispersion** | How much the 30 articles' sentiment scores disagree with each other (variance/spread) — low dispersion = broad consensus; high dispersion = a genuinely contested/controversial story worth reading yourself |
| **Topic distribution** | % of the 30 articles falling into each topic tag |
| **Official vs. media split** | Sentiment/tone comparison between any NSE/BSE official circulars that made the top-30 cut vs. general media coverage in the same set |

### 4.3 News Sentiment Score (0–100) — final rollup

```
News Sentiment Score = f(weighted average sentiment, sentiment trend, dispersion penalty)
```

- Base score derived from weighted average sentiment (mapped from -1..+1 onto 0..100).
- Adjusted up/down slightly based on trend direction (improving trend nudges the score up a few points even if the current average is only middling; deteriorating trend nudges it down).
- A dispersion penalty reduces confidence display (not the score itself) when sentiment is highly split — surface this as a "low consensus" flag next to the score rather than hiding the disagreement inside a single number.
- Coverage volume and topic distribution are **not** folded into the single number — display them separately alongside the score, since "a lot of positive articles" and "a little positive coverage" are different situations that a single blended score would erase.

**Display on the IPO detail page — News & Sentiment tab:**
- The News Sentiment Score itself, plus its trend arrow (↑/↓/flat over the last 48 hrs).
- A "consensus" indicator (High/Medium/Low, from dispersion).
- A small topic-distribution breakdown (e.g., a simple bar: 60% business, 25% subscription-demand, 15% litigation).
- The actual article feed below, each showing its individual sentiment, topic tag, and source — so you can always read the raw material behind the number, not just trust the score.

---

## 5. LLM Analysis Setup

Same as the RHP plan — **OpenRouter → NVIDIA Nemotron 3 Super**, with the same multi-key rotation wrapper (`lib/llmClient`) already built for the RHP engine. Reuse it here rather than building a second client — one rotation system, shared across both engines, since they're drawing from the same pool of OpenRouter keys and limits.

- Prompt per article: send headline + snippet/body text + the company/IPO name, ask for structured JSON: `{sentiment: -1.0 to 1.0, topic: "...", relevance: 0.0-1.0, headline_body_consistent: true/false}`.
- **Batch all 30 articles into a small number of requests** (e.g., 5–10 articles per call, asking for an array of results back) — since the set is now bounded at exactly 30 per analysis run, this is a predictable, fixed-size cost per click, not an open-ended volume like continuous ingestion would be. This is the main lever that keeps token usage low, as requested.
- If all rotated keys are exhausted mid-run, the request can still return a partial result (whatever articles were scored before exhaustion) rather than failing entirely — show "partial analysis (X/30 articles scored)" and let the user retry the rest, since this is now a user-facing synchronous-ish action, not a silent background job that can just wait for the next cron cycle.

---

## 6. Database Schema Additions

```
news_articles
  id, ipo_id, analysis_run_id, company_id, headline, url, source, published_at,
  sentiment_score, topic_tag, relevance_score, headline_body_consistent,
  fetched_at, scored_at

news_sentiment_snapshots
  id, ipo_id, analysis_run_id, weighted_avg_sentiment, sentiment_trend_direction,
  coverage_volume_recent, sentiment_dispersion, news_sentiment_score,
  articles_scored_count, triggered_by (user click / manual refresh),
  computed_at
```

- `analysis_run_id` groups the exact 30 (or fewer, if a source came up short) articles belonging to one on-demand click — this replaces the old design's continuous accumulation, since now each run is a discrete, bounded event, not an ever-growing pool per IPO.
- `news_sentiment_snapshots` still powers the trend arrow and history, comparing each new `computed_at` run against the previous one for the same IPO — same purpose as before, just now populated by clicks instead of cron ticks.
- Cache-check logic (Section 3.1, step 2) reads the most recent `news_sentiment_snapshots` row for the IPO and compares its `computed_at` against the configured freshness window before deciding whether to trigger a new run at all.

---

## 7. Phase Plan (additive to the RHP engine's phases)

### Phase N.1 — Search & Ranking
1. Build each targeted-search source module (Section 2), parameterized by company name at call time.
2. Build the candidate collection + dedupe + pre-LLM ranking step, bounded to top 30 (Section 3.1, steps 3–5).
3. Build the cache-check logic (read latest snapshot, compare freshness window) before allowing a new run.

### Phase N.2 — LLM Scoring
1. Wire `lib/llmClient` for the batched 30-article scoring prompt (Section 5).
2. Handle partial-result cases (key exhaustion mid-run) gracefully in the response.

### Phase N.3 — Aggregation
1. Implement the aggregate metrics (Section 4.2) computed once per `analysis_run_id`.
2. Compute and store the News Sentiment Score + snapshot, including the trend comparison against the prior snapshot for that IPO.

### Phase N.4 — UI
1. Add the "News Sentiment" card/button beside the RHP score on the IPO overview.
2. Build the click → loading state → result flow (this is now a user-triggered, roughly real-time action, not a passive background-updated tab).
3. Show cached results immediately when available, with a visible "last analyzed X ago" + manual refresh option.
4. Build the News & Sentiment detail view: score, trend arrow, consensus indicator, topic breakdown, the 30 articles themselves.

---

*This file — `purpleipo-news-sentiment-engine-plan.md` — is the complete, standalone brief for PurpleIPO's on-demand news sentiment engine: triggered by a click on the IPO overview page, targeted search for that specific company only, capped at the top 30 relevant articles per run, cached to avoid redundant re-analysis. Pairs with `purpleipo-rhp-scoring-plan.md`; both share the same app, kanban, password gate, database, and OpenRouter/Nemotron key-rotation LLM client.*
