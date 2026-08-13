'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck, LogOut, Sparkles, RefreshCw, LayoutDashboard,
  Zap, Radio, CheckCircle2, AlertCircle, Clock, TrendingUp,
} from 'lucide-react';
import KanbanBoard, { IPOItem } from '@/components/KanbanBoard';
import NewsSidebar, { NewsArticle } from '@/components/NewsSidebar';
import IPODetailModal from '@/components/IPODetailModal';

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface SyncResult {
  ipos_synced: number;
  total_articles_saved: number;
  stage_changes: number;
  stage_updates: { company: string; old_stage: number; new_stage: number }[];
  synced_at: string;
}

export default function ProtectedDashboard() {
  const [ipos, setIpos] = useState<IPOItem[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedIPO, setSelectedIPO] = useState<IPOItem | null>(null);
  const [loggingOut, setLoggingOut] = useState<boolean>(false);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState('');
  const [showSyncAlert, setShowSyncAlert] = useState(false);
  const [nextSyncIn, setNextSyncIn] = useState(AUTO_SYNC_INTERVAL_MS / 1000);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      const [iposRes, newsRes] = await Promise.all([
        fetch('/api/ipos'),
        fetch('/api/news'),
      ]);
      const iposData = await iposRes.json();
      const newsData = await newsRes.json();
      if (iposData.success) setIpos(iposData.data);
      if (newsData.success) setNews(newsData.data);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /** Run the full auto-sync: fetch news + detect stage changes */
  const runSync = useCallback(async (isManual = false) => {
    if (syncing) return;
    setSyncing(true);
    setSyncError('');
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setLastSync(data);
        // Refresh Kanban + news after sync
        await fetchData();
        if (isManual || data.stage_changes > 0) {
          setShowSyncAlert(true);
          setTimeout(() => setShowSyncAlert(false), 6000);
        }
      } else {
        setSyncError(data.message || 'Sync failed');
      }
    } catch {
      setSyncError('Network error during sync');
    } finally {
      setSyncing(false);
      setNextSyncIn(AUTO_SYNC_INTERVAL_MS / 1000);
    }
  }, [syncing, fetchData]);

  // On mount: load data, then start auto-sync cycle
  useEffect(() => {
    fetchData();

    // Initial sync after 3s (let page load first)
    const initialSync = setTimeout(() => runSync(), 3000);

    // Auto-sync every 5 minutes
    syncTimerRef.current = setInterval(() => runSync(), AUTO_SYNC_INTERVAL_MS);

    // Countdown timer (updates every second)
    countdownRef.current = setInterval(() => {
      setNextSyncIn(prev => (prev <= 1 ? AUTO_SYNC_INTERVAL_MS / 1000 : prev - 1));
    }, 1000);

    return () => {
      clearTimeout(initialSync);
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);  // eslint-disable-line

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoggingOut(false);
    }
  };

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col selection:bg-purple-600 selection:text-white">

      {/* ── Stage-change alert toast ── */}
      {showSyncAlert && lastSync && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-bounce-in">
          <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border text-sm font-semibold backdrop-blur-md ${
            lastSync.stage_changes > 0
              ? 'bg-purple-950/90 border-purple-500/40 text-purple-200'
              : 'bg-slate-900/90 border-slate-700 text-slate-300'
          }`}>
            {lastSync.stage_changes > 0 ? (
              <>
                <TrendingUp className="w-4 h-4 text-purple-400 shrink-0" />
                <span>
                  🎉 {lastSync.stage_changes} IPO{lastSync.stage_changes > 1 ? 's' : ''} auto-advanced!
                  {lastSync.stage_updates?.[0] && ` ${lastSync.stage_updates[0].company} → Stage ${lastSync.stage_updates[0].new_stage}`}
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Sync complete — {lastSync.total_articles_saved} new articles, no stage changes</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Top Header ── */}
      <header className="border-b border-purple-500/10 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-700 to-indigo-500 flex items-center justify-center shadow-md shadow-purple-600/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-white tracking-tight">PurpleIPO</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/20">
                  Private Edition
                </span>
              </div>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">

            {/* Live Sync Status */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
              <span className={`w-2 h-2 rounded-full shrink-0 ${syncing ? 'bg-purple-400 animate-pulse' : 'bg-emerald-400'}`} />
              {syncing ? (
                <span className="text-purple-300 font-medium">Syncing news...</span>
              ) : (
                <span className="text-slate-400">
                  Next sync <span className="text-white font-semibold">{formatCountdown(nextSyncIn)}</span>
                </span>
              )}
            </div>

            {/* Manual Sync button */}
            <button
              onClick={() => runSync(true)}
              disabled={syncing}
              title="Sync now — fetch live news & auto-update stages"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 border border-purple-500/30 hover:bg-purple-600/30 text-purple-300 hover:text-purple-100 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              {syncing
                ? <Radio className="w-3.5 h-3.5 animate-pulse" />
                : <Zap className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{syncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>

            {/* Data refresh */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all cursor-pointer"
              title="Refresh dashboard data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-purple-400' : ''}`} />
            </button>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Secure</span>
            </div>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700/60 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{loggingOut ? 'Signing out...' : 'Sign Out'}</span>
            </button>
          </div>
        </div>

        {/* Last sync bar */}
        {lastSync && !syncing && (
          <div className="border-t border-slate-900/50 bg-slate-950/40 px-4 sm:px-6 lg:px-8 py-1 flex items-center gap-3 text-[11px] text-slate-500">
            <Clock className="w-3 h-3" />
            <span>
              Last sync: {new Date(lastSync.synced_at).toLocaleTimeString('en-IN')} •
              {' '}{lastSync.total_articles_saved} articles saved •
              {' '}{lastSync.stage_changes > 0
                ? <span className="text-purple-400 font-semibold">{lastSync.stage_changes} stage change{lastSync.stage_changes > 1 ? 's' : ''}</span>
                : 'no stage changes'}
            </span>
            {syncError && (
              <span className="text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {syncError}
              </span>
            )}
          </div>
        )}
      </header>

      {/* ── Main Grid ── */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-400">Loading 12-Stage Kanban Dashboard & Supabase Data...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

            {/* Left 3 Columns: Kanban */}
            <div className="lg:col-span-3 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-black text-white flex items-center gap-2">
                    <LayoutDashboard className="w-6 h-6 text-purple-400" />
                    IPO Lifecycle Kanban Board
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Tracking {ipos.length} companies across 12 regulatory & market lifecycle stages
                    {syncing && <span className="ml-2 text-purple-400 animate-pulse">• Syncing live news...</span>}
                  </p>
                </div>
              </div>

              <KanbanBoard ipos={ipos} onSelectIPO={(ipo) => setSelectedIPO(ipo)} />
            </div>

            {/* Right: Live News Sidebar */}
            <div className="lg:col-span-1">
              <NewsSidebar articles={news} />
            </div>

          </div>
        )}
      </main>

      {/* Modal */}
      {selectedIPO && (
        <IPODetailModal ipo={selectedIPO} onClose={() => setSelectedIPO(null)} />
      )}

      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        PurpleIPO Personal Edition • Auto-syncs every 5 min via Google News RSS • Supabase PostgreSQL
      </footer>
    </div>
  );
}
