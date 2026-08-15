import sql from '../lib/db';
import KanbanBoard from '../components/KanbanBoard';
import { Shield, RefreshCw, FileText, Database } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // Query all IPOs and company profiles server-side
  let ipos: any[] = [];
  try {
    ipos = await sql`
      SELECT 
        i.id,
        i.current_stage,
        i.issue_size,
        i.price_band,
        i.lot_size,
        i.min_investment,
        i.board_type,
        i.category_tag,
        i.fresh_issue_amount,
        i.ofs_amount,
        i.issue_open_date,
        i.issue_close_date,
        i.allotment_date,
        i.listing_date,
        i.rhp_score,
        c.name as company_name,
        c.sector as company_sector,
        MAX(CASE WHEN s.category ILIKE '%Total%' THEN s.times_subscribed END) as total_subscription,
        MAX(CASE WHEN s.category ILIKE '%Retail%' THEN s.times_subscribed END) as retail_subscription,
        MAX(CASE WHEN s.category ILIKE '%QIB%' THEN s.times_subscribed END) as qib_subscription,
        MAX(CASE WHEN s.category ILIKE '%HNI%' OR s.category ILIKE '%NII%' THEN s.times_subscribed END) as hni_subscription
      FROM ipos i
      JOIN companies c ON i.company_id = c.id
      LEFT JOIN subscription_data s ON s.ipo_id = i.id
      GROUP BY i.id, c.name, c.sector
      ORDER BY i.issue_open_date DESC NULLS LAST;
    `;
  } catch (err: any) {
    console.error('Failed to query IPOs for dashboard:', err.message);
  }

  return (
    <main className="min-h-screen bg-[#060814] text-[#eceff8] font-sans antialiased selection:bg-purple-600/30">
      {/* Premium Top Navigation Header */}
      <header className="border-b border-white/5 bg-[#090d20]/50 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-600/20 ring-1 ring-white/10">
            <span className="text-xl font-black text-white italic">P</span>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              PurpleIPO
            </h1>
            <p className="text-xs text-zinc-500 font-medium">RHP Scoring & Evaluation</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Status Indicators */}
          <div className="hidden md:flex items-center gap-4 text-xs font-semibold px-4 py-2 rounded-xl bg-white/[0.02] border border-white/5">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <Database className="w-3.5 h-3.5" /> DB Connected
            </span>
            <span className="h-3 w-[1px] bg-white/10" />
            <span className="flex items-center gap-1.5 text-purple-400">
              <Shield className="w-3.5 h-3.5" /> Gated Access
            </span>
          </div>

          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="text-xs font-semibold px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-300 hover:text-white transition duration-200"
            >
              Sign Out
            </button>
          </form>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Banner with Glowing Backdrop */}
        <div className="relative mb-10 overflow-hidden rounded-3xl border border-white/5 bg-[#090e24]/60 p-8 shadow-2xl">
          <div className="absolute -left-20 -top-20 h-60 w-60 rounded-full bg-purple-600/10 blur-3xl" />
          <div className="absolute -right-20 -bottom-20 h-60 w-60 rounded-full bg-indigo-600/10 blur-3xl" />
          
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-400 ring-1 ring-inset ring-purple-500/20 mb-3">
                Live Data Feed
              </span>
              <h2 className="text-2xl font-black tracking-tight text-white mb-2">
                RHP Evaluation Dashboard
              </h2>
              <p className="max-w-xl text-sm text-zinc-400 leading-relaxed">
                Evaluating initial public offerings directly against their Red Herring Prospectus (RHP) using the NVIDIA Llama 3.1 Nemotron model. No mock fallbacks, 100% verified facts.
              </p>
            </div>

            {/* Quick Actions Panel */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <ClientTriggerButton
                actionUrl="/api/sync/chittorgarh"
                label="Sync Listings"
                icon={<RefreshCw className="w-4 h-4" />}
                description="Scrapes Chittorgarh main board list and detail tables."
              />
              <ClientTriggerButton
                actionUrl="/api/sync/pdfs"
                label="Fetch Prospectuses"
                icon={<FileText className="w-4 h-4" />}
                description="Downloads RHP PDFs, uploads to R2, and extracts text segments."
              />
            </div>
          </div>
        </div>

        {/* Dynamic Client Kanban Board */}
        <KanbanBoard initialIpos={ipos} />
      </div>
    </main>
  );
}

import ClientTriggerButton from '../components/ClientTriggerButton';
