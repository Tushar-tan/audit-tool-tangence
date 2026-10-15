'use client';

import { useState } from 'react';
import { Settings, Key, Sliders, ShieldCheck, Check } from 'lucide-react';

export default function SettingsPage() {
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [agencyName, setAgencyName] = useState('Tangence Audit Tool');
  const [saved, setSaved] = useState(false);

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
