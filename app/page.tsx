import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Plus, ArrowRight, ShieldCheck, FileText, CheckCircle2, AlertTriangle, Play } from 'lucide-react';

export const revalidate = 0; // Dynamic server rendering

export default async function DashboardPage() {
  const audits = await prisma.audit.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  const totalAudits = await prisma.audit.count();
  const totalPages = await prisma.audit.aggregate({
    _sum: { processedPages: true }
  });
  const avgScore = await prisma.audit.aggregate({
    _avg: { overallScore: true }
  });
  const criticalCount = await prisma.auditIssue.count({
    where: { severity: 'critical' }
  });

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl glass-panel p-8 md:p-10 border border-slate-800">
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5" /> Multidisciplinary AI Audit Engine Active
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Automated Enterprise UI/UX & WCAG Website Audits
          </h1>
          <p className="text-slate-400 text-base leading-relaxed">
            Run deep automated audits on single pages or complete websites. Analyze visual hierarchy, user flows, WCAG accessibility, performance, SEO, and conversion optimization with AI-powered screenshot callouts.
          </p>
          <div className="pt-2 flex items-center gap-4">
            <Link
              href="/audits/new"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold shadow-lg shadow-brand-500/25 transition-all hover:scale-[1.02]"
            >
              <Plus className="w-5 h-5" /> Start New Audit
            </Link>
            <Link
              href="/audits/history"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-medium transition-all"
            >
              View Audit History
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="glass-card p-6 rounded-2xl border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Audits Run</span>
            <FileText className="w-4 h-4 text-brand-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">{totalAudits}</div>
          <p className="text-xs text-slate-500 mt-1">Across all workspaces</p>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pages Analyzed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">{totalPages._sum.processedPages || 0}</div>
          <p className="text-xs text-slate-500 mt-1">DOMs & viewports captured</p>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Health Score</span>
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-extrabold text-cyan-400">
            {Math.round(avgScore._avg.overallScore || 0)}
            <span className="text-sm font-normal text-slate-500">/100</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Weighted site averages</p>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Critical Issues</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-3xl font-extrabold text-rose-400">{criticalCount}</div>
          <p className="text-xs text-slate-500 mt-1">High business impact</p>
        </div>
      </div>

      {/* Recent Audits Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Recent Website Audits</h2>
            <p className="text-xs text-slate-400">View latest execution results and audit reports</p>
          </div>
          <Link
            href="/audits/history"
            className="text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1"
          >
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {audits.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-white">No Audits Completed Yet</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Create your first UI/UX audit by entering website URLs, uploading a CSV/sitemap, or running a site crawler.
              </p>
            </div>
            <Link
              href="/audits/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" /> Create First Audit
            </Link>
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
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {audits.map((audit) => (
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
                        <span className={`w-1.5 h-1.5 rounded-full ${audit.status === 'completed' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
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
                    <td className="px-6 py-4 text-right">
                      {audit.status === 'completed' ? (
                        <Link
                          href={`/audits/${audit.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-600/20 hover:bg-brand-600/30 text-brand-300 text-xs font-medium border border-brand-500/30 transition-all"
                        >
                          View Report <ArrowRight className="w-3 h-3" />
                        </Link>
                      ) : (
                        <Link
                          href={`/audits/${audit.id}/progress`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-medium border border-amber-500/30"
                        >
                          Track Progress <Play className="w-3 h-3" />
                        </Link>
                      )}
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
