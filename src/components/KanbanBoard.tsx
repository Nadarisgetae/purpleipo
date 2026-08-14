'use client';

import React, { useState } from 'react';
import { 
  Building2, TrendingUp, Calendar, ChevronRight, Filter, Search, Sparkles, 
  ArrowUpRight, AlertTriangle, ShieldCheck, Tag, Clock, CheckCircle2
} from 'lucide-react';
import { getBiddingStatus } from '@/lib/bidding-status';

export interface IPOItem {
  id: string;
  company_name: string;
  sector: string;
  type: string | null;
  cin: string;
  current_stage: number;
  issue_size: string;
  price_band: string;
  fresh_issue_amount: string;
  ofs_amount: string;
  lot_size: string | null;
  minimum_investment: string | null;
  subscription_rate: string | null;
  oversubscription: string | null;
  issue_open_date: string | null;
  issue_close_date: string | null;
  listing_date: string | null;
  rhp_score: number | null;
  independent_score: number | null;
  news_score: number | null;
  composite_score: number | null;
  promoters?: string | null;
  qib_details?: string | null;
  anchor_investors?: string | null;
  rating_score?: number | null;
  gmp?: number | null;
}

const LIFECYCLE_STAGES = [
  { id: 1, name: 'Merchant Bankers', short: 'Bankers', color: 'border-slate-700 bg-slate-900/40' },
  { id: 2, name: 'Due Diligence', short: 'Diligence', color: 'border-slate-700 bg-slate-900/40' },
  { id: 3, name: 'File DRHP', short: 'DRHP Filed', color: 'border-purple-900/40 bg-purple-950/20' },
  { id: 4, name: 'SEBI Approvals', short: 'SEBI Clearance', color: 'border-purple-900/40 bg-purple-950/20' },
  { id: 5, name: 'Final RHP Filed', short: 'RHP Ready', color: 'border-indigo-900/50 bg-indigo-950/30' },
  { id: 6, name: 'Roadshows', short: 'Marketing', color: 'border-indigo-900/50 bg-indigo-950/30' },
  { id: 7, name: 'Anchor Book', short: 'Anchor Open', color: 'border-amber-900/50 bg-amber-950/20' },
  { id: 8, name: 'Public Bidding', short: 'Bidding Open', color: 'border-emerald-700/60 bg-emerald-950/30 ring-1 ring-emerald-500/20' },
  { id: 9, name: 'Price Discovery', short: 'Priced', color: 'border-blue-900/50 bg-blue-950/20' },
  { id: 10, name: 'Allotment', short: 'Allotment', color: 'border-cyan-900/50 bg-cyan-950/20' },
  { id: 11, name: 'Demat Credit', short: 'Demat', color: 'border-teal-900/50 bg-teal-950/20' },
  { id: 12, name: 'Listed on Exchange', short: 'Listed', color: 'border-slate-800 bg-slate-900/60' },
];

function getScoreBadge(score: number | null) {
  if (score === null || score === undefined) {
    return { label: 'Unscored', bg: 'bg-slate-800 text-slate-400 border-slate-700' };
  }
  if (score >= 80) return { label: `${score.toFixed(1)} • Strong Buy`, bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
  if (score >= 65) return { label: `${score.toFixed(1)} • Buy`, bg: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' };
  if (score >= 50) return { label: `${score.toFixed(1)} • Neutral`, bg: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
  if (score >= 35) return { label: `${score.toFixed(1)} • Caution`, bg: 'bg-orange-500/15 text-orange-300 border-orange-500/30' };
  return { label: `${score.toFixed(1)} • Avoid`, bg: 'bg-red-500/15 text-red-300 border-red-500/30' };
}

interface KanbanBoardProps {
  ipos: IPOItem[];
  onSelectIPO: (ipo: IPOItem) => void;
}

export default function KanbanBoard({ ipos, onSelectIPO }: KanbanBoardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'open' | 'upcoming' | 'closed' | 'rhp' | 'listed'>('all');

  const filteredIPOs = ipos.filter((ipo) => {
    const matchesSearch =
      ipo.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ipo.sector && ipo.sector.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    const statusState = getBiddingStatus(ipo.issue_open_date, ipo.issue_close_date, ipo.current_stage).state;

    if (selectedFilter === 'open') return statusState === 'OPEN';
    if (selectedFilter === 'upcoming') return statusState === 'UPCOMING';
    if (selectedFilter === 'closed') return statusState === 'CLOSED';
    if (selectedFilter === 'rhp') return ipo.current_stage >= 5 && ipo.current_stage <= 9;
    if (selectedFilter === 'listed') return ipo.current_stage === 12;
    return true;
  });

  const openCount = ipos.filter((i) => getBiddingStatus(i.issue_open_date, i.issue_close_date, i.current_stage).state === 'OPEN').length;
  const upcomingCount = ipos.filter((i) => getBiddingStatus(i.issue_open_date, i.issue_close_date, i.current_stage).state === 'UPCOMING').length;
  const closedCount = ipos.filter((i) => getBiddingStatus(i.issue_open_date, i.issue_close_date, i.current_stage).state === 'CLOSED').length;

  return (
    <div className="space-y-6">
      
      {/* Control Bar: Search & Quick Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl glass-panel border border-purple-500/15">
        
        {/* Search Box */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search company or sector (e.g. Swiggy, Energy, BFSI)..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/60 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/40"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs flex-wrap">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-3 py-1.5 rounded-lg border font-medium transition-all cursor-pointer ${
              selectedFilter === 'all'
                ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                : 'bg-slate-900/60 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            All IPOs ({ipos.length})
          </button>
          <button
            onClick={() => setSelectedFilter('open')}
            className={`px-3 py-1.5 rounded-lg border font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedFilter === 'open'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30'
                : 'bg-slate-900/60 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Open Bidding ({openCount})</span>
          </button>
          <button
            onClick={() => setSelectedFilter('upcoming')}
            className={`px-3 py-1.5 rounded-lg border font-semibold transition-all cursor-pointer ${
              selectedFilter === 'upcoming'
                ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/30'
                : 'bg-slate-900/60 text-amber-400 border-amber-500/30 hover:bg-amber-500/10'
            }`}
          >
            Starts Soon ({upcomingCount})
          </button>
          <button
            onClick={() => setSelectedFilter('closed')}
            className={`px-3 py-1.5 rounded-lg border font-semibold transition-all cursor-pointer ${
              selectedFilter === 'closed'
                ? 'bg-rose-900/80 text-rose-200 border-rose-600'
                : 'bg-slate-900/60 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            Closed ({closedCount})
          </button>
          <button
            onClick={() => setSelectedFilter('rhp')}
            className={`px-3 py-1.5 rounded-lg border font-medium transition-all cursor-pointer ${
              selectedFilter === 'rhp'
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                : 'bg-slate-900/60 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            RHP Active ({ipos.filter((i) => i.current_stage >= 5 && i.current_stage <= 9).length})
          </button>
        </div>

      </div>

      {/* 12-Stage Horizontal Kanban Grid */}
      <div className="flex gap-4 overflow-x-auto pb-6 custom-scrollbar min-h-[580px]">
        {LIFECYCLE_STAGES.map((stage) => {
          const stageIPOs = filteredIPOs.filter((ipo) => ipo.current_stage === stage.id);

          return (
            <div
              key={stage.id}
              className={`w-72 shrink-0 rounded-2xl p-3.5 flex flex-col border transition-all ${stage.color}`}
            >
              {/* Stage Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold flex items-center justify-center border border-purple-500/30">
                    {stage.id}
                  </span>
                  <h3 className="font-semibold text-xs text-white tracking-wide">{stage.name}</h3>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400">
                  {stageIPOs.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {stageIPOs.length === 0 ? (
                  <div className="h-32 border border-dashed border-slate-800/80 rounded-xl flex items-center justify-center text-center p-3">
                    <span className="text-[11px] text-slate-600 font-medium">No IPOs at this stage</span>
                  </div>
                ) : (
                  stageIPOs.map((ipo) => {
                    const badge = getScoreBadge(ipo.composite_score);
                    const statusInfo = getBiddingStatus(ipo.issue_open_date, ipo.issue_close_date, ipo.current_stage);

                    return (
                      <div
                        key={ipo.id}
                        onClick={() => onSelectIPO(ipo)}
                        className="group p-4 rounded-xl glass-panel hover:bg-slate-800/80 border border-slate-700/50 hover:border-purple-500/40 transition-all cursor-pointer shadow-lg space-y-3 relative overflow-hidden"
                      >
                        {/* Stage 8 Highlight Pulse */}
                        {stage.id === 8 && (
                          <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping m-2" />
                        )}

                        {/* Top: Name & Sector */}
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-bold text-sm text-white group-hover:text-purple-300 transition-colors line-clamp-1">
                              {ipo.company_name}
                            </h4>
                            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-400 transition-colors shrink-0" />
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {ipo.type && (
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                ipo.type.toLowerCase().includes('sme')
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              }`}>
                                {ipo.type.toUpperCase()}
                              </span>
                            )}
                            <p className="text-[11px] text-slate-400 line-clamp-1">{ipo.sector}</p>
                          </div>
                        </div>

                        {/* Middle Details: Issue Size & Price */}
                        <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                          <div>
                            <span className="text-slate-500 block text-[10px]">Issue Size</span>
                            <span className="font-semibold text-slate-200">{ipo.issue_size || 'TBD'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">Price Band</span>
                            <span className="font-semibold text-slate-200">{ipo.price_band || 'TBD'}</span>
                          </div>
                        </div>

                        {/* Extra Details: GMP & Rating */}
                        {(ipo.gmp != null || ipo.rating_score != null) && (
                          <div className="flex items-center gap-3 text-[11px] px-1">
                            {ipo.gmp != null && (
                              <div className="flex items-center gap-1 text-emerald-400">
                                <TrendingUp className="w-3 h-3" />
                                <span className="font-semibold">₹{ipo.gmp} GMP</span>
                              </div>
                            )}
                            {ipo.rating_score != null && (
                              <div className="flex items-center gap-1 text-amber-400">
                                <Sparkles className="w-3 h-3" />
                                <span className="font-semibold">{ipo.rating_score} / 10</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Bottom: Status & Score Badge */}
                        <div className="pt-1 flex items-center justify-between gap-1 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${statusInfo.badgeBg} ${statusInfo.badgeText} ${statusInfo.badgeBorder}`}>
                            {statusInfo.shortLabel}
                          </span>
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${badge.bg}`}>
                            {badge.label}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
