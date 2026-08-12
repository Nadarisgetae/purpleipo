'use client';

import React from 'react';
import { Newspaper, ExternalLink, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

export interface NewsArticle {
  id: string;
  headline: string;
  url: string;
  source: string;
  published_at: string;
  sentiment_score: number | null;
  topic_tag: string | null;
  company_name?: string;
}

interface NewsSidebarProps {
  articles: NewsArticle[];
}

export default function NewsSidebar({ articles }: NewsSidebarProps) {
  return (
    <div className="glass-panel p-5 rounded-2xl border border-purple-500/15 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Newspaper className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">Live News Feed</h3>
            <p className="text-[10px] text-slate-400">RSS & Financial Media</p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
          Live
        </span>
      </div>

      {/* Articles List */}
      <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
        {articles.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">No news articles fetched yet.</p>
        ) : (
          articles.map((item) => {
            const sentiment = item.sentiment_score ?? 0.5;
            const isPositive = sentiment >= 0.6;
            const isNegative = sentiment <= 0.4;

            return (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="group block p-3.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-purple-500/30 transition-all space-y-2"
              >
                {/* Source & Sentiment Tag */}
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-medium text-slate-400">{item.source || 'Financial Feed'}</span>

                  {isPositive && (
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      <TrendingUp className="w-3 h-3" /> Positive
                    </span>
                  )}
                  {isNegative && (
                    <span className="inline-flex items-center gap-1 text-red-400 font-semibold bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                      <TrendingDown className="w-3 h-3" /> Negative
                    </span>
                  )}
                  {!isPositive && !isNegative && (
                    <span className="inline-flex items-center gap-1 text-slate-400 font-semibold bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                      <Minus className="w-3 h-3" /> Neutral
                    </span>
                  )}
                </div>

                {/* Headline */}
                <h4 className="text-xs font-semibold text-slate-200 group-hover:text-purple-300 transition-colors leading-snug line-clamp-2">
                  {item.headline}
                </h4>

                {/* Footer: Company link & timestamp */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                  <span>{item.company_name || 'General IPO Market'}</span>
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 text-purple-400 transition-opacity" />
                </div>
              </a>
            );
          })
        )}
      </div>
    </div>
  );
}
