'use client';

import React, { useState } from 'react';

interface ClientTriggerButtonProps {
  actionUrl: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

export default function ClientTriggerButton({
  actionUrl,
  label,
  icon,
  description
}: ClientTriggerButtonProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleTrigger = async () => {
    setLoading(true);
    setStatus('idle');
    try {
      const res = await fetch(actionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch (e) {
      setStatus('error');
    } finally {
      setLoading(false);
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  return (
    <div className="relative group">
      <button
        onClick={handleTrigger}
        disabled={loading}
        className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold transition duration-200 border shadow-md disabled:opacity-50 ${
          status === 'success'
            ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400'
            : status === 'error'
            ? 'bg-rose-600/20 border-rose-500/30 text-rose-400'
            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-zinc-200 hover:text-white'
        }`}
      >
        <span className={loading ? 'animate-spin' : ''}>
          {icon}
        </span>
        {loading ? 'Triggering...' : status === 'success' ? 'Triggered!' : status === 'error' ? 'Failed!' : label}
      </button>

      {/* Hover tooltip for instructions */}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 rounded-lg bg-[#0e1227] border border-white/5 p-2.5 text-[10px] leading-normal text-zinc-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100 z-50 shadow-xl">
        <p className="font-bold text-zinc-200 mb-0.5">{label}</p>
        <p>{description}</p>
      </div>
    </div>
  );
}
