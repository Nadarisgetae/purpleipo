'use client';

import React, { useState, useEffect } from 'react';
import {
  X, Building2, FileText, Layers, Newspaper, Sliders,
  UploadCloud, ShieldCheck, Scale, Cpu, ChevronDown, ChevronUp,
  Activity, BarChart3, Zap, Globe, Sigma, AlertTriangle, CheckCircle2,
  Minus, ThumbsUp, ThumbsDown, History, TrendingUp, TrendingDown, Clock,
  ListChecks,
} from 'lucide-react';
import { IPOItem } from './KanbanBoard';
import ScoreHistoryChart from './ScoreHistoryChart';

interface FactorScore {
  factor_key: string;
  category: string;
  score: number;
  confidence: number;
  evidence_text: string;
  source_section: string;
}

interface SignalDetails {
  nifty_trend: string;
  india_vix: number;
  fii_dii_flow: string;
  dcf_valuation_gap: string;
  anchor_quality_score: number;
  subscription_multiples: string;
}

interface SignalSubgroups {
  fundamentals: number;
  technicals_macro: number;
  demand_subscription: number;
}

interface Headline {
  title: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  impact_score: number;
  source: string;
  date: string;
}

interface IPODetailModalProps {
  ipo: IPOItem;
  onClose: () => void;
}

// ─── Mini helpers ──────────────────────────────────────────────────────────────

const ScoreBadge = ({ score, size = 'sm' }: { score: number; size?: 'sm' | 'lg' }) => {
  const color =
    score >= 80 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
    score >= 65 ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' :
    score >= 50 ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
    'text-red-400 bg-red-500/10 border-red-500/30';

  return (
    <span className={`font-black border rounded-xl px-3 ${color} ${size === 'lg' ? 'text-3xl py-1' : 'text-xl py-0.5'}`}>
      {score.toFixed(1)}
    </span>
  );
};

const MiniBar = ({ value, color = 'bg-purple-500' }: { value: number; color?: string }) => (
  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
    <div
      className={`h-full rounded-full transition-all duration-700 ${color}`}
      style={{ width: `${Math.min(100, value)}%` }}
    />
  </div>
);

const SentimentIcon = ({ s }: { s: 'positive' | 'negative' | 'neutral' }) => {
  if (s === 'positive') return <ThumbsUp className="w-3.5 h-3.5 text-emerald-400" />;
  if (s === 'negative') return <ThumbsDown className="w-3.5 h-3.5 text-red-400" />;
  return <Minus className="w-3.5 h-3.5 text-slate-400" />;
};

// ─── Main Component ────────────────────────────────────────────────────────────

export default function IPODetailModal({ ipo, onClose }: IPODetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'rhp' | 'independent' | 'news' | 'composite' | 'history'>('overview');

  // State
  const [uploading, setUploading] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [scoringSignals, setScoringSignals] = useState(false);
  const [scoringNews, setScoringNews] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const [factorScores, setFactorScores] = useState<FactorScore[]>([]);
  const [expandedFactor, setExpandedFactor] = useState<string | null>(null);

  const [rhpScore, setRhpScore] = useState<number>(ipo.rhp_score ?? 70);
  const [indepScore, setIndepScore] = useState<number>(ipo.independent_score ?? 65);
  const [newsScore, setNewsScore] = useState<number>(ipo.news_score ?? 75);

  const [signalDetails, setSignalDetails] = useState<SignalDetails | null>(null);
  const [signalSubgroups, setSignalSubgroups] = useState<SignalSubgroups | null>(null);

  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [newsSummary, setNewsSummary] = useState('');
  const [newsStats, setNewsStats] = useState({ pos: 0, neg: 0, neu: 0 });

  // History tab state
  interface StageSeries { stage: number; composite: number; rhp: number; independent: number; news: number; }
  interface SnapshotRow { id: string; stage_at_time: number; composite_score: number; rhp_score: number; independent_score: number; news_score: number; created_at: string; }
  const [stageSeries, setStageSeries] = useState<StageSeries[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [listingPriceInput, setListingPriceInput] = useState('');
  const [savedListingGain, setSavedListingGain] = useState<number | null>(null);
  const [savingListing, setSavingListing] = useState(false);

  // Composite weight sliders
  const [w1, setW1] = useState(50);
  const [w2, setW2] = useState(30);
  const [w3, setW3] = useState(20);

  const totalWeight = w1 + w2 + w3 || 100;
  const normW1 = w1 / totalWeight;
  const normW2 = w2 / totalWeight;
  const normW3 = w3 / totalWeight;
  const dynamicComposite = (rhpScore * normW1) + (indepScore * normW2) + (newsScore * normW3);

  const getRecommendation = (score: number) => {
    if (score >= 80) return { label: 'Strong Buy', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
    if (score >= 65) return { label: 'Buy Signal', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' };
    if (score >= 50) return { label: 'Neutral / Watch', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
    if (score >= 35) return { label: 'Caution', color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' };
    return { label: 'Avoid', color: 'text-red-400 bg-red-500/10 border-red-500/30' };
  };
  const rec = getRecommendation(dynamicComposite);

  // Load existing factor scores on mount
  useEffect(() => {
    fetch(`/api/ipos/${ipo.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data.factor_scores) setFactorScores(data.data.factor_scores);
        if (data.success && data.data.listing_gain_pct != null) setSavedListingGain(Number(data.data.listing_gain_pct));
        if (data.success && data.data.listing_price) setListingPriceInput(String(data.data.listing_price));
      })
      .catch(console.error);
  }, [ipo.id]);

  // Load history when history tab is opened
  useEffect(() => {
    if (activeTab !== 'history') return;
    setHistoryLoading(true);
    fetch(`/api/ipos/${ipo.id}/score-history`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setStageSeries(data.stage_series || []);
          setSnapshots(data.snapshots || []);
        }
      })
      .catch(console.error)
      .finally(() => setHistoryLoading(false));
  }, [activeTab, ipo.id]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setStatusMsg('Uploading PDF to Cloudflare R2 and parsing sections...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'RHP');
      const res = await fetch(`/api/ipos/${ipo.id}/documents`, { method: 'POST', body: formData });
      const data = await res.json();
      setStatusMsg(data.success ? '✅ RHP PDF uploaded and parsed!' : `❌ ${data.message}`);
    } catch {
      setStatusMsg('❌ Error uploading document.');
    } finally {
      setUploading(false);
    }
  };

  const handleRunRHPScoring = async () => {
    setScoring(true);
    setStatusMsg('Running 23-factor Layer 1 scoring engine with Gemini LLM...');
    try {
      const res = await fetch(`/api/ipos/${ipo.id}/score-rhp`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setRhpScore(data.rhp_score);
        setFactorScores(data.factor_scores);
        setStatusMsg(`🎉 Layer 1 RHP Score: ${data.rhp_score}/100 — saved to Supabase.`);
      } else {
        setStatusMsg(`❌ ${data.message}`);
      }
    } catch {
      setStatusMsg('❌ Error running RHP scoring engine.');
    } finally {
      setScoring(false);
    }
  };

  const handleRunSignals = async () => {
    setScoringSignals(true);
    setStatusMsg('Computing Layer 2 independent market signals...');
    try {
      const res = await fetch(`/api/ipos/${ipo.id}/score-independent`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setIndepScore(data.independent_score);
        setSignalDetails(data.details);
        setSignalSubgroups(data.subgroups);
        setStatusMsg(`✅ Layer 2 Independent Score: ${data.independent_score}/100 — saved.`);
      } else {
        setStatusMsg(`❌ ${data.message}`);
      }
    } catch {
      setStatusMsg('❌ Error computing market signals.');
    } finally {
      setScoringSignals(false);
    }
  };

  const handleRunNewsSentiment = async () => {
    setScoringNews(true);
    setStatusMsg('Running Gemini LLM news sentiment classification...');
    try {
      const res = await fetch(`/api/ipos/${ipo.id}/score-news`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setNewsScore(data.news_score);
        setHeadlines(data.top_headlines || []);
        setNewsSummary(data.summary || '');
        setNewsStats({ pos: data.positive_count, neg: data.negative_count, neu: data.neutral_count });
        setStatusMsg(`✅ Layer 3 News Score: ${data.news_score}/100 — ${data.article_count} headlines analyzed.`);
      } else {
        setStatusMsg(`❌ ${data.message}`);
      }
    } catch {
      setStatusMsg('❌ Error running news sentiment engine.');
    } finally {
      setScoringNews(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl glass-panel-glow rounded-3xl border border-purple-500/20 shadow-2xl overflow-hidden my-8">

        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="p-6 sm:p-8 bg-gradient-to-r from-purple-950/40 via-slate-900/60 to-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-500/15">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/20">
                Stage {ipo.current_stage} • Active Lifecycle
              </span>
              <span className="text-xs text-slate-400">{ipo.sector}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">{ipo.company_name}</h2>
            <p className="text-xs text-slate-400 mt-1">CIN: {ipo.cin || 'N/A'}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-2xl border text-center ${rec.color}`}>
              <span className="block text-[10px] uppercase font-bold tracking-wider opacity-80">Composite Score</span>
              <span className="text-2xl font-black">{dynamicComposite.toFixed(1)}</span>
              <span className="block text-[10px] font-semibold">{rec.label}</span>
            </div>
            <button onClick={onClose} className="p-2 rounded-full bg-slate-900 border border-slate-700/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Tab Nav ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-800 overflow-x-auto bg-slate-950/40 text-xs font-medium">
          {[
            { id: 'overview', label: 'Overview', icon: Building2 },
            { id: 'rhp', label: 'RHP Analysis', icon: FileText },
            { id: 'independent', label: 'Market Signals', icon: Layers },
            { id: 'news', label: 'News & Sentiment', icon: Newspaper },
            { id: 'composite', label: 'Composite & Weights', icon: Sliders },
            { id: 'history', label: 'Score History', icon: History },
          ].map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-purple-500 text-purple-300 bg-purple-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Status message bar */}
        {statusMsg && (
          <div className="px-6 py-2 bg-slate-900/60 text-xs font-semibold text-purple-300 border-b border-slate-800 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            {statusMsg}
          </div>
        )}

        {/* ── Tab Contents ────────────────────────────────────────────── */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[520px] overflow-y-auto">

          {/* ── TAB 1: OVERVIEW ─────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Score Overview Cards */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Layer 1 — RHP', val: rhpScore, color: 'border-purple-500/30 bg-purple-500/5' },
                  { label: 'Layer 2 — Signals', val: indepScore, color: 'border-indigo-500/30 bg-indigo-500/5' },
                  { label: 'Layer 3 — Sentiment', val: newsScore, color: 'border-emerald-500/30 bg-emerald-500/5' },
                ].map(({ label, val, color }) => (
                  <div key={label} className={`p-4 rounded-2xl border ${color} space-y-2 text-center`}>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">{label}</span>
                    <ScoreBadge score={val} />
                    <MiniBar value={val} color={color.includes('purple') ? 'bg-purple-500' : color.includes('indigo') ? 'bg-indigo-500' : 'bg-emerald-500'} />
                  </div>
                ))}
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Total Issue Size', val: ipo.issue_size || 'TBD' },
                  { label: 'Price Band', val: ipo.price_band || 'TBD' },
                  { label: 'Lot Size', val: ipo.lot_size || 'TBD' },
                  { label: 'Min Investment', val: ipo.minimum_investment || 'TBD' },
                  { label: 'Fresh Issue', val: ipo.fresh_issue_amount || 'TBD' },
                  { label: 'OFS', val: ipo.ofs_amount || 'TBD' },
                ].map(({ label, val }) => (
                  <div key={label} className="glass-panel p-4 rounded-xl space-y-1">
                    <span className="text-[11px] text-slate-400">{label}</span>
                    <p className="text-base font-bold text-white">{val}</p>
                  </div>
                ))}
              </div>

              {/* Timeline */}
              <div className="glass-panel p-5 rounded-2xl space-y-3 border border-slate-800">
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  <Scale className="w-4 h-4 text-purple-400" />
                  Key Offer Timeline
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  {[
                    { label: 'Bidding Opens', val: ipo.issue_open_date },
                    { label: 'Bidding Closes', val: ipo.issue_close_date },
                    { label: 'Expected Listing', val: ipo.listing_date },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <span className="text-slate-500 block">{label}</span>
                      <span className="font-medium text-slate-200">{val || 'To be announced'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: RHP ANALYSIS ─────────────────────────────────── */}
          {activeTab === 'rhp' && (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl glass-panel border border-purple-500/20 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-sm text-white flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-purple-400" />
                      Layer 1 — RHP Scoring Engine (23 Factors + Gemini LLM)
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">Evaluates financials, governance, litigation, deal structure & objects specificity.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer">
                      <UploadCloud className="w-4 h-4 text-purple-400" />
                      <span>{uploading ? 'Uploading...' : 'Upload RHP PDF'}</span>
                      <input type="file" accept=".pdf" onChange={handleFileUpload} disabled={uploading} className="hidden" />
                    </label>
                    <button
                      onClick={handleRunRHPScoring}
                      disabled={scoring}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-purple-600/30 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Cpu className={`w-4 h-4 ${scoring ? 'animate-spin' : ''}`} />
                      <span>{scoring ? 'Evaluating...' : 'Run RHP Scoring'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* RHP Score Banner */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <div>
                  <h4 className="font-bold text-sm text-purple-200">Layer 1 — Prospectus (RHP) Score</h4>
                  <p className="text-xs text-slate-400">Composite of 23 weighted factors across 5 categories.</p>
                </div>
                <ScoreBadge score={rhpScore} size="lg" />
              </div>

              {/* Factor Accordion */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">
                  Factor Evidence Breakdown ({factorScores.length || 23} Factors)
                </h4>
                {factorScores.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed border-slate-800 text-center space-y-3">
                    <ShieldCheck className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-400">No factor evidence yet. Run the scoring engine to analyze this IPO.</p>
                    <button onClick={handleRunRHPScoring} disabled={scoring} className="px-4 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-500 transition-colors cursor-pointer">
                      Run Scoring Engine
                    </button>
                  </div>
                ) : (
                  factorScores.map((f, idx) => {
                    const isExpanded = expandedFactor === f.factor_key;
                    const scoreColor = f.score >= 8 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : f.score >= 6 ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' : f.score >= 4 ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-red-400 bg-red-500/10 border-red-500/30';
                    return (
                      <div key={idx} className="rounded-xl glass-panel border border-slate-800 overflow-hidden">
                        <div onClick={() => setExpandedFactor(isExpanded ? null : f.factor_key)} className="p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-900/60">
                          <div className="flex items-center gap-3">
                            <span className={`w-10 h-7 rounded-lg border text-xs flex items-center justify-center font-black ${scoreColor}`}>
                              {f.score.toFixed(1)}
                            </span>
                            <div>
                              <h5 className="font-semibold text-xs text-white capitalize">{f.factor_key.replace(/_/g, ' ')}</h5>
                              <span className="text-[10px] text-slate-400">{f.category} • {f.source_section}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">Conf: {(f.confidence * 100).toFixed(0)}%</span>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="p-3.5 bg-slate-950/60 border-t border-slate-800 text-xs space-y-1.5">
                            <span className="text-purple-300 font-semibold block text-[11px]">Audit Evidence Snippet:</span>
                            <p className="text-slate-300 leading-relaxed italic">{f.evidence_text}</p>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ── TAB 3: INDEPENDENT SIGNALS (Layer 2) ────────────────── */}
          {activeTab === 'independent' && (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl glass-panel border border-indigo-500/20 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-sm text-white flex items-center gap-2">
                      <Activity className="w-4 h-4 text-indigo-400" />
                      Layer 2 — Independent Market Signal Engine
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">Macro environment, ratio benchmarking, DCF gap & subscription demand.</p>
                  </div>
                  <button
                    onClick={handleRunSignals}
                    disabled={scoringSignals}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <Zap className={`w-4 h-4 ${scoringSignals ? 'animate-pulse' : ''}`} />
                    <span>{scoringSignals ? 'Computing...' : 'Run Signal Engine'}</span>
                  </button>
                </div>
              </div>

              {/* Score Banner */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                <div>
                  <h4 className="font-bold text-sm text-indigo-200">Layer 2 — Independent Signals Score</h4>
                  <p className="text-xs text-slate-400">Fundamentals (35%) · Technicals (35%) · Demand (30%)</p>
                </div>
                <ScoreBadge score={indepScore} size="lg" />
              </div>

              {/* Subgroup scores */}
              {signalSubgroups && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Fundamentals', val: signalSubgroups.fundamentals, icon: BarChart3, color: 'text-purple-400' },
                    { label: 'Technicals & Macro', val: signalSubgroups.technicals_macro, icon: TrendingUp, color: 'text-indigo-400' },
                    { label: 'Demand & Subscription', val: signalSubgroups.demand_subscription, icon: Sigma, color: 'text-emerald-400' },
                  ].map(({ label, val, icon: Icon, color }) => (
                    <div key={label} className="glass-panel p-4 rounded-xl border border-slate-800 space-y-2 text-center">
                      <Icon className={`w-5 h-5 mx-auto ${color}`} />
                      <span className="text-[10px] text-slate-400 block">{label}</span>
                      <span className={`text-xl font-black ${color}`}>{val.toFixed(1)}</span>
                      <MiniBar value={val} color={color.replace('text-', 'bg-').replace('-400', '-500')} />
                    </div>
                  ))}
                </div>
              )}

              {/* Signal detail cards */}
              {signalDetails ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {[
                    { label: 'Nifty/Sensex Trend', val: signalDetails.nifty_trend, icon: TrendingUp, color: 'text-emerald-400' },
                    { label: 'India VIX Level', val: `${signalDetails.india_vix} (${signalDetails.india_vix < 15 ? 'Calm ✅' : signalDetails.india_vix < 20 ? 'Elevated ⚠️' : 'Fearful ❌'})`, icon: Activity, color: signalDetails.india_vix < 15 ? 'text-emerald-400' : signalDetails.india_vix < 20 ? 'text-amber-400' : 'text-red-400' },
                    { label: 'FII/DII Net Flow', val: signalDetails.fii_dii_flow, icon: Globe, color: 'text-indigo-400' },
                    { label: 'DCF Valuation Gap', val: signalDetails.dcf_valuation_gap, icon: BarChart3, color: 'text-purple-400' },
                    { label: 'Anchor Quality Score', val: `${signalDetails.anchor_quality_score}/100`, icon: CheckCircle2, color: 'text-emerald-400' },
                    { label: 'Subscription Multiples', val: signalDetails.subscription_multiples, icon: Sigma, color: 'text-indigo-400' },
                  ].map(({ label, val, icon: Icon, color }) => (
                    <div key={label} className="glass-panel p-4 rounded-xl border border-slate-800 flex items-start gap-3">
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
                      <div>
                        <span className="text-slate-400 block text-[10px] font-semibold uppercase">{label}</span>
                        <span className="text-slate-200 font-semibold">{val}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-dashed border-slate-800 text-center space-y-3">
                  <Activity className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">Run the Signal Engine to compute macro, fundamental & subscription analysis.</p>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 4: NEWS & SENTIMENT (Layer 3) ───────────────────── */}
          {activeTab === 'news' && (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl glass-panel border border-emerald-500/20 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-sm text-white flex items-center gap-2">
                      <Newspaper className="w-4 h-4 text-emerald-400" />
                      Layer 3 — News & Media Sentiment (Gemini LLM)
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">Headlines classified as positive/negative/neutral with recency-weighted scoring.</p>
                  </div>
                  <button
                    onClick={handleRunNewsSentiment}
                    disabled={scoringNews}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <Newspaper className={`w-4 h-4 ${scoringNews ? 'animate-pulse' : ''}`} />
                    <span>{scoringNews ? 'Analyzing...' : 'Analyze Sentiment'}</span>
                  </button>
                </div>
              </div>

              {/* News Score Banner */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div>
                  <h4 className="font-bold text-sm text-emerald-200">Layer 3 — News & Sentiment Score</h4>
                  <p className="text-xs text-slate-400">AI-classified media coverage with recency decay weighting.</p>
                </div>
                <ScoreBadge score={newsScore} size="lg" />
              </div>

              {/* Sentiment Stats */}
              {(newsStats.pos + newsStats.neg + newsStats.neu) > 0 && (
                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <ThumbsUp className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                    <span className="text-emerald-300 font-black text-xl">{newsStats.pos}</span>
                    <span className="text-slate-400 block">Positive</span>
                  </div>
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <ThumbsDown className="w-5 h-5 text-red-400 mx-auto mb-1" />
                    <span className="text-red-300 font-black text-xl">{newsStats.neg}</span>
                    <span className="text-slate-400 block">Negative</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700">
                    <Minus className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                    <span className="text-slate-300 font-black text-xl">{newsStats.neu}</span>
                    <span className="text-slate-400 block">Neutral</span>
                  </div>
                </div>
              )}

              {/* AI Summary */}
              {newsSummary && (
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-200 italic leading-relaxed">
                  <span className="font-bold text-emerald-400 not-italic block mb-1">🤖 Gemini AI Summary:</span>
                  {newsSummary}
                </div>
              )}

              {/* Headlines List */}
              {headlines.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">Analyzed Headlines</h4>
                  {headlines.map((h, i) => (
                    <div key={i} className="glass-panel p-3.5 rounded-xl border border-slate-800 flex items-start gap-3">
                      <div className="mt-0.5">
                        <SentimentIcon s={h.sentiment} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-200 font-medium leading-snug">{h.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-slate-500">{h.source}</span>
                          <span className="text-[10px] text-slate-600">·</span>
                          <span className="text-[10px] text-slate-500">{h.date}</span>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border shrink-0 ${
                        h.sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                        h.sentiment === 'negative' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                        'bg-slate-700 text-slate-400 border-slate-600'
                      }`}>
                        {h.impact_score.toFixed(1)}/10
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-dashed border-slate-800 text-center space-y-3">
                  <Newspaper className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">Click "Analyze Sentiment" to classify IPO media coverage using Gemini LLM.</p>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 6: SCORE HISTORY & POST-LISTING ─────────────── */}
          {activeTab === 'history' && (
            <div className="space-y-6">

              {/* Chart Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-white flex items-center gap-2">
                    <History className="w-4 h-4 text-purple-400" />
                    Score History — Stage-by-Stage Timeline
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {stageSeries.length > 0 ? `${stageSeries.length} scored stage(s) recorded` : 'No snapshots yet — run any scoring engine to begin tracking.'}
                  </p>
                </div>
                {historyLoading && (
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    Loading...
                  </div>
                )}
              </div>

              {/* SVG Line Chart */}
              <div className="glass-panel p-4 rounded-2xl border border-slate-800">
                <ScoreHistoryChart data={stageSeries} height={220} />
              </div>

              {/* Post-Listing Tracker */}
              <div className="p-5 rounded-2xl glass-panel border border-amber-500/20 space-y-4">
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                  Post-Listing Price Tracker
                </h4>
                <p className="text-xs text-slate-400">
                  Record the actual listing price to compute listing gain vs. predicted composite score.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="flex-1 space-y-1">
                    <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Listing Price (₹)</label>
                    <input
                      type="number"
                      value={listingPriceInput}
                      onChange={e => setListingPriceInput(e.target.value)}
                      placeholder="e.g. 456.00"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm font-semibold placeholder:text-slate-600 focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Issue Price (₹) from band</label>
                    <input
                      readOnly
                      value={ipo.price_band || 'TBD'}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 text-sm cursor-not-allowed"
                    />
                  </div>
                  <button
                    disabled={!listingPriceInput || savingListing}
                    onClick={async () => {
                      setSavingListing(true);
                      try {
                        // Parse issue price from price band string (take upper bound)
                        const priceBandStr = ipo.price_band || '0';
                        const upperPrice = parseFloat(priceBandStr.replace(/[^0-9.-]/g, '').split('-').pop() || '0');
                        const listPrice = parseFloat(listingPriceInput);
                        const gainPct = upperPrice > 0 ? Number(((listPrice - upperPrice) / upperPrice * 100).toFixed(2)) : 0;

                        const res = await fetch(`/api/ipos/${ipo.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ listing_price: listPrice, listing_gain_pct: gainPct }),
                        });
                        const data = await res.json();
                        if (data.success) setSavedListingGain(gainPct);
                        setStatusMsg(`✅ Listing data saved! Gain: ${gainPct > 0 ? '+' : ''}${gainPct.toFixed(2)}%`);
                      } catch {
                        setStatusMsg('❌ Failed to save listing data.');
                      } finally {
                        setSavingListing(false);
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer disabled:opacity-40 shrink-0"
                  >
                    {savingListing ? 'Saving...' : 'Save Listing Price'}
                  </button>
                </div>

                {/* Gain / Loss Result Card */}
                {savedListingGain !== null && (
                  <div className={`p-4 rounded-xl border flex items-center justify-between ${
                    savedListingGain >= 0
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-red-500/10 border-red-500/30'
                  }`}>
                    <div className="flex items-center gap-3">
                      {savedListingGain >= 0
                        ? <TrendingUp className="w-5 h-5 text-emerald-400" />
                        : <TrendingDown className="w-5 h-5 text-red-400" />}
                      <div>
                        <span className="text-xs text-slate-400 block">Listing Gain vs. Issue Price</span>
                        <span className={`text-xl font-black ${ savedListingGain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {savedListingGain >= 0 ? '+' : ''}{savedListingGain.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block">Predicted Score</span>
                      <span className="text-lg font-black text-purple-300">{dynamicComposite.toFixed(1)}/100</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Snapshot Log Table */}
              {snapshots.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <ListChecks className="w-3.5 h-3.5" />
                    All Score Snapshots ({snapshots.length})
                  </h4>
                  <div className="rounded-xl border border-slate-800 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-900/60 border-b border-slate-800">
                          {['Stage', 'Composite', 'RHP', 'Signals', 'News', 'Recorded At'].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-slate-400 font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {snapshots.slice().reverse().map((s, i) => (
                          <tr key={s.id} className={`border-b border-slate-800/50 ${ i % 2 === 0 ? 'bg-slate-950/40' : ''}`}>
                            <td className="px-3 py-2 text-purple-300 font-semibold">S{s.stage_at_time}</td>
                            <td className="px-3 py-2 font-black text-white">{Number(s.composite_score).toFixed(1)}</td>
                            <td className="px-3 py-2 text-indigo-300">{s.rhp_score ? Number(s.rhp_score).toFixed(1) : '—'}</td>
                            <td className="px-3 py-2 text-sky-300">{s.independent_score ? Number(s.independent_score).toFixed(1) : '—'}</td>
                            <td className="px-3 py-2 text-emerald-300">{s.news_score ? Number(s.news_score).toFixed(1) : '—'}</td>
                            <td className="px-3 py-2 text-slate-500">{new Date(s.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ── TAB 5: COMPOSITE & WEIGHTS ──────────────────────────── */}
          {activeTab === 'composite' && (
            <div className="space-y-6">
              {/* Score Summary Row */}
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: 'Layer 1 RHP', val: rhpScore, w: normW1, color: 'text-purple-400' },
                  { label: 'Layer 2 Signals', val: indepScore, w: normW2, color: 'text-indigo-400' },
                  { label: 'Layer 3 Sentiment', val: newsScore, w: normW3, color: 'text-emerald-400' },
                ].map(({ label, val, w, color }) => (
                  <div key={label} className="glass-panel p-4 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400">{label}</span>
                    <span className={`text-xl font-black block ${color}`}>{val.toFixed(1)}</span>
                    <span className="text-[10px] text-slate-500">Weight: {(w * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>

              {/* Sliders */}
              <div className="p-5 rounded-2xl glass-panel border border-purple-500/20 space-y-4">
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-purple-400" />
                  Interactive Layer Weight Sliders
                </h4>
                <p className="text-[11px] text-slate-400">Weights auto-normalise to 100%. Drag to see composite score update live.</p>

                {[
                  { label: 'Layer 1: Prospectus (RHP)', val: w1, set: setW1, color: 'accent-purple-500', textColor: 'text-purple-300' },
                  { label: 'Layer 2: Independent Signals', val: w2, set: setW2, color: 'accent-indigo-500', textColor: 'text-indigo-300' },
                  { label: 'Layer 3: News Sentiment', val: w3, set: setW3, color: 'accent-emerald-500', textColor: 'text-emerald-300' },
                ].map(({ label, val, set, color, textColor }) => (
                  <div key={label} className="space-y-1.5 text-xs">
                    <div className="flex justify-between font-semibold">
                      <span className={textColor}>{label}</span>
                      <span className="text-slate-400">{val}% (norm: {Math.round((val / (w1 + w2 + w3 || 100)) * 100)}%)</span>
                    </div>
                    <input
                      type="range" min="0" max="100" value={val}
                      onChange={e => set(Number(e.target.value))}
                      className={`w-full ${color} cursor-pointer`}
                    />
                  </div>
                ))}
              </div>

              {/* Composite Score Readout */}
              <div className={`p-6 rounded-2xl border text-center space-y-1.5 ${rec.color}`}>
                <span className="text-xs uppercase font-extrabold tracking-widest opacity-80">Calculated Composite Score</span>
                <p className="text-5xl font-black">{dynamicComposite.toFixed(1)}</p>
                <span className="text-sm font-bold">{rec.label}</span>
                <p className="text-[10px] opacity-70 mt-1">
                  = (RHP {rhpScore.toFixed(1)} × {(normW1*100).toFixed(0)}%) + (Signals {indepScore.toFixed(1)} × {(normW2*100).toFixed(0)}%) + (News {newsScore.toFixed(1)} × {(normW3*100).toFixed(0)}%)
                </p>
              </div>

              {/* Alert zone */}
              {dynamicComposite < 50 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Composite score below 50 — high risk. Review all layers before allocation decision.</span>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
