'use client';

import { useEffect, useState } from 'react';
import { 
  Download, Filter, Monitor, Tablet as TabletIcon, Smartphone, 
  ShieldCheck, AlertTriangle, Zap, CheckCircle2, FileText, ChevronDown, 
  Code, Layers, Layout, Globe, Search, ArrowRight, ExternalLink, ImageOff,
  Image as ImageIcon, MousePointerClick
} from 'lucide-react';

interface Issue {
  id: string;
  issueId?: string;
  pageUrl: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'PASS' | 'FAIL' | 'NOT_TESTABLE';
  viewport?: string;
  title: string;
  problem: string;
  expectedBehavior: string;
  actualBehavior: string;
  recommendation: string;
  elementSelector?: string;
  elementText?: string;
  elementInfo?: string;
  elementBoxJson?: string;
  screenshotUrl?: string;
  isGrouped?: boolean;
  affectedCount?: number;
  affectedUrlsJson?: string;
}

interface PageAudit {
  id: string;
  url: string;
  pageTitle: string;
  desktopScreenshot?: string;
  tabletScreenshot?: string;
  mobileScreenshot?: string;
  fullPageScreenshot?: string;
  annotatedScreenshot?: string;
  scoresJson: string;
  issues: Issue[];
}

interface AuditDetails {
  id: string;
  siteName: string;
  domain: string;
  overallScore: number;
  overallGrade: string;
  headerNavScore: number;
  visualDesignScore: number;
  responsiveScore: number;
  contentScore?: number;
  typographyContentScore?: number;
  buttonsCtasScore: number;
  formsScore: number;
  linksScore: number;
  imagesMediaScore: number;
  seoOnPageScore?: number;
  seoUxScore?: number;
  technicalSeoScore?: number;
  errorStatesScore?: number;
  securityScore?: number;
  totalPages: number;
  processedPages: number;
  pagesWithIssues: number;
  pagesPassed: number;
  criticalIssuesCount: number;
  highIssuesCount: number;
  mediumIssuesCount: number;
  lowIssuesCount: number;
  createdAt: string;
  pageAudits: PageAudit[];
  issues: Issue[];
}

const CATEGORY_NAMES: Record<string, string> = {
  'header-navigation': 'Header & Navigation',
  'visual-design': 'Visual Design / UI',
  'overall-visual-design': 'Visual Design / UI',
  'responsive-design': 'Responsive Design',
  'content': 'Content',
  'typography-content': 'Content',
  'buttons-ctas': 'Buttons & CTAs',
  'forms': 'Forms',
  'links': 'Links',
  'images-media': 'Images & Media',
  'seo-on-page': 'SEO – On Page',
  'seo-ux': 'SEO – On Page',
  'technical-seo': 'Technical SEO',
  'error-empty-states': 'Technical SEO',
  'security': 'Security'
};

export default function AuditReportPage({ params }: { params: { id: string } }) {
  const [audit, setAudit] = useState<AuditDetails | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'page-based' | 'category-based'>('all');
  const [selectedPageIdx, setSelectedPageIdx] = useState<number>(0);
  const [viewportMode, setViewportMode] = useState<'desktop' | 'tablet' | 'mobile' | 'full'>('desktop');
  
  // 5 Filters
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterPage, setFilterPage] = useState<string>('all');
  const [filterViewport, setFilterViewport] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Export Modal
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  useEffect(() => {
    fetch(`/api/audits/${params.id}`)
      .then((res) => res.json())
      .then((data) => setAudit(data))
      .catch((err) => console.error(err));
  }, [params.id]);

  if (!audit) {
    return (
      <div className="py-20 text-center space-y-4">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-400">Loading 10-category checklist audit report...</p>
      </div>
    );
  }

  const allIssues = audit.issues || [];
  const pageAudits = audit.pageAudits || [];
  const currentPage = pageAudits[selectedPageIdx] || pageAudits[0];

  // Distinct viewports & pages for filters
  const uniquePages = Array.from(new Set(allIssues.map((i) => i.pageUrl).filter(Boolean)));
  const uniqueViewports = Array.from(new Set(allIssues.map((i) => i.viewport).filter(Boolean))) as string[];

  // Filter application
  const filteredIssues = allIssues.filter((issue) => {
    if (filterCategory !== 'all' && issue.category !== filterCategory) return false;
    if (filterSeverity !== 'all' && issue.severity !== filterSeverity) return false;
    if (filterPage !== 'all' && issue.pageUrl !== filterPage) return false;
    if (filterViewport !== 'all' && issue.viewport !== filterViewport) return false;
    if (filterStatus !== 'all' && issue.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = issue.title.toLowerCase().includes(q);
      const matchProb = issue.problem.toLowerCase().includes(q);
      const matchElem = (issue.elementSelector || '').toLowerCase().includes(q);
      const matchUrl = issue.pageUrl.toLowerCase().includes(q);
      if (!matchTitle && !matchProb && !matchElem && !matchUrl) return false;
    }
    return true;
  });

  const downloadExport = (format: string) => {
    window.open(`/api/export?auditId=${audit.id}&format=${format}`, '_blank');
    setShowExportModal(false);
  };

  return (
    <div className="space-y-8 min-w-0 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-slate-400 text-xs font-mono mb-1">
            <span>Domain: {audit.domain}</span> &bull; <span>Date: {new Date(audit.createdAt).toLocaleDateString()}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">
            Audit Report: {audit.siteName}
          </h1>
        </div>

        <button
          onClick={() => setShowExportModal(true)}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold shadow-lg shadow-brand-500/20 transition-all shrink-0"
        >
          <Download className="w-4 h-4" /> Download Report
        </button>
      </div>

      {/* 11. SUMMARY DASHBOARD */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
        <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-brand-400" /> Summary Dashboard
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
            <div className="text-[11px] text-slate-400 font-medium">Pages Audited</div>
            <div className="text-2xl font-extrabold text-white mt-1">{audit.totalPages}</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
            <div className="text-[11px] text-slate-400 font-medium">Total Issues</div>
            <div className="text-2xl font-extrabold text-cyan-400 mt-1">{audit.issues.length}</div>
          </div>
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-center">
            <div className="text-[11px] text-rose-400 font-medium">Critical</div>
            <div className="text-2xl font-extrabold text-rose-400 mt-1">{audit.criticalIssuesCount || 0}</div>
          </div>
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center">
            <div className="text-[11px] text-amber-400 font-medium">High</div>
            <div className="text-2xl font-extrabold text-amber-400 mt-1">{audit.highIssuesCount || 0}</div>
          </div>
          <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-center">
            <div className="text-[11px] text-yellow-400 font-medium">Medium</div>
            <div className="text-2xl font-extrabold text-yellow-400 mt-1">{audit.mediumIssuesCount || 0}</div>
          </div>
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-center">
            <div className="text-[11px] text-blue-400 font-medium">Low</div>
            <div className="text-2xl font-extrabold text-blue-400 mt-1">{audit.lowIssuesCount || 0}</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
            <div className="text-[11px] text-slate-400 font-medium">With Issues</div>
            <div className="text-2xl font-extrabold text-slate-200 mt-1">{audit.pagesWithIssues || 0}</div>
          </div>
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
            <div className="text-[11px] text-emerald-400 font-medium">Pages Passed</div>
            <div className="text-2xl font-extrabold text-emerald-400 mt-1">{audit.pagesPassed || 0}</div>
          </div>
        </div>

        {/* Category Breakdown Matrix */}
        <div className="pt-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Audit Checklist Categories</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { id: 'header-navigation', name: 'Header & Navigation', score: audit.headerNavScore },
              { id: 'visual-design', name: 'Visual Design / UI', score: audit.visualDesignScore },
              { id: 'responsive-design', name: 'Responsive Design', score: audit.responsiveScore },
              { id: 'content', name: 'Content', score: audit.contentScore ?? audit.typographyContentScore ?? 0 },
              { id: 'buttons-ctas', name: 'Buttons & CTAs', score: audit.buttonsCtasScore },
              { id: 'forms', name: 'Forms', score: audit.formsScore },
              { id: 'links', name: 'Links', score: audit.linksScore },
              { id: 'images-media', name: 'Images & Media', score: audit.imagesMediaScore },
              { id: 'seo-on-page', name: 'SEO – On Page', score: audit.seoOnPageScore ?? audit.seoUxScore ?? 0 },
              { id: 'technical-seo', name: 'Technical SEO', score: audit.technicalSeoScore ?? audit.errorStatesScore ?? 0 },
              { id: 'security', name: 'Security', score: audit.securityScore ?? 0 }
            ].map((cat) => {
              const count = allIssues.filter((i) => i.category === cat.id || (cat.id === 'visual-design' && i.category === 'overall-visual-design') || (cat.id === 'content' && i.category === 'typography-content') || (cat.id === 'seo-on-page' && i.category === 'seo-ux') || (cat.id === 'technical-seo' && i.category === 'error-empty-states')).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setFilterCategory(cat.id);
                    setActiveTab('all');
                  }}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    filterCategory === cat.id
                      ? 'bg-brand-600/20 border-brand-500 text-white'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="text-[11px] text-slate-400 font-semibold truncate">{cat.name}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm font-bold text-white">{cat.score}/100</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${count > 0 ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                      {count} {count === 1 ? 'issue' : 'issues'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Screenshots Inspection Section */}
      {currentPage && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <span className="text-xs text-slate-400 font-semibold">Active Page Inspection:</span>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {currentPage.pageTitle || currentPage.url}
              </h2>
              <p className="text-xs text-slate-500 font-mono">{currentPage.url}</p>
            </div>

            {/* Viewport Switcher */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setViewportMode('desktop')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  viewportMode === 'desktop' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" /> Desktop (1920px)
              </button>
              <button
                onClick={() => setViewportMode('tablet')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  viewportMode === 'tablet' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TabletIcon className="w-3.5 h-3.5" /> Tablet (768px)
              </button>
              <button
                onClick={() => setViewportMode('mobile')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  viewportMode === 'mobile' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" /> Mobile (390px)
              </button>
            </div>
          </div>

          {/* Screenshot Display Frame */}
          <div className="relative rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center p-4 min-h-[400px]">
            {viewportMode === 'desktop' && currentPage.desktopScreenshot && (
              <img
                src={currentPage.desktopScreenshot}
                alt="Desktop Screenshot"
                className="max-h-[600px] w-auto rounded border border-slate-800 shadow-2xl object-contain"
              />
            )}
            {viewportMode === 'tablet' && currentPage.tabletScreenshot && (
              <img
                src={currentPage.tabletScreenshot}
                alt="Tablet Screenshot"
                className="max-h-[600px] w-auto rounded border border-slate-800 shadow-2xl object-contain"
              />
            )}
            {viewportMode === 'mobile' && currentPage.mobileScreenshot && (
              <img
                src={currentPage.mobileScreenshot}
                alt="Mobile Screenshot"
                className="max-h-[600px] w-auto rounded border border-slate-800 shadow-2xl object-contain"
              />
            )}
          </div>
        </div>
      )}

      {/* View Tabs & 14. FILTERS */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6 min-w-0 overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          {/* Tabs: All Findings vs 12. Page-Based vs 13. Category-Based */}
          <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'all' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Filtered Findings ({filteredIssues.length})
            </button>
            <button
              onClick={() => setActiveTab('page-based')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'page-based' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Page-Based Report
            </button>
            <button
              onClick={() => setActiveTab('category-based')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'category-based' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Category-Based Report
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search issues, elements, URLs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* 14. 5 Filter Controls */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">All Categories</option>
              {[
                { id: 'header-navigation', label: 'Header & Navigation' },
                { id: 'visual-design', label: 'Visual Design / UI' },
                { id: 'responsive-design', label: 'Responsive Design' },
                { id: 'content', label: 'Content' },
                { id: 'buttons-ctas', label: 'Buttons & CTAs' },
                { id: 'forms', label: 'Forms' },
                { id: 'links', label: 'Links' },
                { id: 'images-media', label: 'Images & Media' },
                { id: 'seo-on-page', label: 'SEO – On Page' },
                { id: 'technical-seo', label: 'Technical SEO' },
                { id: 'security', label: 'Security' }
              ].map(({ id, label }) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Severity</label>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Page URL</label>
            <select
              value={filterPage}
              onChange={(e) => setFilterPage(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none truncate"
            >
              <option value="all">All Pages ({uniquePages.length})</option>
              {uniquePages.map((url) => (
                <option key={url} value={url}>{url}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Viewport</label>
            <select
              value={filterViewport}
              onChange={(e) => setFilterViewport(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">All Viewports</option>
              {uniqueViewports.map((vp) => (
                <option key={vp} value={vp}>{vp}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="FAIL">FAIL</option>
              <option value="PASS">PASS</option>
              <option value="NOT_TESTABLE">NOT TESTABLE</option>
            </select>
          </div>
        </div>

        {/* 10. AUDIT RESULT STRUCTURE & CARDS */}
        {activeTab === 'all' && (
          <div className="space-y-4 min-w-0">
            {filteredIssues.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs italic bg-slate-900/40 rounded-xl border border-slate-800">
                No checklist findings match the selected filter criteria.
              </div>
            ) : (
              filteredIssues.map((issue, idx) => renderIssueCard(issue, idx))
            )}
          </div>
        )}

        {/* 12. PAGE-BASED REPORT */}
        {activeTab === 'page-based' && (
          <div className="space-y-6 min-w-0">
            {uniquePages.map((pageUrl) => {
              const pageIssues = filteredIssues.filter((i) => i.pageUrl === pageUrl);
              return (
                <div key={pageUrl} className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 min-w-0 overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3 min-w-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Globe className="w-4 h-4 text-brand-400 shrink-0" />
                      <span className="font-mono text-sm font-bold text-white break-all min-w-0">{pageUrl}</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-brand-500/20 text-brand-300 shrink-0">
                      {pageIssues.length} {pageIssues.length === 1 ? 'Issue' : 'Issues'}
                    </span>
                  </div>

                  {pageIssues.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No matching issues for this page.</p>
                  ) : (
                    <div className="space-y-3 min-w-0">
                      {pageIssues.map((issue, idx) => renderIssueCard(issue, idx))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 13. CATEGORY-BASED REPORT */}
        {activeTab === 'category-based' && (
          <div className="space-y-6 min-w-0">
            {Object.entries(CATEGORY_NAMES).map(([catId, catLabel]) => {
              const catIssues = filteredIssues.filter((i) => i.category === catId);
              return (
                <div key={catId} className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 min-w-0 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 min-w-0">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 min-w-0 truncate">
                      <Layers className="w-4 h-4 text-cyan-400 shrink-0" /> {catLabel}
                    </h3>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 shrink-0">
                      {catIssues.length} Findings
                    </span>
                  </div>

                  {catIssues.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">Zero failures in this category.</p>
                  ) : (
                    <div className="space-y-3 min-w-0">
                      {catIssues.map((issue, idx) => renderIssueCard(issue, idx))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full p-6 rounded-2xl border border-slate-800 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Download 10-Category Audit Report</h3>
              <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { format: 'pdf', label: 'PDF Document', desc: 'Styled PDF with screenshots' },
                { format: 'docx', label: 'Word (.docx)', desc: 'Editable Microsoft Word' },
                { format: 'html', label: 'HTML Bundle', desc: 'Self-contained webpage' },
                { format: 'markdown', label: 'Markdown (.md)', desc: 'Clean doc for GitHub/Notion' },
                { format: 'json', label: 'JSON Data', desc: 'Raw API structured data' },
                { format: 'xlsx', label: 'Excel (.xlsx)', desc: 'Professional multi-sheet report' }
              ].map((item) => (
                <button
                  key={item.format}
                  onClick={() => downloadExport(item.format)}
                  className="p-3 rounded-xl bg-slate-900 hover:bg-brand-600/20 hover:border-brand-500/50 border border-slate-800 text-left transition-all group"
                >
                  <div className="text-xs font-bold text-white group-hover:text-cyan-300">{item.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // 10. AUDIT RESULT STRUCTURE COMPONENT
  function renderIssueCard(issue: Issue, idx: number) {
    return (
      <div
        key={issue.id || idx}
        className={`glass-card p-6 rounded-xl border-l-4 transition-all hover:bg-slate-900/70 space-y-3 min-w-0 max-w-full overflow-hidden ${
          issue.severity === 'critical'
            ? 'border-l-rose-500 border-slate-800'
            : issue.severity === 'high'
            ? 'border-l-amber-500 border-slate-800'
            : issue.severity === 'medium'
            ? 'border-l-yellow-500 border-slate-800'
            : 'border-l-blue-500 border-slate-800'
        }`}
      >
        {/* Category, Status, Severity Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 pb-3 min-w-0">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${
                issue.severity === 'critical'
                  ? 'bg-rose-500/20 text-rose-400'
                  : issue.severity === 'high'
                  ? 'bg-amber-500/20 text-amber-400'
                  : issue.severity === 'medium'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-blue-500/20 text-blue-400'
              }`}
            >
              {issue.severity}
            </span>

            <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300 uppercase font-semibold shrink-0">
              {CATEGORY_NAMES[issue.category] || issue.category}
            </span>

            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                issue.status === 'FAIL'
                  ? 'bg-rose-500/10 text-rose-300'
                  : issue.status === 'PASS'
                  ? 'bg-emerald-500/10 text-emerald-300'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {issue.status}
            </span>
          </div>

          {issue.viewport && (
            <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-mono text-[11px] shrink-0">
              Viewport: {issue.viewport}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-white break-words [overflow-wrap:anywhere] min-w-0">
          {issue.title}
        </h3>

        {/* Page URL & Element Location */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs bg-slate-950 p-3 rounded-lg border border-slate-800/80 font-mono min-w-0">
          <div className="min-w-0 overflow-hidden">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Page URL:</span>
            <span className="text-brand-300 break-all block">{issue.pageUrl}</span>
          </div>
          <div className="min-w-0 overflow-hidden">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">
              {issue.category === 'images-media' ? 'Image Name / Selector:' : issue.category === 'buttons-ctas' ? 'Button Name / Selector:' : 'Affected Element:'}
            </span>
            <span className="text-slate-200 break-all block">{issue.elementSelector || 'N/A'} {issue.elementText ? `("${issue.elementText}")` : ''}</span>
          </div>
        </div>

        {/* Dedicated Exact Asset URL for Images */}
        {(() => {
          let directImageUrl: string | null = null;
          if (issue.elementInfo && issue.elementInfo.includes('Image URL:')) {
            const match = issue.elementInfo.match(/Image URL:\s*([^\s()]+)/);
            if (match && match[1]) directImageUrl = match[1];
          } else if (issue.elementInfo && (issue.elementInfo.startsWith('http://') || issue.elementInfo.startsWith('https://') || issue.elementInfo.startsWith('/'))) {
            directImageUrl = issue.elementInfo;
          }
          if (directImageUrl) {
            return (
              <div className="p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-500/30 text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0 overflow-hidden">
                <div className="flex items-center gap-2 overflow-hidden min-w-0 flex-1">
                  <ImageIcon className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="text-slate-400 shrink-0">Exact Image URL:</span>
                  <span className="text-cyan-300 truncate min-w-0 block">{directImageUrl}</span>
                </div>
                <a
                  href={directImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 underline shrink-0 whitespace-nowrap"
                >
                  Open Image Asset <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            );
          }
          return null;
        })()}

        {/* Dedicated Details Bar for Buttons */}
        {issue.category === 'buttons-ctas' && issue.elementInfo && (
          <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/30 text-xs font-mono flex items-center gap-2 min-w-0 overflow-hidden">
            <MousePointerClick className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-slate-400 shrink-0">Button Details:</span>
            <span className="text-amber-200 break-all min-w-0 block">{issue.elementInfo}</span>
          </div>
        )}

        {/* Problem, Expected & Actual Result */}
        <div className="space-y-2 text-xs text-slate-300 min-w-0">
          <div className="min-w-0">
            <strong className="text-slate-400 block mb-0.5">Problem / Description:</strong>
            <p className="text-slate-200 leading-relaxed break-words [overflow-wrap:anywhere]">{issue.problem}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 min-w-0">
            <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 min-w-0 overflow-hidden">
              <strong className="text-emerald-400 block text-[11px] mb-0.5">Expected Behavior:</strong>
              <div className="text-slate-300 leading-relaxed break-words [overflow-wrap:anywhere]">
                {issue.expectedBehavior}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/20 min-w-0 overflow-hidden">
              <strong className="text-rose-400 block text-[11px] mb-0.5">Actual Behavior:</strong>
              <div className="text-slate-300 leading-relaxed break-words [overflow-wrap:anywhere]">
                {issue.actualBehavior}
              </div>
            </div>
          </div>

          {/* Screenshot Info */}
          <div className="pt-1 flex items-center gap-2 text-xs text-slate-400 min-w-0">
            <strong className="text-slate-400 shrink-0">Screenshot:</strong>
            {issue.screenshotUrl ? (
              <a
                href={issue.screenshotUrl}
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:text-cyan-300 underline flex items-center gap-1 font-mono truncate min-w-0"
              >
                View Attached Screenshot <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            ) : (
              <span className="text-slate-500 italic">Screenshot unavailable</span>
            )}
          </div>

          {/* Actionable Recommendation */}
          <div className="mt-3 p-3 rounded-lg bg-slate-950 border border-brand-500/30 text-xs min-w-0 overflow-hidden">
            <span className="font-semibold text-brand-400 block mb-1 flex items-center gap-1">
              <Code className="w-3.5 h-3.5 shrink-0" /> Recommendation:
            </span>
            <div className="text-slate-200 leading-relaxed break-words [overflow-wrap:anywhere]">
              {issue.recommendation}
            </div>
          </div>
        </div>
      </div>
    );
  }
}
