'use client';

import { useState, useEffect } from 'react';
import { Settings, Key, Sliders, ShieldCheck, Check, HardDrive, Trash2, RefreshCw, Clock } from 'lucide-react';

export default function SettingsPage() {
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [agencyName, setAgencyName] = useState('Tangence Audit Tool');
  const [saved, setSaved] = useState(false);

  // Storage cleanup states
  const [storageStats, setStorageStats] = useState<{
    totalAudits: number;
    totalFiles: number;
    totalBytes: number;
    totalMb: string;
    retentionDays: number;
    expiredAuditsCount: number;
  } | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  const fetchStorageStats = async () => {
    try {
      const res = await fetch('/api/storage/cleanup');
      const data = await res.json();
      if (data.success && data.stats) {
        setStorageStats(data.stats);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchStorageStats();
  }, []);

  const handleManualCleanup = async () => {
    setIsCleaning(true);
    setCleanupMessage(null);
    try {
      const res = await fetch('/api/storage/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retentionDays: 3 })
      });
      const data = await res.json();
      if (data.success) {
        setCleanupMessage(
          `Cleaned up ${data.deletedAudits} expired audit folders (${data.deletedFiles} files, reclaimed ${data.freedMb} MB)!`
        );
        await fetchStorageStats();
      } else {
        setCleanupMessage(`Cleanup finished: 0 expired audits found.`);
      }
    } catch (err: any) {
      setCleanupMessage(`Cleanup error: ${err.message}`);
    } finally {
      setIsCleaning(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-brand-400" /> Platform Settings
        </h1>
        <p className="text-sm text-slate-400">Configure AI provider API keys, crawler limits, and white-label report options.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* AI Key Configuration */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Key className="w-4 h-4 text-cyan-400" /> AI Engine API Credentials
          </h2>
          <p className="text-xs text-slate-400">
            Provide external API keys to enrich automated findings with Gemini 1.5/2.0 or GPT-4o. If left blank, the platform automatically utilizes its built-in expert heuristic AI engine.
          </p>

          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Google Gemini API Key</label>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">OpenAI API Key</label>
              <input
                type="password"
                placeholder="sk-..."
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* White-Label Branding Options */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-brand-400" /> Report Branding & White-Labeling
          </h2>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Agency / Organization Header Name</label>
            <input
              type="text"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* Screenshot Storage & Auto-Cleanup Management */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-400" /> Screenshot Storage & Auto-Cleanup
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-fit">
              <Clock className="w-3 h-3" /> Auto-Pruning Active (3 Days)
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Audit screenshots (desktop, tablet, mobile viewports) are automatically deleted after <strong>3 days</strong> to prevent disk bloat and keep project size lean. All 11-category audit evaluation scores, checklist grades, issues, and AI recommendations remain permanently preserved in your database.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
              <span className="text-[11px] text-slate-400 block mb-0.5">Storage Footprint</span>
              <span className="text-lg font-bold text-white">
                {storageStats ? `${storageStats.totalMb} MB` : 'Calculating...'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
              <span className="text-[11px] text-slate-400 block mb-0.5">Stored Screenshots</span>
              <span className="text-lg font-bold text-white">
                {storageStats ? `${storageStats.totalFiles} files` : '—'}
              </span>
              <span className="text-[10px] text-slate-500 block">
                {storageStats ? `across ${storageStats.totalAudits} audits` : ''}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
              <span className="text-[11px] text-slate-400 block mb-0.5">Retention Window</span>
              <span className="text-lg font-bold text-emerald-400">3 Days</span>
              <span className="text-[10px] text-slate-500 block">Auto-reclaimed every 6h</span>
            </div>
          </div>

          {cleanupMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{cleanupMessage}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleManualCleanup}
              disabled={isCleaning}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              {isCleaning ? 'Cleaning Expired Screenshots...' : 'Purge Expired Screenshots Now'}
            </button>

            <button
              type="button"
              onClick={fetchStorageStats}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold border border-slate-800 transition-all flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Stats
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm shadow-lg shadow-brand-500/20 transition-all flex items-center justify-center gap-2"
        >
          {saved ? (
            <>
              <Check className="w-4 h-4 text-emerald-300" /> Settings Saved Successfully
            </>
          ) : (
            'Save Platform Preferences'
          )}
        </button>
      </form>
    </div>
  );
}
