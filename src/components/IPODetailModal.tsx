'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, Landmark, Calendar, RefreshCw, FileText, ChevronDown, ChevronUp, 
  CheckCircle, TrendingUp, AlertTriangle, Sparkles, Building2, BarChart3, Target, ShieldCheck,
  Flame, Users, Clock, Newspaper, TrendingDown, Minus
} from 'lucide-react';

interface IPODetailModalProps {
  ipoId: string;
  onClose: () => void;
}

// Helper to calculate Complete Lot Price (Price Band * Lot Size)
function getLotPriceDetails(priceBand: string | null, lotSizeStr: string | null, minInvestment: number | null) {
  const lotNum = lotSizeStr ? parseFloat(lotSizeStr.replace(/[^\d.]/g, '')) : 0;
  const priceMatches = priceBand ? priceBand.match(/[\d.]+/g) : null;
  const prices = priceMatches ? priceMatches.map(p => parseFloat(p)).filter(p => !isNaN(p) && p > 0) : [];

  if (lotNum > 0 && prices.length > 0) {
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const minTotal = Math.round(minP * lotNum);
    const maxTotal = Math.round(maxP * lotNum);

    if (minTotal === maxTotal) {
      return {
        formatted: `₹${maxTotal.toLocaleString('en-IN')}`,
        calculation: `${lotNum.toLocaleString()} Shares × ₹${maxP.toLocaleString('en-IN')}`,
        cutOff: `₹${maxTotal.toLocaleString('en-IN')}`,
        isRange: false,
      };
    }

    return {
      formatted: `₹${minTotal.toLocaleString('en-IN')} – ₹${maxTotal.toLocaleString('en-IN')}`,
      calculation: `${lotNum.toLocaleString()} Shares × [₹${minP} to ₹${maxP}]`,
      cutOff: `₹${maxTotal.toLocaleString('en-IN')} (at upper cut-off)`,
      isRange: true,
    };
  }

  if (minInvestment && minInvestment > 0) {
    return {
      formatted: `₹${Math.round(minInvestment).toLocaleString('en-IN')}`,
      calculation: `Standard minimum lot investment`,
      cutOff: `₹${Math.round(minInvestment).toLocaleString('en-IN')}`,
      isRange: false,
    };
  }

  return {
    formatted: 'TBA',
    calculation: 'Price band or lot size not yet announced by SEBI/BSE',
    cutOff: 'TBA',
    isRange: false,
  };
}

export default function IPODetailModal({ ipoId, onClose }: IPODetailModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [fetchingDoc, setFetchingDoc] = useState(false);
  const [analyzingNews, setAnalyzingNews] = useState(false);
  const [newsError, setNewsError] = useState('');
  const [error, setError] = useState('');

  // Expandable card states
  const [expandOverview, setExpandOverview] = useState(true);
  const [expandFinancials, setExpandFinancials] = useState(false);
  const [expandPromoters, setExpandPromoters] = useState(false);

  // Fetch all details from API
  const fetchDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/ipos/${ipoId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setError('Failed to fetch details from database API.');
      }
    } catch (e) {
      setError('Connection error. Could not reach server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [ipoId]);

  // Fetch RHP for ONLY this single IPO
  const handleFetchRHP = async () => {
    setFetchingDoc(true);
    try {
      const res = await fetch('/api/sync/fetch-rhp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ipoId })
      });
      if (res.ok) {
        await fetchDetails();
      } else {
        const errJson = await res.json();
        alert(`Failed to fetch prospectus: ${errJson.error || 'Server error'}`);
      }
    } catch (e) {
      alert('Connection error while fetching prospectus.');
    } finally {
      setFetchingDoc(false);
    }
  };

  // Recalculate RHP Score trigger
  const handleRecalculate = async () => {
    setEvaluating(true);
    try {
      const res = await fetch('/api/sync/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ipoId })
      });
      if (res.ok) {
        await fetchDetails();
      } else {
        const errJson = await res.json();
        alert(`Evaluation failed: ${errJson.error || 'Server error'}`);
      }
    } catch (e) {
      alert('Error triggering scoring engine.');
    } finally {
      setEvaluating(false);
    }
  };

  const handleAnalyzeNews = async (force = false) => {
    setAnalyzingNews(true);
    setNewsError('');
    try {
      const res = await fetch(`/api/ipos/${ipoId}/analyze-news`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force_refresh: force })
      });
      if (res.ok) {
        const json = await res.json();
        setData((prev: any) => ({ ...prev, newsSentiment: json }));
      } else {
        const errJson = await res.json();
        setNewsError(errJson.error || 'Failed to analyze news');
      }
    } catch (e) {
      setNewsError('Connection error while fetching news sentiment.');
    } finally {
      setAnalyzingNews(false);
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20';
    if (score >= 8) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (score >= 6.5) return 'text-green-400 bg-green-500/10 border-green-500/20';
    if (score >= 5) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    if (score >= 3.5) return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  };

  const getScoreBand = (score: number | null) => {
    if (score === null) return 'Unscored';
    if (score >= 80) return 'Strong Buy';
    if (score >= 65) return 'Buy';
    if (score >= 50) return 'Neutral';
    if (score >= 35) return 'Caution';
    return 'Avoid';
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-[#02040b]/80 backdrop-blur-sm flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 bg-[#0a0f26] border border-white/5 p-8 rounded-3xl shadow-2xl max-w-xs text-center">
          <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
          <span className="text-sm font-bold text-zinc-200">Loading IPO details...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 z-50 bg-[#02040b]/80 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-[#0a0f26] border border-rose-500/20 p-8 rounded-3xl shadow-2xl max-w-sm text-center">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-zinc-200 mb-4">{error || 'Data could not be loaded.'}</p>
          <button onClick={onClose} className="px-5 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold text-white transition">
            Close Modal
          </button>
        </div>
      </div>
    );
  }

  const { ipo, promoters, anchors, subscription, factorScores, document, newsSentiment } = data;

  // Group factors by category
  const categories = [
    { key: 'financial_health', name: 'Business & Financial Health', weight: '25%' },
    { key: 'deal_structure', name: 'Deal Structure', weight: '20%' },
    { key: 'governance', name: 'Ownership & Governance', weight: '20%' },
    { key: 'business_quality', name: 'Business Quality & Risk', weight: '20%' },
    { key: 'market_sentiment', name: 'Market Sentiment & Demand', weight: '15%' }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#02040b]/80 backdrop-blur-md flex items-center justify-center p-4 md:p-6 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#090d20] border border-white/5 rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-[#0b1029]/50 shrink-0">
          <div className="flex items-center gap-3">
            {ipo.category_tag && (
              <span className={`inline-block text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${
                ipo.category_tag.toLowerCase().includes('large')
                  ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                  : ipo.category_tag.toLowerCase().includes('mid')
                  ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                  : ipo.category_tag.toLowerCase().includes('sme')
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-sky-500/15 text-sky-300 border-sky-500/30'
              }`}>
                {ipo.category_tag}
              </span>
            )}
            <span className="inline-block text-[10px] font-black uppercase text-zinc-400 bg-white/5 px-2.5 py-1 rounded-lg">
              {ipo.company_sector || 'General'}
            </span>
            <div>
              <h2 className="text-base font-black text-white">{ipo.company_name}</h2>
              <p className="text-[10px] text-zinc-500 font-medium">IPO Details & RHP Analysis Summary</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Fetch RHP Button (Single IPO on-demand) */}
            <button
              onClick={handleFetchRHP}
              disabled={fetchingDoc}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold border transition ${
                fetchingDoc
                  ? 'bg-purple-600/20 border-purple-500/30 text-purple-400'
                  : document
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-zinc-300 hover:text-white'
              }`}
            >
              <FileText className={`w-3.5 h-3.5 ${fetchingDoc ? 'animate-spin' : ''}`} />
              {fetchingDoc ? 'Fetching RHP...' : document ? 'RHP Ready' : 'Fetch RHP'}
            </button>

            {/* Evaluate with AI Trigger Button */}
            <button
              onClick={handleRecalculate}
              disabled={evaluating}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-bold border transition ${
                evaluating
                  ? 'bg-purple-600/20 border-purple-500/30 text-purple-400 shadow-lg shadow-purple-600/20'
                  : 'bg-purple-600 border-purple-500 text-white hover:bg-purple-500 shadow-lg shadow-purple-600/25'
              }`}
            >
              {evaluating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {evaluating ? 'Analyzing RHP...' : 'Evaluate with AI'}
            </button>

            <button onClick={onClose} className="text-zinc-500 hover:text-white transition p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 scrollbar-none">
          
          {/* Top Headline Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-zinc-500 uppercase">RHP Final Score</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-white">{ipo.rhp_score !== null ? ipo.rhp_score : 'N/A'}</span>
                {ipo.rhp_score !== null && (
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                    ipo.rhp_score >= 80 ? 'bg-emerald-500/10 text-emerald-400' :
                    ipo.rhp_score >= 65 ? 'bg-green-500/10 text-green-400' :
                    ipo.rhp_score >= 50 ? 'bg-amber-500/10 text-amber-400' :
                    'bg-rose-500/10 text-rose-400'
                  }`}>
                    {getScoreBand(ipo.rhp_score)}
                  </span>
                )}
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-zinc-500 uppercase">Min Investment</span>
              <div className="mt-2">
                <span className="text-lg font-bold text-white">
                  {ipo.min_investment ? `₹${ipo.min_investment.toLocaleString('en-IN')}` : 'TBA'}
                </span>
                <p className="text-[9px] text-zinc-500 mt-0.5">Price: {ipo.price_band || 'TBA'}</p>
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-zinc-500 uppercase">IPO Date Range</span>
              <div className="mt-2">
                <span className="text-xs font-bold text-white flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                  {ipo.issue_open_date ? `${new Date(ipo.issue_open_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${new Date(ipo.issue_close_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'TBA'}
                </span>
                <p className="text-[9px] text-zinc-500 mt-1">Listing: {ipo.listing_date ? new Date(ipo.listing_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBA'}</p>
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-zinc-500 uppercase">Prospectus Document</span>
              <div className="mt-2">
                {document?.file_url || ipo.rhp_url ? (
                  <a
                    href={document?.file_url || ipo.rhp_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-purple-400 hover:text-purple-300 underline"
                  >
                    <FileText className="w-3.5 h-3.5" /> View RHP PDF
                  </a>
                ) : (
                  <button
                    onClick={handleFetchRHP}
                    disabled={fetchingDoc}
                    className="inline-flex items-center gap-1 text-xs font-bold text-zinc-400 hover:text-white"
                  >
                    <FileText className="w-3.5 h-3.5" /> Click to Fetch RHP
                  </button>
                )}
                <p className="text-[9px] text-zinc-500 mt-1">
                  {document ? 'Document Parsed & Saved' : 'Direct Scraper / SEBI link'}
                </p>
              </div>
            </div>
          </div>

          {/* ON-DEMAND NEWS SENTIMENT CARD */}
          <div className="bg-[#0a0f26]/80 border border-white/5 p-5 rounded-2xl relative overflow-hidden space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Newspaper className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-black text-white tracking-wide uppercase">Market News & Sentiment</h3>
                </div>
                <p className="text-[11px] text-zinc-400">
                  On-demand analysis of top 30 recent articles via LLM. Measures current media buzz and reaction.
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-3">
                {newsSentiment && newsSentiment.snapshot && (
                  <div className="text-right">
                    <p className="text-[9px] uppercase font-bold text-zinc-500">
                      Analyzed: {new Date(newsSentiment.snapshot.computed_at).toLocaleDateString('en-IN', { hour: 'numeric', minute: 'numeric' })}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => handleAnalyzeNews(true)}
                  disabled={analyzingNews}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition ${
                    analyzingNews
                      ? 'bg-blue-600/20 border-blue-500/30 text-blue-400 shadow-lg shadow-blue-600/20'
                      : 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/25'
                  }`}
                >
                  {analyzingNews ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Newspaper className="w-4 h-4" />}
                  {analyzingNews ? 'Analyzing...' : newsSentiment ? 'Refresh News' : 'Analyze News Sentiment'}
                </button>
              </div>
            </div>

            {newsError && (
              <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl text-rose-400 text-xs font-semibold">
                {newsError}
              </div>
            )}

            {newsSentiment && newsSentiment.snapshot && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/5">
                {/* Score */}
                <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-bold uppercase text-zinc-500">Sentiment Score</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-4xl font-black text-white">{Math.round(newsSentiment.snapshot.news_sentiment_score)}</span>
                    <span className="text-sm font-semibold text-zinc-500">/ 100</span>
                  </div>
                  <div className={`mt-2 flex items-center gap-1 px-2.5 py-1 rounded-md text-[9px] font-black uppercase ${
                    newsSentiment.snapshot.sentiment_trend_direction === 'up' ? 'bg-emerald-500/15 text-emerald-400' :
                    newsSentiment.snapshot.sentiment_trend_direction === 'down' ? 'bg-rose-500/15 text-rose-400' :
                    'bg-zinc-500/15 text-zinc-400'
                  }`}>
                    {newsSentiment.snapshot.sentiment_trend_direction === 'up' ? <TrendingUp className="w-3 h-3" /> :
                     newsSentiment.snapshot.sentiment_trend_direction === 'down' ? <TrendingDown className="w-3 h-3" /> :
                     <Minus className="w-3 h-3" />}
                    {newsSentiment.snapshot.sentiment_trend_direction === 'up' ? 'Improving Trend' :
                     newsSentiment.snapshot.sentiment_trend_direction === 'down' ? 'Deteriorating Trend' : 'Flat Trend'}
                  </div>
                </div>

                {/* Consensus & Volume */}
                <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex flex-col justify-center space-y-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-zinc-500 block mb-0.5">Consensus (Dispersion)</span>
                    <span className={`text-sm font-bold ${
                      newsSentiment.snapshot.sentiment_dispersion < 0.1 ? 'text-emerald-400' :
                      newsSentiment.snapshot.sentiment_dispersion < 0.3 ? 'text-amber-400' : 'text-rose-400'
                    }`}>
                      {newsSentiment.snapshot.sentiment_dispersion < 0.1 ? 'High (Unified Media)' :
                       newsSentiment.snapshot.sentiment_dispersion < 0.3 ? 'Medium (Mixed)' : 'Low (Divided Opinions)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-zinc-500 block mb-0.5">Coverage Volume</span>
                    <span className="text-sm font-bold text-zinc-200">
                      {newsSentiment.snapshot.coverage_volume_recent} recent articles (Last 48h)
                    </span>
                  </div>
                </div>

                {/* Top Articles Peek */}
                <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl flex flex-col justify-between overflow-hidden">
                  <span className="text-[10px] font-bold uppercase text-zinc-500 mb-2 block">Latest Headlines</span>
                  <div className="space-y-2">
                    {newsSentiment.articles?.slice(0, 2).map((art: any, i: number) => (
                      <a key={i} href={art.url} target="_blank" rel="noreferrer" className="block group">
                        <p className="text-[10px] font-semibold text-zinc-300 group-hover:text-blue-400 line-clamp-2 leading-snug transition">
                          {art.headline}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[8px] text-zinc-500">{art.source}</span>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            art.sentiment_score > 0.3 ? 'bg-emerald-500' :
                            art.sentiment_score < -0.3 ? 'bg-rose-500' : 'bg-amber-500'
                          }`}></span>
                        </div>
                      </a>
                    ))}
                  </div>
                  <span className="text-[9px] font-bold text-zinc-500 mt-2 block italic text-right">
                    Analyzed {newsSentiment.snapshot.articles_scored_count} articles
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* CARD 1 — Expandable Issue Overview & Scraped Profile */}
          <div className="border border-white/5 bg-[#0a0f26]/60 rounded-2xl overflow-hidden">
            <button
              onClick={() => setExpandOverview(!expandOverview)}
              className="w-full px-5 py-4 flex items-center justify-between text-zinc-200 hover:text-white hover:bg-white/[0.02] transition"
            >
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold">Card 1 — Issue Overview & Company Profile</span>
              </div>
              {expandOverview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {expandOverview && (
              <div className="px-5 pb-5 pt-2 border-t border-white/[0.03] space-y-5 text-xs">
                {/* Category & Segment Tag in Overview */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                  <div>
                    <p className="text-[9px] font-semibold uppercase text-zinc-500">Market Segment & Cap</p>
                    <p className="font-extrabold text-purple-300 text-sm mt-0.5">{ipo.category_tag || 'Mainboard'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold uppercase text-zinc-500">Listing Board</p>
                    <p className="font-bold text-zinc-200 mt-0.5">{ipo.board_type === 'SME' ? 'BSE SME / NSE Emerge' : 'NSE / BSE Mainboard'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold uppercase text-zinc-500">Price Band (Per Share)</p>
                    <p className="font-bold text-zinc-200 mt-0.5">{ipo.price_band || 'TBA'}</p>
                  </div>
                </div>

                {/* NEW FEATURE: Complete Total Lot Price Card */}
                {(() => {
                  const lotDetails = getLotPriceDetails(ipo.price_band, ipo.lot_size, ipo.min_investment);
                  return (
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-[#12183a] to-emerald-950/30 border border-purple-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/40 text-[9px] font-black text-purple-300 uppercase tracking-wider">
                            Application Size
                          </span>
                          <span className="text-[10px] text-zinc-400 font-semibold">Price Band × Lot Size</span>
                        </div>
                        <h4 className="text-xs font-bold text-zinc-200">Total Lot Price (1 Application Lot)</h4>
                        <p className="text-[11px] text-purple-300 font-medium">
                          Formula: <span className="text-white font-bold">{lotDetails.calculation}</span>
                        </p>
                      </div>

                      <div className="text-left md:text-right bg-white/[0.03] md:bg-transparent p-3 md:p-0 rounded-xl border border-white/5 md:border-0 shrink-0">
                        <p className="text-[9px] uppercase font-bold text-zinc-400">Total Lot Price</p>
                        <p className="text-2xl font-black text-emerald-400 tracking-tight">{lotDetails.formatted}</p>
                        {lotDetails.isRange && (
                          <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">Cut-off Bid: {lotDetails.cutOff}</p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* NEW FEATURE: Subscription Demand & Oversubscription Status */}
                {(() => {
                  const totalSubObj = subscription?.find((s: any) => s.category?.toLowerCase().includes('total'));
                  const totalSubVal = totalSubObj ? parseFloat(String(totalSubObj.times_subscribed)) : null;
                  const isOversubscribed = totalSubVal !== null && totalSubVal >= 1.0;
                  const isStage1 = ipo.current_stage === 1;

                  if (isStage1) {
                    return (
                      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                            <Clock className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">Subscription Status</span>
                            <h4 className="text-xs font-bold text-zinc-200">Bidding Window Not Open Yet</h4>
                            <p className="text-[11px] text-zinc-400">
                              Live subscription order book will be tracked automatically once bidding opens on {ipo.issue_open_date ? new Date(ipo.issue_open_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'announced date'}.
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className={`p-4 rounded-2xl border ${
                      isOversubscribed
                        ? 'bg-gradient-to-r from-emerald-950/40 via-[#0d1c2b] to-purple-950/30 border-emerald-500/30 shadow-lg'
                        : 'bg-gradient-to-r from-amber-950/30 via-[#141424] to-zinc-900/40 border-amber-500/30'
                    }`}>
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border flex items-center gap-1 ${
                              isOversubscribed
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            }`}>
                              {isOversubscribed ? <Flame className="w-3 h-3 text-emerald-400 shrink-0" /> : <Users className="w-3 h-3 text-amber-400 shrink-0" />}
                              <span>{isOversubscribed ? 'Oversubscribed' : 'Subscription Demand'}</span>
                            </span>
                            <span className="text-[10px] text-zinc-400 font-semibold">Bidding Multiples by Investor Category</span>
                          </div>
                          <h4 className="text-xs font-bold text-zinc-200">Cumulative Subscription & Public Response</h4>
                          <p className="text-[11px] text-zinc-400">
                            {isOversubscribed 
                              ? `Issue received strong institutional & retail demand at ${totalSubVal?.toFixed(2)}x total subscription.`
                              : totalSubVal 
                              ? `Current cumulative subscription stands at ${totalSubVal.toFixed(2)}x of total issue shares.`
                              : 'Live bid collection in progress on exchange order book.'}
                          </p>
                        </div>

                        <div className="text-left md:text-right bg-white/[0.03] md:bg-transparent p-3 md:p-0 rounded-xl border border-white/5 md:border-0 shrink-0">
                          <p className="text-[9px] uppercase font-bold text-zinc-400">Total Subscription</p>
                          <p className={`text-2xl font-black tracking-tight ${isOversubscribed ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {totalSubVal !== null ? `${totalSubVal.toFixed(2)}x` : 'In Progress'}
                          </p>
                          <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">
                            {isOversubscribed ? 'Oversubscribed' : totalSubVal ? 'Under-subscribed' : 'Awaiting Bids'}
                          </p>
                        </div>
                      </div>

                      {/* Category Breakdown Badges */}
                      {subscription && subscription.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {subscription.map((s: any, idx: number) => {
                            const val = parseFloat(String(s.times_subscribed));
                            const isOver = !isNaN(val) && val >= 1.0;
                            return (
                              <div key={idx} className="p-2.5 rounded-xl bg-black/30 border border-white/5 flex flex-col justify-between">
                                <span className="text-[10px] font-semibold text-zinc-400">{s.category}</span>
                                <div className="mt-1 flex items-baseline justify-between">
                                  <span className={`text-sm font-black ${isOver ? 'text-emerald-400' : 'text-zinc-200'}`}>
                                    {!isNaN(val) ? `${val.toFixed(2)}x` : 'N/A'}
                                  </span>
                                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded ${
                                    isOver ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-zinc-400'
                                  }`}>
                                    {isOver ? 'Oversubscribed' : 'Normal'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-zinc-400">
                  <div>
                    <p className="text-[9px] font-semibold uppercase text-zinc-500">Total Issue Size</p>
                    <p className="font-bold text-zinc-200 mt-0.5">{ipo.issue_size ? `${ipo.issue_size} Cr` : 'TBA'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold uppercase text-zinc-500">Fresh Issue Amount</p>
                    <p className="font-bold text-zinc-200 mt-0.5">{ipo.fresh_issue_amount ? `${ipo.fresh_issue_amount} Cr` : 'TBA'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold uppercase text-zinc-500">Offer For Sale (OFS)</p>
                    <p className="font-bold text-zinc-200 mt-0.5">{ipo.ofs_amount ? `${ipo.ofs_amount} Cr` : 'TBA'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold uppercase text-zinc-500">Lot Size (Shares)</p>
                    <p className="font-bold text-zinc-200 mt-0.5">{ipo.lot_size || 'TBA'}</p>
                  </div>
                </div>

                {/* About Company / Description (Scraped) */}
                {ipo.description && (
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-zinc-300 font-bold text-xs">
                      <Building2 className="w-3.5 h-3.5 text-purple-400" />
                      <span>About the Business & Operations</span>
                    </div>
                    <p className="text-zinc-400 text-[11px] leading-relaxed">
                      {ipo.description}
                    </p>
                  </div>
                )}

                {/* Objects of the Issue (Scraped) */}
                {ipo.objects_of_issue && (
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-zinc-300 font-bold text-xs">
                      <Target className="w-3.5 h-3.5 text-purple-400" />
                      <span>Objects of the Issue (Capital Deployment)</span>
                    </div>
                    <p className="text-zinc-400 text-[11px] leading-relaxed">
                      {ipo.objects_of_issue}
                    </p>
                  </div>
                )}

                {/* KPIs (Scraped) */}
                {ipo.kpis && Array.isArray(ipo.kpis) && ipo.kpis.length > 0 && (
                  <div>
                    <p className="text-[9px] font-semibold uppercase text-zinc-500 mb-2">Key Performance Indicators (KPIs)</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                      {ipo.kpis.map((k: any, idx: number) => (
                        <div key={idx} className="bg-white/5 border border-white/10 p-2.5 rounded-xl">
                          <p className="text-[9px] text-zinc-400 font-semibold">{k.kpi}</p>
                          <p className="text-xs font-black text-white mt-0.5">{k.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subscription Category Breakdown */}
                {subscription && subscription.length > 0 && (
                  <div className="pt-2">
                    <p className="text-[9px] font-semibold uppercase text-zinc-500 mb-2">Live Subscription Multiples</p>
                    <div className="flex flex-wrap gap-3">
                      {subscription.map((s: any) => (
                        <div key={s.category} className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2">
                          <span className="text-zinc-400 text-[10px] font-semibold">{s.category}:</span>
                          <span className="text-white font-extrabold">{s.times_subscribed}x</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CARD 2 — Restated Financials (Scraped) */}
          {ipo.financials && Array.isArray(ipo.financials) && ipo.financials.length > 0 && (
            <div className="border border-white/5 bg-[#0a0f26]/60 rounded-2xl overflow-hidden">
              <button
                onClick={() => setExpandFinancials(!expandFinancials)}
                className="w-full px-5 py-4 flex items-center justify-between text-zinc-200 hover:text-white hover:bg-white/[0.02] transition"
              >
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold">Company Restated Financials (₹ in Crores)</span>
                </div>
                {expandFinancials ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {expandFinancials && (
                <div className="px-5 pb-5 pt-2 border-t border-white/[0.03] overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/5 text-[9px] uppercase text-zinc-500">
                        <th className="py-2.5 pr-4 font-semibold">Financial Metric</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Latest Period</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Previous Year</th>
                        <th className="py-2.5 pl-3 font-semibold text-right">Prior Year</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.02]">
                      {ipo.financials.map((f: any, idx: number) => (
                        <tr key={idx} className="hover:bg-white/[0.01]">
                          <td className="py-2 pr-4 font-semibold text-zinc-300">{f.metric}</td>
                          {f.values.map((v: string, vIdx: number) => (
                            <td key={vIdx} className="py-2 px-3 text-right font-medium text-zinc-400">{v || '-'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* CARD 3 — Promoters & Backers */}
          <div className="border border-white/5 bg-[#0a0f26]/60 rounded-2xl overflow-hidden">
            <button
              onClick={() => setExpandPromoters(!expandPromoters)}
              className="w-full px-5 py-4 flex items-center justify-between text-zinc-200 hover:text-white hover:bg-white/[0.02] transition"
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold">Promoters & Institutional Backers</span>
              </div>
              {expandPromoters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {expandPromoters && (
              <div className="px-5 pb-5 pt-2 border-t border-white/[0.03] space-y-4">
                {/* Promoters List */}
                <div>
                  <h4 className="text-[9px] font-semibold uppercase text-zinc-500 mb-2">Company Promoters</h4>
                  {promoters.length > 0 ? (
                    <p className="text-xs text-zinc-200 font-semibold leading-relaxed">
                      {promoters.join(', ')}
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-500 italic">No promoters registered.</p>
                  )}
                </div>

                {/* Anchor Investors */}
                {anchors.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/[0.03]">
                    <h4 className="text-[9px] font-semibold uppercase text-zinc-500 mb-2">Key Anchor Investor Allocations</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {anchors.map((anc: any) => (
                        <div key={anc.investor_name} className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 text-xs">
                          <span className="font-semibold text-zinc-300 truncate max-w-[200px]">{anc.investor_name}</span>
                          <span className="font-bold text-purple-400">{anc.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CARD 4 — RHP 23-Factor Scoring Breakdown */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  23-Factor RHP Scoring Breakdown
                </h3>
              </div>
              <span className="text-[10px] font-semibold text-zinc-500">
                {factorScores.length > 0 ? `${factorScores.length} Factors Evaluated` : 'Pending Evaluation'}
              </span>
            </div>

            {factorScores.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 text-center flex flex-col items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-zinc-500" />
                <div>
                  <p className="text-xs font-bold text-zinc-300">RHP Analysis Not Yet Run</p>
                  <p className="text-[11px] text-zinc-500 mt-1 max-w-md">
                    Click <strong>"Evaluate with AI"</strong> above to analyze the 23 quantitative & qualitative factors against the prospectus.
                  </p>
                </div>
                <button
                  onClick={handleRecalculate}
                  disabled={evaluating}
                  className="mt-2 px-5 py-2.5 rounded-xl bg-purple-600 border border-purple-500 text-xs font-bold text-white hover:bg-purple-500 transition shadow-lg shadow-purple-600/25 flex items-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {evaluating ? 'Analyzing RHP...' : 'Run 23-Factor Evaluation'}
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {categories.map(cat => {
                  const catFactors = factorScores.filter((f: any) => f.category === cat.key);
                  if (catFactors.length === 0) return null;

                  const avgScore = (
                    catFactors.reduce((acc: number, f: any) => acc + parseFloat(f.score), 0) / catFactors.length
                  ).toFixed(1);

                  return (
                    <div key={cat.key} className="rounded-2xl border border-white/5 bg-[#0a0f26]/60 p-4 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-white">{cat.name}</span>
                          <span className="text-[9px] font-bold text-zinc-500 uppercase bg-white/5 px-2 py-0.5 rounded">
                            Weight: {cat.weight}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-semibold text-zinc-500">Category Avg:</span>
                          <span className={`text-xs font-black px-2 py-0.5 rounded border ${getScoreColor(parseFloat(avgScore))}`}>
                            {avgScore} / 10
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        {catFactors.map((f: any) => (
                          <div key={f.factor_key} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-between gap-2">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[11px] font-bold text-zinc-200 capitalize">
                                {f.factor_key.replace(/_/g, ' ')}
                              </span>
                              <span className={`text-xs font-black px-2 py-0.5 rounded border shrink-0 ${getScoreColor(parseFloat(f.score))}`}>
                                {parseFloat(f.score).toFixed(1)}
                              </span>
                            </div>
                            {f.evidence_text && (
                              <p className="text-[10px] text-zinc-400 leading-normal line-clamp-3">
                                {f.evidence_text}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* CARD 5 — OVERALL SCORE & EXECUTIVE VERDICT SUMMARY (AT END) */}
                <div className="mt-8 rounded-3xl border border-purple-500/20 bg-gradient-to-b from-[#101438] to-[#0a0e28] p-6 shadow-2xl space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/5">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span className="text-[10px] font-black tracking-wider uppercase text-purple-400">
                          Final Investment Verdict
                        </span>
                      </div>
                      <h4 className="text-xl font-black text-white">
                        {ipo.company_name} — Overall Evaluation Summary
                      </h4>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Synthesized from 23 qualitative & quantitative RHP underwriting metrics.
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-[9px] uppercase font-bold text-zinc-500">Overall Score</p>
                        <p className="text-3xl font-black text-white">{ipo.rhp_score ?? 'N/A'}<span className="text-xs font-semibold text-zinc-500">/100</span></p>
                      </div>
                      <div className={`px-4 py-2 rounded-2xl border flex flex-col items-center justify-center font-black ${
                        (ipo.rhp_score ?? 0) >= 80 ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' :
                        (ipo.rhp_score ?? 0) >= 65 ? 'bg-green-500/15 border-green-500/30 text-green-400' :
                        (ipo.rhp_score ?? 0) >= 50 ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' :
                        'bg-rose-500/15 border-rose-500/30 text-rose-400'
                      }`}>
                        <span className="text-xs uppercase tracking-wider">{getScoreBand(ipo.rhp_score)}</span>
                        <span className="text-[8px] font-semibold opacity-75">Recommendation</span>
                      </div>
                    </div>
                  </div>

                  {/* 5-Category Weight & Score Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {categories.map(cat => {
                      const catFactors = factorScores.filter((f: any) => f.category === cat.key);
                      const avg = catFactors.length > 0
                        ? (catFactors.reduce((acc: number, f: any) => acc + parseFloat(f.score), 0) / catFactors.length).toFixed(1)
                        : '5.0';
                      const numAvg = parseFloat(avg);

                      return (
                        <div key={cat.key} className="bg-white/[0.02] border border-white/5 p-3.5 rounded-2xl flex flex-col justify-between">
                          <div>
                            <span className="text-[9px] font-bold text-zinc-500 uppercase">{cat.weight} Weight</span>
                            <h5 className="text-[11px] font-extrabold text-zinc-200 mt-1 leading-tight line-clamp-1">{cat.name}</h5>
                          </div>
                          <div className="mt-3 flex items-baseline justify-between">
                            <span className="text-base font-black text-white">{avg}<span className="text-[10px] text-zinc-500 font-normal">/10</span></span>
                            <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${getScoreColor(numAvg)}`}>
                              {numAvg >= 7.5 ? 'Strong' : numAvg >= 6.0 ? 'Moderate' : 'Neutral'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Key Green Flags vs Red Flags */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {/* Green Flags */}
                    <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 space-y-2">
                      <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                        <CheckCircle className="w-4 h-4" />
                        <span>Key Positive Catalysts (Green Flags)</span>
                      </div>
                      <ul className="space-y-1.5 text-[11px] text-zinc-300">
                        {factorScores
                          .filter((f: any) => parseFloat(f.score) >= 7.5)
                          .slice(0, 4)
                          .map((f: any) => (
                            <li key={f.factor_key} className="flex items-start gap-1.5 leading-relaxed">
                              <span className="text-emerald-400 font-bold">✓</span>
                              <span><strong>{f.factor_key.replace(/_/g, ' ')}:</strong> {f.evidence_text}</span>
                            </li>
                          ))}
                        {factorScores.filter((f: any) => parseFloat(f.score) >= 7.5).length === 0 && (
                          <li className="text-zinc-500 italic">No standout positive outliers detected.</li>
                        )}
                      </ul>
                    </div>

                    {/* Red Flags / Watchpoints */}
                    <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/20 space-y-2">
                      <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Key Watchpoints & Risk Factors</span>
                      </div>
                      <ul className="space-y-1.5 text-[11px] text-zinc-300">
                        {factorScores
                          .filter((f: any) => parseFloat(f.score) < 7.5)
                          .slice(0, 4)
                          .map((f: any) => (
                            <li key={f.factor_key} className="flex items-start gap-1.5 leading-relaxed">
                              <span className="text-amber-400 font-bold">!</span>
                              <span>
                                <strong>{f.factor_key.replace(/_/g, ' ')}:</strong> {f.evidence_text}
                                {f.evidence_text?.toLowerCase().includes('not') || f.evidence_text?.toLowerCase().includes('awaiting') || f.evidence_text?.toLowerCase().includes('undefined') ? (
                                  <span className="ml-1 text-[10px] text-amber-300/80 italic font-semibold">(Data wasn&apos;t available in public filings / pending disclosure)</span>
                                ) : null}
                              </span>
                            </li>
                          ))}
                        {factorScores.filter((f: any) => parseFloat(f.score) < 7.5).length === 0 && (
                          <li className="text-zinc-500 italic">No significant governance or financial red flags detected.</li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* 4. Pending / Unavailable Data Disclosures Notice */}
                  {factorScores.some((f: any) => 
                    f.evidence_text?.toLowerCase().includes('not') || 
                    f.evidence_text?.toLowerCase().includes('awaiting') || 
                    f.evidence_text?.toLowerCase().includes('pending') ||
                    f.evidence_text?.toLowerCase().includes('undefined') ||
                    f.confidence < 0.8
                  ) && (
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-amber-500/20 space-y-2">
                      <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Flagged in Key Watchpoints: Pending &amp; Unavailable Data Disclosures</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        Any factors that have pending, unannounced, or incomplete data in public SEBI/BSE filings are automatically flagged below so you know exactly what information to verify before placing your bids:
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {factorScores
                          .filter((f: any) => 
                            f.evidence_text?.toLowerCase().includes('not') || 
                            f.evidence_text?.toLowerCase().includes('awaiting') || 
                            f.evidence_text?.toLowerCase().includes('pending') ||
                            f.evidence_text?.toLowerCase().includes('undefined') ||
                            f.confidence < 0.8
                          )
                          .map((f: any) => (
                            <span key={f.factor_key} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-semibold">
                              <span>⚠️ {f.factor_key.replace(/_/g, ' ')}:</span>
                              <span className="text-zinc-300">{f.evidence_text} (Data wasn&apos;t available)</span>
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
