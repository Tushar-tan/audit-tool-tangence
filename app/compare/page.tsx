'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  GitCompare,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  PlusCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Filter,
  ArrowRight,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditSummary {
  id: string;
  siteName: string;
  domain: string;
  createdAt: string;
  overallScore: number;
  status: string;
}

interface Issue {
  id: string;
  title: string;
  category: string;
  severity: string;
  pageUrl: string;
  problem: string;
  recommendation: string;
  status: string;
}

interface AuditDetail extends AuditSummary {
  issues: Issue[];
  overallScore: number;
  headerNavScore: number;
  visualDesignScore: number;
  responsiveScore: number;
  contentScore: number;
  buttonsCtasScore: number;
  formsScore: number;
  linksScore: number;
  imagesMediaScore: number;
  seoOnPageScore: number;
  technicalSeoScore: number;
  securityScore: number;
  criticalIssuesCount: number;
  highIssuesCount: number;
  mediumIssuesCount: number;
  lowIssuesCount: number;
}

// ─── Issue comparison result for a single "before" issue ─────────────────────
type IssueCompareStatus = 'fixed' | 'still_present' | 'new';

interface ComparableIssue {
  issue: Issue;
  compareStatus: IssueCompareStatus;
  /** Matching after-issue, present when compareStatus === 'still_present' */
  matchedAfterIssue?: Issue;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-rose-500/20 text-rose-300 border border-rose-500/40',
  high: 'bg-orange-500/20 text-orange-300 border border-orange-500/40',
  medium: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40',
  low: 'bg-sky-500/20 text-sky-300 border border-sky-500/40',
};

const CATEGORY_LABELS: Record<string, string> = {
  'header-navigation': 'Header & Nav',
  'overall-visual-design': 'Visual Design',
  'responsive-design': 'Responsive',
  'typography-content': 'Content',
  'buttons-ctas': 'Buttons & CTAs',
  forms: 'Forms',
  links: 'Links',
  'images-media': 'Images & Media',
  'seo-ux': 'SEO – On Page',
  'error-empty-states': 'Technical SEO',
  security: 'Security',
};

/**
 * Two issues are considered the "same" if they share the same category AND
 * their titles are substantially similar (first 40 chars match, case-insensitive).
 * This is intentionally loose: the same underlying issue may have slightly
 * different wording across two crawl runs.
 */
function issuesMatch(a: Issue, b: Issue): boolean {
  if (a.category !== b.category) return false;
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
  return normalize(a.title) === normalize(b.title);
}

function getScoreDelta(after: number, before: number) {
  const d = after - before;
  if (d > 0)
    return (
      <span className="flex items-center gap-0.5 text-emerald-400 font-bold text-xs">
        <TrendingUp className="w-3 h-3" />+{d}
      </span>
    );
  if (d < 0)
    return (
      <span className="flex items-center gap-0.5 text-rose-400 font-bold text-xs">
        <TrendingDown className="w-3 h-3" />{d}
      </span>
    );
  return (
    <span className="flex items-center gap-0.5 text-slate-500 font-bold text-xs">
      <Minus className="w-3 h-3" />0
    </span>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function IssueCard({
  issue,
  compareStatus,
  matchedAfterIssue,
  side,
}: {
  issue: Issue;
  compareStatus: IssueCompareStatus;
  matchedAfterIssue?: Issue;
  side: 'before' | 'after';
}) {
  const [expanded, setExpanded] = useState(false);

  const statusConfig = {
    fixed: { icon: CheckCircle2, label: 'Fixed', color: 'text-emerald-400', bg: 'border-l-4 border-l-emerald-500 bg-emerald-950/20' },
    still_present: { icon: XCircle, label: 'Still Present', color: 'text-rose-400', bg: 'border-l-4 border-l-rose-500 bg-rose-950/20' },
    new: { icon: PlusCircle, label: 'New Issue', color: 'text-amber-400', bg: 'border-l-4 border-l-amber-500 bg-amber-950/20' },
  }[compareStatus];

  const StatusIcon = statusConfig.icon;

  return (
    <div className={`rounded-xl overflow-hidden transition-all ${statusConfig.bg} bg-slate-900/60 border border-slate-800/80`}>
      <button
        className="w-full flex items-start gap-3 px-4 py-3 text-left group"
        onClick={() => setExpanded((v) => !v)}
      >
        <StatusIcon className={`w-4 h-4 mt-0.5 shrink-0 ${statusConfig.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${SEVERITY_STYLES[issue.severity] || SEVERITY_STYLES.low}`}>
              {issue.severity}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              {CATEGORY_LABELS[issue.category] || issue.category}
            </span>
            <span className={`ml-auto text-[10px] font-semibold ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-200 leading-snug line-clamp-2">{issue.title}</p>
          {issue.pageUrl && (
            <p className="text-[10px] text-slate-500 mt-0.5 truncate">{issue.pageUrl}</p>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-slate-800/60 pt-3 ml-7">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            <span className="font-semibold text-slate-300">Problem: </span>{issue.problem}
          </p>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            <span className="font-semibold text-slate-300">Fix: </span>{issue.recommendation}
          </p>
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ score, label }: { score: number; label: string }) {
  const color =
    score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-yellow-400' : 'text-rose-400';
  return (
    <div className="text-center">
      <p className={`text-2xl font-black ${color}`}>{score}</p>
      <p className="text-[10px] text-slate-500 font-medium mt-0.5">{label}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AuditComparePage() {
  const [audits, setAudits] = useState<AuditSummary[]>([]);
  const [beforeId, setBeforeId] = useState('');
  const [afterId, setAfterId] = useState('');
  const [compareData, setCompareData] = useState<{ before: AuditDetail; after: AuditDetail } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all'); // all | fixed | still_present | new
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    fetch('/api/audits')
      .then((r) => r.json())
      .then((data: AuditSummary[]) => {
        const completed = data.filter((d) => d.status === 'completed');
        setAudits(completed);
        if (completed.length >= 2) {
          setBeforeId(completed[1].id);
          setAfterId(completed[0].id);
        }
      })
      .catch(console.error);
  }, []);

  const canCompare = beforeId && afterId && beforeId !== afterId;

  async function runComparison() {
    if (!canCompare) return;
    setLoading(true);
    setError('');
    setCompareData(null);
    try {
      const res = await fetch(`/api/audits/compare?before=${beforeId}&after=${afterId}`);
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || 'Failed to fetch comparison data.');
      }
      setCompareData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Build comparison list ─────────────────────────────────────────────────
  const { beforeIssues, newIssues, fixedCount, stillPresentCount } = useMemo(() => {
    if (!compareData)
      return { beforeIssues: [] as ComparableIssue[], newIssues: [] as Issue[], fixedCount: 0, stillPresentCount: 0 };

    const afterIssues = compareData.after.issues;

    // For every before-issue, decide if it's fixed or still present
    const beforeIssuesMapped: ComparableIssue[] = compareData.before.issues.map((bi) => {
      const match = afterIssues.find((ai) => issuesMatch(bi, ai));
      return match
        ? { issue: bi, compareStatus: 'still_present', matchedAfterIssue: match }
        : { issue: bi, compareStatus: 'fixed' };
    });

    // New issues: in after but not matched to any before-issue
    const matchedAfterIds = new Set(
      beforeIssuesMapped
        .filter((c) => c.compareStatus === 'still_present')
        .map((c) => c.matchedAfterIssue!.id)
    );
    const newIssuesList = afterIssues.filter((ai) => !matchedAfterIds.has(ai.id));

    const fixed = beforeIssuesMapped.filter((c) => c.compareStatus === 'fixed').length;
    const still = beforeIssuesMapped.filter((c) => c.compareStatus === 'still_present').length;

    return {
      beforeIssues: beforeIssuesMapped,
      newIssues: newIssuesList,
      fixedCount: fixed,
      stillPresentCount: still,
    };
  }, [compareData]);

  // All unique categories from both sides
  const allCategories = useMemo(() => {
    if (!compareData) return [] as string[];
    const cats = new Set([
      ...compareData.before.issues.map((i) => i.category),
      ...compareData.after.issues.map((i) => i.category),
    ]);
    return Array.from(cats).sort();
  }, [compareData]);

  // Apply filters to before-issues
  const filteredBefore = useMemo(() => {
    return beforeIssues.filter((c) => {
      if (filterSeverity !== 'all' && c.issue.severity !== filterSeverity) return false;
      if (filterCategory !== 'all' && c.issue.category !== filterCategory) return false;
      if (filterStatus === 'fixed' && c.compareStatus !== 'fixed') return false;
      if (filterStatus === 'still_present' && c.compareStatus !== 'still_present') return false;
      if (filterStatus === 'new') return false; // new issues are rendered separately
      return true;
    });
  }, [beforeIssues, filterSeverity, filterCategory, filterStatus]);

  // Apply filters to new issues
  const filteredNew = useMemo(() => {
    if (filterStatus === 'fixed' || filterStatus === 'still_present') return [];
    return newIssues.filter((i) => {
      if (filterSeverity !== 'all' && i.severity !== filterSeverity) return false;
      if (filterCategory !== 'all' && i.category !== filterCategory) return false;
      return true;
    });
  }, [newIssues, filterSeverity, filterCategory, filterStatus]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const SCORE_ROWS = [
    { key: 'overallScore', label: 'Overall' },
    { key: 'headerNavScore', label: 'Header & Nav' },
    { key: 'visualDesignScore', label: 'Visual Design' },
    { key: 'responsiveScore', label: 'Responsive' },
    { key: 'contentScore', label: 'Content' },
    { key: 'buttonsCtasScore', label: 'Buttons & CTAs' },
    { key: 'formsScore', label: 'Forms' },
    { key: 'linksScore', label: 'Links' },
    { key: 'imagesMediaScore', label: 'Images & Media' },
    { key: 'seoOnPageScore', label: 'SEO – On Page' },
    { key: 'technicalSeoScore', label: 'Technical SEO' },
    { key: 'securityScore', label: 'Security' },
  ] as const;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2">
          <GitCompare className="w-6 h-6 text-brand-400" />
          Before vs After — Issue Tracker
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Select the original audit (Before) and the re-audit after fixes (After). Every issue is tracked as{' '}
          <span className="text-emerald-400 font-semibold">Fixed</span>,{' '}
          <span className="text-rose-400 font-semibold">Still Present</span>, or{' '}
          <span className="text-amber-400 font-semibold">New</span>.
        </p>
      </div>

      {/* ── Audit Selectors ── */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-end">
          {/* Before */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              📋 Before (Original Audit)
            </label>
            <select
              value={beforeId}
              onChange={(e) => setBeforeId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-brand-500"
            >
              <option value="">-- Select Before Audit --</option>
              {audits.map((a) => (
                <option key={a.id} value={a.id} disabled={a.id === afterId}>
                  {a.siteName} ({a.domain}) · Score: {a.overallScore} · {formatDate(a.createdAt)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-center pb-1">
            <ArrowRight className="w-6 h-6 text-slate-600" />
          </div>

          {/* After */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              ✅ After (Re-Audit with Fixes)
            </label>
            <select
              value={afterId}
              onChange={(e) => setAfterId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-brand-500"
            >
              <option value="">-- Select After Audit --</option>
              {audits.map((a) => (
                <option key={a.id} value={a.id} disabled={a.id === beforeId}>
                  {a.siteName} ({a.domain}) · Score: {a.overallScore} · {formatDate(a.createdAt)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={runComparison}
          disabled={!canCompare || loading}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Comparing…</>
          ) : (
            <><GitCompare className="w-4 h-4" />Run Comparison</>
          )}
        </button>

        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>

      {/* ── Results ── */}
      {compareData && (
        <>
          {/* ── Score Strip ── */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Score Changes</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-800">
                    <th className="text-left py-2 pr-4 font-semibold">Metric</th>
                    <th className="text-center py-2 px-3 font-semibold">Before</th>
                    <th className="text-center py-2 px-3 font-semibold">After</th>
                    <th className="text-right py-2 pl-3 font-semibold">Δ Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {SCORE_ROWS.map((row) => {
                    const b = (compareData.before as any)[row.key] ?? 0;
                    const a = (compareData.after as any)[row.key] ?? 0;
                    return (
                      <tr key={row.key} className="hover:bg-slate-900/40">
                        <td className="py-2.5 pr-4 font-semibold text-white">{row.label}</td>
                        <td className="py-2.5 px-3 text-center text-slate-400">{b}/100</td>
                        <td className="py-2.5 px-3 text-center text-slate-300 font-semibold">{a}/100</td>
                        <td className="py-2.5 pl-3 text-right">{getScoreDelta(a, b)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Summary Chips ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Issues Before', value: compareData.before.issues.length, color: 'text-slate-300', bg: 'bg-slate-800/60 border-slate-700' },
              { label: '✅ Fixed', value: fixedCount, color: 'text-emerald-400', bg: 'bg-emerald-950/40 border-emerald-800/60' },
              { label: '❌ Still Present', value: stillPresentCount, color: 'text-rose-400', bg: 'bg-rose-950/40 border-rose-800/60' },
              { label: '⚠️ New Issues', value: newIssues.length, color: 'text-amber-400', bg: 'bg-amber-950/40 border-amber-800/60' },
            ].map((chip) => (
              <div key={chip.label} className={`rounded-2xl border p-4 text-center ${chip.bg}`}>
                <p className={`text-3xl font-black ${chip.color}`}>{chip.value}</p>
                <p className="text-[11px] text-slate-400 font-medium mt-1">{chip.label}</p>
              </div>
            ))}
          </div>

          {/* ── Filters ── */}
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="w-4 h-4 text-slate-500" />
            {/* Status filter */}
            {[
              { value: 'all', label: 'All' },
              { value: 'fixed', label: '✅ Fixed' },
              { value: 'still_present', label: '❌ Still Present' },
              { value: 'new', label: '⚠️ New' },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setFilterStatus(f.value)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors border ${
                  filterStatus === f.value
                    ? 'bg-brand-600 border-brand-500 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}

            <div className="w-px h-4 bg-slate-700 mx-1" />

            {/* Severity filter */}
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="px-3 py-1.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300 text-[11px] focus:outline-none"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Category filter */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-1.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300 text-[11px] focus:outline-none"
            >
              <option value="all">All Categories</option>
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat] || cat}</option>
              ))}
            </select>
          </div>

          {/* ── Main Issue Columns ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT: Before issues with fixed/still-present status */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
                <span className="w-3 h-3 rounded-full bg-slate-500 inline-block" />
                <h3 className="text-sm font-bold text-white">
                  Before — {compareData.before.siteName}
                </h3>
                <span className="ml-auto text-[10px] text-slate-500">
                  {formatDate(compareData.before.createdAt)} · Score {compareData.before.overallScore}
                </span>
              </div>

              {filteredBefore.length === 0 && filterStatus !== 'new' && (
                <div className="text-center py-10 text-slate-600 text-xs italic">
                  No issues match the current filters.
                </div>
              )}

              {filteredBefore.map((c) => (
                <IssueCard
                  key={c.issue.id}
                  issue={c.issue}
                  compareStatus={c.compareStatus}
                  matchedAfterIssue={c.matchedAfterIssue}
                  side="before"
                />
              ))}
            </div>

            {/* RIGHT: Corresponding after-side view */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
                <span className="w-3 h-3 rounded-full bg-brand-500 inline-block" />
                <h3 className="text-sm font-bold text-white">
                  After — {compareData.after.siteName}
                </h3>
                <span className="ml-auto text-[10px] text-slate-500">
                  {formatDate(compareData.after.createdAt)} · Score {compareData.after.overallScore}
                </span>
              </div>

              {/* Mirror: for each filtered before-issue, show what the "after" side looks like */}
              {filteredBefore.length === 0 && filterStatus !== 'new' && (
                <div className="text-center py-10 text-slate-600 text-xs italic">
                  —
                </div>
              )}

              {filteredBefore.map((c) => {
                if (c.compareStatus === 'fixed') {
                  // Show a "Fixed" placeholder on the right
                  return (
                    <div
                      key={c.issue.id}
                      className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 border-l-4 border-l-emerald-500 px-4 py-3 flex items-center gap-3"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide mb-0.5">Issue Resolved ✓</p>
                        <p className="text-xs text-slate-400 italic line-clamp-1">"{c.issue.title}"</p>
                        <p className="text-[10px] text-slate-600 mt-0.5">Not found in the re-audit — considered fixed.</p>
                      </div>
                    </div>
                  );
                }

                // Still present — show the matched after-issue
                return (
                  <IssueCard
                    key={c.issue.id}
                    issue={c.matchedAfterIssue!}
                    compareStatus="still_present"
                    side="after"
                  />
                );
              })}

              {/* New issues section (only on right column) */}
              {filterStatus !== 'fixed' && filterStatus !== 'still_present' && filteredNew.length > 0 && (
                <div className="space-y-3 pt-4">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-amber-500 flex items-center gap-1.5">
                    <PlusCircle className="w-3.5 h-3.5" /> New issues in re-audit ({filteredNew.length})
                  </p>
                  {filteredNew.map((i) => (
                    <IssueCard
                      key={i.id}
                      issue={i}
                      compareStatus="new"
                      side="after"
                    />
                  ))}
                </div>
              )}

              {filterStatus === 'new' && filteredNew.length === 0 && (
                <div className="text-center py-10 text-slate-600 text-xs italic">
                  No new issues — great job! 🎉
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Empty state ── */}
      {!compareData && !loading && (
        <div className="glass-panel p-16 rounded-2xl border border-slate-800 text-center">
          <GitCompare className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-500 text-sm font-semibold">Select two audits and click Run Comparison</p>
          <p className="text-slate-600 text-xs mt-1">
            Every issue from the Before audit will be tracked as Fixed, Still Present, or New.
          </p>
        </div>
      )}
    </div>
  );
}
