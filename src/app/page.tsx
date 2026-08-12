'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, LogOut, Sparkles, RefreshCw, LayoutDashboard, Database, Activity, Filter
} from 'lucide-react';
import KanbanBoard, { IPOItem } from '@/components/KanbanBoard';
import NewsSidebar, { NewsArticle } from '@/components/NewsSidebar';
import IPODetailModal from '@/components/IPODetailModal';

export default function ProtectedDashboard() {
  const [ipos, setIpos] = useState<IPOItem[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedIPO, setSelectedIPO] = useState<IPOItem | null>(null);
  const [loggingOut, setLoggingOut] = useState<boolean>(false);

  const router = useRouter();

  const fetchData = async () => {
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
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col selection:bg-purple-600 selection:text-white">
      
      {/* Top Header */}
      <header className="border-b border-purple-500/10 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
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

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-purple-400' : ''}`} />
            </button>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Password Authenticated</span>
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
      </header>

      {/* Main Grid Content */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-400">Loading 12-Stage Kanban Dashboard & Supabase Data...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Left 3 Columns: 12-Stage Kanban Dashboard */}
            <div className="lg:col-span-3 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-black text-white flex items-center gap-2">
                    <LayoutDashboard className="w-6 h-6 text-purple-400" />
                    IPO Lifecycle Kanban Board
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Tracking {ipos.length} companies across 12 regulatory & market lifecycle stages
                  </p>
                </div>
              </div>

              {/* Kanban Component */}
              <KanbanBoard ipos={ipos} onSelectIPO={(ipo) => setSelectedIPO(ipo)} />
            </div>

            {/* Right 1 Column: Live News Feed Sidebar */}
            <div className="lg:col-span-1">
              <NewsSidebar articles={news} />
            </div>

          </div>
        )}

      </main>

      {/* Modal Popup */}
      {selectedIPO && (
        <IPODetailModal ipo={selectedIPO} onClose={() => setSelectedIPO(null)} />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        PurpleIPO Personal Edition • Gated Environment • Vercel & Supabase PostgreSQL
      </footer>

    </div>
  );
}
