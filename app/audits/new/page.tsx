'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, FileSpreadsheet, FileText, Compass, Settings2, Play, Upload, ShieldAlert, Sparkles } from 'lucide-react';

export default function NewAuditPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'urls' | 'csv' | 'txt' | 'sitemap' | 'crawler'>('urls');
  const [siteName, setSiteName] = useState('');
  const [domain, setDomain] = useState('');
  const [urlsInput, setUrlsInput] = useState('');
  const [sitemapInput, setSitemapInput] = useState('');
  const [fileContent, setFileContent] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');

  // Advanced Config
  const [maxPages, setMaxPages] = useState<number>(10);
  const [maxDepth, setMaxDepth] = useState<number>(2);
  const [respectRobotsTxt, setRespectRobotsTxt] = useState(true);
  const [excludePatterns, setExcludePatterns] = useState('');
  const [enableAiAnalysis, setEnableAiAnalysis] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const lines = text
          .split(/[\r\n]+/)
          .map((l) => l.trim())
          .filter((l) => l.startsWith('http://') || l.startsWith('https://'));
        setFileContent(lines);
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    let inputs: string[] = [];

    if (activeTab === 'urls') {
      inputs = urlsInput
        .split('\n')
        .map((u) => u.trim())
        .filter(Boolean);
    } else if (activeTab === 'csv' || activeTab === 'txt') {
      inputs = fileContent;
    } else if (activeTab === 'sitemap') {
      if (sitemapInput.trim()) inputs = [sitemapInput.trim()];
    } else if (activeTab === 'crawler') {
      if (domain.trim()) inputs = [domain.trim()];
    }

    if (inputs.length === 0) {
      setErrorMsg('Please provide at least one valid target URL, sitemap, or domain.');
      return;
    }

    // Derive domain: if a single URL is audited and has a meaningful path (slug), include it.
    // For multi-URL audits, use just the hostname as the representative domain.
    let calculatedDomain: string;
    if (domain.trim()) {
      calculatedDomain = domain.trim();
    } else if (inputs.length === 1) {
      // Single URL – preserve the full path so slugs like /ewac or /rf-landing/ai-agents/ are visible
      try {
        const u = new URL(inputs[0].startsWith('http') ? inputs[0] : `https://${inputs[0]}`);
        const slug = u.pathname && u.pathname !== '/' ? u.hostname + u.pathname : u.hostname;
        calculatedDomain = slug;
      } catch {
        calculatedDomain = inputs[0];
      }
    } else {
      // Multiple URLs – use the common hostname
      try {
        calculatedDomain = new URL(inputs[0].startsWith('http') ? inputs[0] : `https://${inputs[0]}`).hostname;
      } catch {
        calculatedDomain = 'website.com';
      }
    }
    const calculatedSiteName = siteName.trim() || calculatedDomain;

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteName: calculatedSiteName,
          domain: calculatedDomain,
          inputMethod: activeTab,
          inputs,
          maxPages,
          maxDepth,
          respectRobotsTxt,
          excludePatterns: excludePatterns.split(',').map((p) => p.trim()).filter(Boolean),
          enableAiAnalysis,
          apiKey
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start audit');
      }

      const audit = await res.json();
      router.push(`/audits/${audit.id}/progress`);
    } catch (err) {
      setErrorMsg((err as Error).message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white">Create New UI/UX Audit</h1>
        <p className="text-sm text-slate-400">
          Configure site targets and crawling options to launch an automated multidisciplinary audit run.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Project Meta Info */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white">1. Audit Identification</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Audit / Brand Name</label>
              <input
                type="text"
                placeholder="e.g. Acme Corp SaaS"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target Website Domain</label>
              <input
                type="text"
                placeholder="e.g. acme.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Input Methods Tabs */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
          <h2 className="text-base font-bold text-white">2. Select Input Method</h2>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
            {[
              { id: 'urls', name: 'Paste URLs', icon: Globe },
              { id: 'csv', name: 'Upload CSV', icon: FileSpreadsheet },
              { id: 'txt', name: 'Upload TXT', icon: FileText },
              { id: 'sitemap', name: 'Sitemap XML', icon: Compass },
              { id: 'crawler', name: 'Site Crawler', icon: Play }
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.name}
                </button>
              );
            })}
          </div>

          {/* Tab 1: Paste URLs */}
          {activeTab === 'urls' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">Target Webpage URLs (One URL per line)</label>
              <textarea
                rows={5}
                placeholder="https://example.com/&#10;https://example.com/pricing&#10;https://example.com/features"
                value={urlsInput}
                onChange={(e) => setUrlsInput(e.target.value)}
                className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 font-mono text-xs focus:outline-none focus:border-brand-500"
              />
            </div>
          )}

          {/* Tab 2 & 3: File Upload */}
          {(activeTab === 'csv' || activeTab === 'txt') && (
            <div className="space-y-4 text-center p-8 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/40">
              <Upload className="w-8 h-8 text-slate-500 mx-auto" />
              <div>
                <p className="text-xs text-slate-300 font-medium">Upload {activeTab.toUpperCase()} File Containing URLs</p>
                <p className="text-[11px] text-slate-500 mt-1">One HTTP/HTTPS URL per line or row</p>
              </div>
              <input
                type="file"
                accept={activeTab === 'csv' ? '.csv' : '.txt'}
                onChange={handleFileUpload}
                className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-600 file:text-white hover:file:bg-brand-500"
              />
              {fileName && (
                <p className="text-xs text-emerald-400 font-medium">
                  Loaded {fileName} ({fileContent.length} valid URLs found)
                </p>
              )}
            </div>
          )}

          {/* Tab 4: Sitemap XML */}
          {activeTab === 'sitemap' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">Sitemap XML Endpoint URL</label>
              <input
                type="url"
                placeholder="https://example.com/sitemap.xml"
                value={sitemapInput}
                onChange={(e) => setSitemapInput(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-brand-500"
              />
            </div>
          )}

          {/* Tab 5: Site Crawler */}
          {activeTab === 'crawler' && (
            <div className="p-4 rounded-xl bg-brand-500/10 border border-brand-500/20 text-slate-300 text-xs space-y-2">
              <div className="font-semibold text-brand-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Automatic Multi-Page Website Discovery
              </div>
              <p>
                The crawler will start at the seed domain specified above and automatically discover internal page links up to your configured crawl depth limit.
              </p>
            </div>
          )}
        </div>

        {/* Crawling Configuration */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-brand-400" />
            <h2 className="text-base font-bold text-white">3. Advanced Audit Parameters</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Max Pages Limit</label>
              <input
                type="number"
                min={1}
                max={100}
                value={maxPages}
                onChange={(e) => setMaxPages(Number(e.target.value))}
                className="w-full px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Crawl Depth</label>
              <input
                type="number"
                min={1}
                max={5}
                value={maxDepth}
                onChange={(e) => setMaxDepth(Number(e.target.value))}
                className="w-full px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Exclude URL Patterns</label>
              <input
                type="text"
                placeholder="/admin, /cart, .pdf"
                value={excludePatterns}
                onChange={(e) => setExcludePatterns(e.target.value)}
                className="w-full px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-sm focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="robots"
                checked={respectRobotsTxt}
                onChange={(e) => setRespectRobotsTxt(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-brand-600 focus:ring-0"
              />
              <label htmlFor="robots" className="text-xs text-slate-300 font-medium">
                Respect robots.txt crawling directives
              </label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="aiEngine"
                checked={enableAiAnalysis}
                onChange={(e) => setEnableAiAnalysis(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-brand-600 focus:ring-0"
              />
              <label htmlFor="aiEngine" className="text-xs text-slate-300 font-medium">
                Enable AI Multidisciplinary Review Team
              </label>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-brand-600 to-cyan-500 hover:from-brand-500 hover:to-cyan-400 text-white font-bold text-base shadow-xl shadow-brand-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isSubmitting ? (
            <span>Launching Audit Processor...</span>
          ) : (
            <>
              <Play className="w-5 h-5 fill-current" /> Launch Website Audit Execution
            </>
          )}
        </button>
      </form>
    </div>
  );
}
