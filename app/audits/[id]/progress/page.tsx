'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, CheckCircle2, Loader2, ArrowRight, Terminal, RefreshCw } from 'lucide-react';

interface AuditProgressData {
  id: string;
  status: string;
  progressPercentage: number;
  totalPages: number;
  processedPages: number;
  logs: { id: string; level: string; message: string; timestamp: string }[];
}

export default function AuditProgressPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [data, setData] = useState<AuditProgressData | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const fetchProgress = async () => {
      try {
        const res = await fetch(`/api/audits/${params.id}/progress`);
        if (res.ok) {
          const json = await res.json();
          setData(json);

          if (json.status === 'completed') {
            clearInterval(interval);
            setTimeout(() => {
              router.push(`/audits/${params.id}`);
            }, 1200);
          }
        }
      } catch (err) {
        console.error('Failed to fetch audit progress:', err);
      }
    };

    fetchProgress();
    interval = setInterval(fetchProgress, 2000);

    return () => clearInterval(interval);
  }, [params.id, router]);

  if (!data) {
    return (
      <div className="py-20 text-center space-y-4">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin mx-auto" />
        <p className="text-sm text-slate-400">Connecting to live audit worker process...</p>
      </div>
    );
  }

  const isCompleted = data.status === 'completed';
  const isFailed = data.status === 'failed';

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-slate-400">
          <RefreshCw className={`w-3.5 h-3.5 ${!isCompleted ? 'animate-spin text-brand-400' : ''}`} />
          Status: <span className="uppercase font-bold text-white">{data.status}</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white">Live Audit Execution</h1>
        <p className="text-sm text-slate-400">
          Browsers rendering pages, running accessibility trees, measuring Web Vitals, and synthesizing AI recommendations.
        </p>
      </div>

      {/* Progress Card */}
      <div className="glass-panel p-8 rounded-2xl border border-slate-800 space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-slate-300">Overall Crawl & Audit Completion</span>
            <span className="text-cyan-400 font-mono text-sm">{data.progressPercentage}%</span>
          </div>
          <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-brand-600 via-cyan-400 to-emerald-400 transition-all duration-500 rounded-full"
              style={{ width: `${data.progressPercentage}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 font-mono">
            <span>Processed: {data.processedPages} pages</span>
            <span>Total Queued: {data.totalPages} pages</span>
          </div>
        </div>

        {/* Completion State Banner */}
        {isCompleted && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Audit Execution Complete! Redirecting to report...</span>
            </div>
            <button
              onClick={() => router.push(`/audits/${params.id}`)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1"
            >
              View Report <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {isFailed && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <span>Audit execution encountered an error. Check logs below.</span>
          </div>
        )}

        {/* Live Terminal Log Stream */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-brand-400" /> Real-time Execution Logs
            </span>
            <span className="font-mono text-[11px] text-slate-500">{data.logs?.length || 0} events</span>
          </div>
          <div className="h-64 rounded-xl bg-slate-950 p-4 font-mono text-xs overflow-y-auto space-y-2 border border-slate-900">
            {data.logs?.length === 0 ? (
              <div className="text-slate-600 italic">Waiting for initial log stream...</div>
            ) : (
              data.logs?.map((log) => (
                <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-slate-600 shrink-0 text-[10px]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold shrink-0 ${
                      log.level === 'success'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : log.level === 'warn'
                        ? 'bg-amber-500/20 text-amber-400'
                        : log.level === 'error'
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-brand-500/20 text-brand-400'
                    }`}
                  >
                    {log.level}
                  </span>
                  <span className="text-slate-300">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
