'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Trash2, ArrowRight, Play, FileText, Plus } from 'lucide-react';

interface AuditItem {
  id: string;
  siteName: string;
  domain: string;
  inputMethod: string;
  status: string;
  overallScore: number;
  totalPages: number;
  processedPages: number;
  createdAt: string;
}

export default function AuditHistoryPage() {
  const [audits, setAudits] = useState<AuditItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchAudits = () => {
    fetch(`/api/audits?search=${encodeURIComponent(search)}`)
      .then((res) => res.json())
      .then((data) => setAudits(data))
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    fetchAudits();
  }, [search]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this audit run?')) return;
    try {
      await fetch(`/api/audits/${id}`, { method: 'DELETE' });
      setAudits(audits.filter((a) => a.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const filteredAudits = audits.filter((a) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">Audit Execution History</h1>
          <p className="text-sm text-slate-400">Search, review, and manage past website audit runs.</p>
        </div>

        <Link
          href="/audits/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-500/20"
        >
          <Plus className="w-4 h-4" /> New Audit Run
        </Link>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by site name or domain..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-brand-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="crawling">Crawling / Active</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* History Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        {filteredAudits.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs italic">
            No historical audit records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3">Website / Target</th>
                  <th className="px-6 py-3">Input Method</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-center">Score</th>
                  <th className="px-6 py-3 text-center">Pages</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredAudits.map((audit) => (
                  <tr key={audit.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white text-sm">{audit.siteName}</div>
                      <div className="text-slate-500 text-[11px] font-mono">{audit.domain}</div>
                    </td>
                    <td className="px-6 py-4 capitalize font-mono text-slate-400">{audit.inputMethod}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                          audit.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : audit.status === 'failed'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                        }`}
                      >
                        {audit.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-bold">
                      {audit.status === 'completed' ? (
                        <span
                          className={`text-sm px-2.5 py-1 rounded-lg ${
                            audit.overallScore >= 80
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : audit.overallScore >= 60
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {audit.overallScore}
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center font-mono">{audit.processedPages}/{audit.totalPages || '-'}</td>
                    <td className="px-6 py-4 text-slate-400 text-[11px]">
                      {new Date(audit.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {audit.status === 'completed' ? (
                        <Link
                          href={`/audits/${audit.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-600/20 hover:bg-brand-600/30 text-brand-300 text-xs font-medium border border-brand-500/30"
                        >
                          Report <ArrowRight className="w-3 h-3" />
                        </Link>
                      ) : (
                        <Link
                          href={`/audits/${audit.id}/progress`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-medium border border-amber-500/30"
                        >
                          Track <Play className="w-3 h-3" />
                        </Link>
                      )}
                      <button
                        onClick={() => handleDelete(audit.id)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
