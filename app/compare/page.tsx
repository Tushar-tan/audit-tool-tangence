'use client';

import { useEffect, useState } from 'react';
import { GitCompare, ArrowRight, ArrowUpRight, ArrowDownRight, ShieldCheck } from 'lucide-react';

interface AuditOption {
  id: string;
  siteName: string;
  domain: string;
  createdAt: string;
  overallScore: number;
  uiScore: number;
  uxScore: number;
  accessibilityScore: number;
  performanceScore: number;
  seoScore: number;
  croScore: number;
}

export default function AuditComparePage() {
  const [audits, setAudits] = useState<AuditOption[]>([]);
  const [auditAId, setAuditAId] = useState<string>('');
  const [auditBId, setAuditBId] = useState<string>('');

  useEffect(() => {
    fetch('/api/audits')
      .then((res) => res.json())
      .then((data) => {
        const completed = data.filter((d: any) => d.status === 'completed');
        setAudits(completed);
        if (completed.length >= 2) {
          setAuditAId(completed[1].id);
          setAuditBId(completed[0].id);
        } else if (completed.length === 1) {
          setAuditAId(completed[0].id);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  const auditA = audits.find((a) => a.id === auditAId);
  const auditB = audits.find((a) => a.id === auditBId);

  const getDelta = (valB: number, valA: number) => {
    const diff = valB - valA;
    if (diff > 0) {
      return <span className="text-emerald-400 font-bold flex items-center text-xs">+{diff} <ArrowUpRight className="w-3 h-3" /></span>;
    }
    if (diff < 0) {
      return <span className="text-rose-400 font-bold flex items-center text-xs">{diff} <ArrowDownRight className="w-3 h-3" /></span>;
    }
    return <span className="text-slate-500 font-bold text-xs">0</span>;
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2">
          <GitCompare className="w-6 h-6 text-brand-400" /> Side-by-Side Audit Comparison
        </h1>
        <p className="text-sm text-slate-400">
          Compare two audit runs to measure design improvements, score changes, and regression fixes.
        </p>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 glass-panel p-6 rounded-2xl border border-slate-800">
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-300">Select Audit A (Baseline / Before)</label>
          <select
            value={auditAId}
            onChange={(e) => setAuditAId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs focus:outline-none"
          >
            <option value="">-- Choose Baseline Audit --</option>
            {audits.map((a) => (
              <option key={a.id} value={a.id}>
                {a.siteName} ({a.domain}) - Score: {a.overallScore} ({new Date(a.createdAt).toLocaleDateString()})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-300">Select Audit B (Comparison / After)</label>
          <select
            value={auditBId}
            onChange={(e) => setAuditBId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs focus:outline-none"
          >
            <option value="">-- Choose Comparison Audit --</option>
            {audits.map((a) => (
              <option key={a.id} value={a.id}>
                {a.siteName} ({a.domain}) - Score: {a.overallScore} ({new Date(a.createdAt).toLocaleDateString()})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Comparison Score Grid */}
      {auditA && auditB ? (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
          <h2 className="text-base font-bold text-white">Score Differential & Comparison</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3">Audit Metric</th>
                  <th className="px-6 py-3">Audit A ({auditA.siteName})</th>
                  <th className="px-6 py-3">Audit B ({auditB.siteName})</th>
                  <th className="px-6 py-3 text-right">Score Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {[
                  { key: 'overallScore', label: 'Overall Site Health' },
                  { key: 'headerNavScore', label: 'Header & Navigation' },
                  { key: 'visualDesignScore', label: 'Visual Design / UI' },
                  { key: 'responsiveScore', label: 'Responsive Design' },
                  { key: 'contentScore', fallbackKey: 'typographyContentScore', label: 'Content' },
                  { key: 'buttonsCtasScore', label: 'Buttons & CTAs' },
                  { key: 'formsScore', label: 'Forms' },
                  { key: 'linksScore', label: 'Links' },
                  { key: 'imagesMediaScore', label: 'Images & Media' },
                  { key: 'seoOnPageScore', fallbackKey: 'seoUxScore', label: 'SEO – On Page' },
                  { key: 'technicalSeoScore', fallbackKey: 'errorStatesScore', label: 'Technical SEO' },
                  { key: 'securityScore', label: 'Security' }
                ].map((row) => {
                  const valA = (auditA as any)[row.key] ?? (row.fallbackKey ? (auditA as any)[row.fallbackKey] : 0) ?? 0;
                  const valB = (auditB as any)[row.key] ?? (row.fallbackKey ? (auditB as any)[row.fallbackKey] : 0) ?? 0;
                  return (
                    <tr key={row.key} className="hover:bg-slate-900/40">
                      <td className="px-6 py-4 font-sans font-semibold text-white">{row.label}</td>
                      <td className="px-6 py-4">{valA}/100</td>
                      <td className="px-6 py-4">{valB}/100</td>
                      <td className="px-6 py-4 text-right">{getDelta(valB, valA)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center text-slate-500 text-xs italic">
          Select two completed audits above to compare score metrics side-by-side.
        </div>
      )}
    </div>
  );
}
