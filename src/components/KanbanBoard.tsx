'use client';

import React, { useState } from 'react';
import { Search, Calendar, Landmark, Tag, TrendingUp, AlertTriangle, Layers, Filter } from 'lucide-react';
import IPODetailModal from './IPODetailModal';

interface IPO {
  id: string;
  current_stage: number;
  company_name: string;
  company_sector: string;
  board_type: string | null;
  category_tag: string | null;
  issue_size: string | null;
  price_band: string | null;
  lot_size: string | null;
  min_investment: number | null;
  issue_open_date: string | null;
  issue_close_date: string | null;
  allotment_date: string | null;
  listing_date: string | null;
  rhp_score: number | null;
}

interface KanbanBoardProps {
  initialIpos: IPO[];
}

const STAGES = [
  { id: 1, name: 'Bidding Not Open', color: 'border-sky-500/30 text-sky-400 bg-sky-500/10' },
  { id: 2, name: 'Bidding Window Open', color: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' },
  { id: 3, name: 'Allotment Finalized', color: 'border-amber-500/30 text-amber-400 bg-amber-500/10' },
  { id: 4, name: 'Listing Day Debut', color: 'border-fuchsia-500/30 text-fuchsia-400 bg-fuchsia-500/10' },
];

const CATEGORY_FILTERS = [
  'All',
  'Large Cap',
  'Mid Cap',
  'Small Cap',
  'SME'
];

export default function KanbanBoard({ initialIpos }: KanbanBoardProps) {
  const [ipos] = useState<IPO[]>(initialIpos);
  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [selectedIpoId, setSelectedIpoId] = useState<string | null>(null);

  // Dynamic market cap detection helper
  const getIPOCapCategory = (ipo: IPO): 'Large Cap' | 'Mid Cap' | 'Small Cap' | 'SME' => {
    const isSme = ipo.board_type === 'SME' || ipo.category_tag?.toLowerCase().includes('sme');
    if (isSme) return 'SME';

    const tag = (ipo.category_tag || '').toLowerCase();
    if (tag.includes('large')) return 'Large Cap';
    if (tag.includes('mid')) return 'Mid Cap';
    if (tag.includes('small')) return 'Small Cap';

    const sizeNum = ipo.issue_size ? parseFloat(ipo.issue_size.replace(/,/g, '')) : 0;
    if (sizeNum >= 1500) return 'Large Cap';
    if (sizeNum >= 500) return 'Mid Cap';
    return 'Small Cap';
  };

  // Filter IPOs by search term and market cap category
  const filteredIpos = ipos.filter(ipo => {
    const matchesSearch =
      ipo.company_name.toLowerCase().includes(search.toLowerCase()) ||
      (ipo.company_sector && ipo.company_sector.toLowerCase().includes(search.toLowerCase())) ||
      (ipo.category_tag && ipo.category_tag.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;
    if (selectedFilter === 'All') return true;

    const cap = getIPOCapCategory(ipo);
    return cap === selectedFilter;
  });

  // Calculate live counts for each filter pill
  const filterCounts: Record<string, number> = {
    'All': ipos.length,
    'Large Cap': ipos.filter(i => getIPOCapCategory(i) === 'Large Cap').length,
    'Mid Cap': ipos.filter(i => getIPOCapCategory(i) === 'Mid Cap').length,
    'Small Cap': ipos.filter(i => getIPOCapCategory(i) === 'Small Cap').length,
    'SME': ipos.filter(i => getIPOCapCategory(i) === 'SME').length,
  };

  // Helper for recommendation band color
  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20';
    if (score >= 80) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (score >= 65) return 'text-green-400 bg-green-500/10 border-green-500/20';
    if (score >= 50) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    if (score >= 35) return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  };

  const getRecommendationLabel = (score: number | null) => {
    if (score === null) return 'N/A';
    if (score >= 80) return 'Strong Buy';
    if (score >= 65) return 'Buy';
    if (score >= 50) return 'Neutral';
    if (score >= 35) return 'Caution';
    return 'Avoid';
  };

  // Helper for Market Cap Category Tag Badge
  const getCategoryBadge = (tag: string | null, boardType: string | null, issueSize: string | null) => {
    const cleanTag = tag || (boardType === 'SME' ? 'SME IPO' : 'Mainboard');
    if (cleanTag.toLowerCase().includes('large') || (issueSize && parseFloat(issueSize.replace(/,/g, '')) >= 1500 && boardType !== 'SME')) {
      return {
        label: tag || 'Mainboard - Large Cap',
        style: 'bg-purple-500/15 text-purple-300 border-purple-500/30'
      };
    }
    if (cleanTag.toLowerCase().includes('mid') || (issueSize && parseFloat(issueSize.replace(/,/g, '')) >= 500 && boardType !== 'SME')) {
      return {
        label: tag || 'Mainboard - Mid Cap',
        style: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
      };
    }
    if (cleanTag.toLowerCase().includes('sme') || boardType === 'SME') {
      return {
        label: tag || 'SME IPO',
        style: 'bg-amber-500/15 text-amber-300 border-amber-500/30'
      };
    }
    return {
      label: tag || 'Mainboard - Small Cap',
      style: 'bg-sky-500/15 text-sky-300 border-sky-500/30'
    };
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'TBA';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <div>
      {/* Search and Category Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        {/* Search Input */}
        <div className="relative w-full max-w-md">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-500">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            placeholder="Search IPOs by company, cap or sector..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0a0f26] border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/30 transition duration-200"
          />
        </div>

        {/* Market Cap Filter Pills with Counts */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-zinc-500 flex items-center gap-1.5 mr-1">
            <Filter className="w-3.5 h-3.5" /> Market Cap:
          </span>
          {CATEGORY_FILTERS.map(filter => {
            const isActive = selectedFilter === filter;
            const count = filterCounts[filter] ?? 0;
            return (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition duration-200 border flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/25'
                    : 'bg-[#0a0f26] border-white/5 text-zinc-400 hover:text-zinc-200 hover:border-white/10'
                }`}
              >
                <span>{filter}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${isActive ? 'bg-white/20 text-white' : 'bg-white/5 text-zinc-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {STAGES.map(stage => {
          const stageIpos = filteredIpos.filter(ipo => ipo.current_stage === stage.id);
          
          return (
            <div key={stage.id} className="flex flex-col rounded-3xl bg-[#090d21]/30 border border-white/[0.03] p-4 min-h-[500px]">
              {/* Column Header */}
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border ${stage.color}`}>
                  {stage.name}
                </span>
                <span className="text-xs font-bold text-zinc-500 bg-white/5 px-2.5 py-0.5 rounded-full">
                  {stageIpos.length}
                </span>
              </div>

              {/* Card List */}
              <div className="flex flex-col gap-3 overflow-y-auto max-h-[600px] scrollbar-none">
                {stageIpos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
                    <span className="text-xs font-semibold">No issues in stage</span>
                  </div>
                ) : (
                  stageIpos.map(ipo => {
                    const badge = getCategoryBadge(ipo.category_tag, ipo.board_type, ipo.issue_size);
                    return (
                      <div
                        key={ipo.id}
                        onClick={() => setSelectedIpoId(ipo.id)}
                        className="group relative rounded-2xl border border-white/[0.04] bg-[#0a0f26]/75 p-5 hover:border-white/10 hover:bg-[#0c1333] transition duration-200 cursor-pointer shadow-lg hover:shadow-2xl"
                      >
                        {/* Score Badge floating */}
                        <div className="absolute top-4 right-4 flex items-center gap-2">
                          {ipo.rhp_score !== null ? (
                            <div className={`flex flex-col items-center px-2 py-1 rounded-lg border text-center ${getScoreColor(ipo.rhp_score)}`}>
                              <span className="text-xs font-extrabold">{ipo.rhp_score}</span>
                              <span className="text-[7px] font-semibold uppercase tracking-wider">{getRecommendationLabel(ipo.rhp_score)}</span>
                            </div>
                          ) : (
                            <div className="text-[9px] font-semibold text-zinc-500 bg-white/5 px-2 py-0.5 rounded-md border border-white/5 flex items-center gap-1">
                              <AlertTriangle className="w-2.5 h-2.5 text-zinc-500" /> Unscored
                            </div>
                          )}
                        </div>

                        <div className="pr-14">
                          {/* Market Cap & Sector Tag */}
                          <div className="flex flex-wrap items-center gap-1.5 mb-2">
                            <span className={`inline-block text-[8px] font-black uppercase px-2 py-0.5 rounded-md border ${badge.style}`}>
                              {badge.label}
                            </span>
                            <span className="inline-block text-[8px] font-black uppercase text-zinc-400 bg-white/5 px-2 py-0.5 rounded-md">
                              {ipo.company_sector || 'General'}
                            </span>
                          </div>

                          <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition duration-150 line-clamp-1">
                            {ipo.company_name}
                          </h3>
                        </div>

                        {/* Card Details */}
                        <div className="mt-4 pt-4 border-t border-white/[0.03] grid grid-cols-2 gap-y-3 gap-x-2 text-[10px] text-zinc-400">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                            <span>
                              {stage.id === 1 ? `Opens ${formatDate(ipo.issue_open_date)}` :
                               stage.id === 2 ? `Closes ${formatDate(ipo.issue_close_date)}` :
                               stage.id === 3 ? `Allot ${formatDate(ipo.allotment_date || ipo.issue_close_date)}` :
                               `Listed ${formatDate(ipo.listing_date)}`}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Landmark className="w-3.5 h-3.5 text-zinc-500" />
                            <span>Size: {ipo.issue_size ? `${ipo.issue_size} Cr` : 'TBA'}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-zinc-500" />
                            <span className="truncate">Band: {ipo.price_band || 'TBA'}</span>
                          </div>

                          {/* Total Lot Price (Price Band * Lot Size) */}
                          {(() => {
                            const lotNum = ipo.lot_size ? parseFloat(ipo.lot_size.replace(/[^\d.]/g, '')) : 0;
                            const priceMatches = ipo.price_band ? ipo.price_band.match(/[\d.]+/g) : null;
                            const prices = priceMatches ? priceMatches.map(p => parseFloat(p)).filter(p => !isNaN(p) && p > 0) : [];
                            
                            let lotPriceText = '';
                            if (lotNum > 0 && prices.length > 0) {
                              const maxP = Math.max(...prices);
                              const total = Math.round(maxP * lotNum);
                              lotPriceText = total >= 100000 
                                ? `₹${(total / 100000).toFixed(2)} Lakh`
                                : `₹${total.toLocaleString('en-IN')}`;
                            } else if (ipo.min_investment && ipo.min_investment > 0) {
                              lotPriceText = ipo.min_investment >= 100000
                                ? `₹${(ipo.min_investment / 100000).toFixed(2)} Lakh`
                                : `₹${Math.round(ipo.min_investment).toLocaleString('en-IN')}`;
                            }

                            if (!lotPriceText) return null;

                            return (
                              <div className="flex items-center gap-1.5 text-purple-300 font-bold">
                                <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                                <span>Lot Price: {lotPriceText}</span>
                              </div>
                            );
                          })()}
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

      {/* Dynamic Detailed Modal */}
      {selectedIpoId && (
        <IPODetailModal
          ipoId={selectedIpoId}
          onClose={() => setSelectedIpoId(null)}
        />
      )}
    </div>
  );
}
