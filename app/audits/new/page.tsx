'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Globe, FileSpreadsheet, FileText, Compass, Settings2, Play, Upload,
  ShieldAlert, Sparkles, Lock, Unlock, Eye, EyeOff, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Loader2, MousePointerClick
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthMode = 'public' | 'login_required';
type AuthMethod = 'credentials' | 'manual';

interface AuthTestState {
  status: 'idle' | 'testing' | 'success' | 'failed' | 'manual_open';
  message?: string;
  errorCode?: string;
  testSessionId?: string;
  finalUrl?: string;
  logs?: string[];
}

// ─── Component ────────────────────────────────────────────────────────────────

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

  // ── Authentication ─────────────────────────────────────────────────────────
  const [authMode, setAuthMode] = useState<AuthMode>('public');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('credentials');
  const [loginUrl, setLoginUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showAdvancedAuth, setShowAdvancedAuth] = useState(false);
  const [usernameSelector, setUsernameSelector] = useState('');
  const [passwordSelector, setPasswordSelector] = useState('');
  const [submitSelector, setSubmitSelector] = useState('');
  const [successUrl, setSuccessUrl] = useState('');
  const [successSelector, setSuccessSelector] = useState('');
  const [failureSelector, setFailureSelector] = useState('');
  const [additionalWaitMs, setAdditionalWaitMs] = useState<number>(2000);
  const [authTest, setAuthTest] = useState<AuthTestState>({ status: 'idle' });
  const manualSessionId = useRef<string | null>(null);

  // ─── File Upload ────────────────────────────────────────────────────────────
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

  // ─── Authentication Test ────────────────────────────────────────────────────
  const handleTestAuth = async () => {
    if (!loginUrl.trim()) {
      setAuthTest({ status: 'failed', message: 'Please provide a Login URL.' });
      return;
    }

    setAuthTest({ status: 'testing' });

    try {
      const res = await fetch('/api/auth/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          authentication: {
            method: authMethod,
            loginUrl: loginUrl.trim(),
            username: username.trim(),
            password, // password sent over HTTPS to server; never stored
            usernameSelector: usernameSelector.trim() || undefined,
            passwordSelector: passwordSelector.trim() || undefined,
            submitSelector: submitSelector.trim() || undefined,
            successUrl: successUrl.trim() || undefined,
            successSelector: successSelector.trim() || undefined,
            failureSelector: failureSelector.trim() || undefined,
            additionalWaitMs,
          }
        })
      });

      const data = await res.json();

      if (data.success) {
        setAuthTest({
          status: 'success',
          testSessionId: data.testSessionId,
          finalUrl: data.finalUrl,
          logs: data.logs,
        });
      } else {
        setAuthTest({
          status: 'failed',
          errorCode: data.errorCode,
          message: data.errorMessage,
          logs: data.logs,
        });
      }
    } catch (err) {
      setAuthTest({
        status: 'failed',
        message: `Network error: ${(err as Error).message}`,
      });
    }
  };

  const handleOpenManualBrowser = async () => {
    if (!loginUrl.trim()) {
      setAuthTest({ status: 'failed', message: 'Please provide a Login URL first.' });
      return;
    }

    setAuthTest({ status: 'testing', message: 'Opening browser...' });

    try {
      const res = await fetch('/api/auth/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'open_manual',
          authentication: {
            method: 'manual',
            loginUrl: loginUrl.trim(),
            successUrl: successUrl.trim() || undefined,
            successSelector: successSelector.trim() || undefined,
          }
        })
      });

      const data = await res.json();
      if (data.success) {
        manualSessionId.current = data.sessionId;
        setAuthTest({
          status: 'manual_open',
          message: 'Browser opened. Please log in and click "I Have Finished Logging In" when done.',
        });
      } else {
        setAuthTest({ status: 'failed', message: data.error ?? 'Failed to open browser.' });
      }
    } catch (err) {
      setAuthTest({ status: 'failed', message: `Error: ${(err as Error).message}` });
    }
  };

  const handleConfirmManualLogin = async () => {
    const sessionId = manualSessionId.current;
    if (!sessionId) {
      setAuthTest({ status: 'failed', message: 'No active manual session. Please open the browser first.' });
      return;
    }

    setAuthTest({ status: 'testing', message: 'Verifying session...' });

    try {
      const res = await fetch('/api/auth/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm_manual',
          sessionId,
          authentication: {
            method: 'manual',
            loginUrl: loginUrl.trim(),
            successUrl: successUrl.trim() || undefined,
            successSelector: successSelector.trim() || undefined,
          }
        })
      });

      const data = await res.json();
      if (data.success) {
        setAuthTest({
          status: 'success',
          testSessionId: data.testSessionId,
          finalUrl: data.finalUrl,
        });
      } else {
        setAuthTest({
          status: 'failed',
          errorCode: data.errorCode,
          message: data.errorMessage,
        });
      }
    } catch (err) {
      setAuthTest({ status: 'failed', message: `Verification error: ${(err as Error).message}` });
    }
  };

  // ─── Form Submit ────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Validate auth if enabled
    if (authMode === 'login_required') {
      if (!loginUrl.trim()) {
        setErrorMsg('Authentication requires a Login URL.');
        return;
      }
      if (authMethod === 'credentials' && !username.trim()) {
        setErrorMsg('Please provide a username for credential authentication.');
        return;
      }
      if (authMethod === 'credentials' && !password) {
        setErrorMsg('Please provide a password for credential authentication.');
        return;
      }
      if (authMethod === 'credentials' && authTest.status !== 'success') {
        setErrorMsg('Please test authentication successfully before starting an authenticated audit.');
        return;
      }
    }

    let inputs: string[] = [];
    if (activeTab === 'urls') {
      inputs = urlsInput.split('\n').map((u) => u.trim()).filter(Boolean);
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

    let calculatedDomain: string;
    if (domain.trim()) {
      calculatedDomain = domain.trim();
    } else if (inputs.length === 1) {
      try {
        const u = new URL(inputs[0].startsWith('http') ? inputs[0] : `https://${inputs[0]}`);
        const slug = u.pathname && u.pathname !== '/' ? u.hostname + u.pathname : u.hostname;
        calculatedDomain = slug;
      } catch {
        calculatedDomain = inputs[0];
      }
    } else {
      try {
        calculatedDomain = new URL(inputs[0].startsWith('http') ? inputs[0] : `https://${inputs[0]}`).hostname;
      } catch {
        calculatedDomain = 'website.com';
      }
    }

    const calculatedSiteName = siteName.trim() || calculatedDomain;

    setIsSubmitting(true);

    try {
      // Build authentication payload (password only sent if using credentials)
      const authPayload = authMode === 'login_required'
        ? {
            method: authMethod,
            loginUrl: loginUrl.trim(),
            username: username.trim() || undefined,
            password: authMethod === 'credentials' ? password : undefined, // SECURITY: manual login has no password
            usernameSelector: usernameSelector.trim() || undefined,
            passwordSelector: passwordSelector.trim() || undefined,
            submitSelector: submitSelector.trim() || undefined,
            successUrl: successUrl.trim() || undefined,
            successSelector: successSelector.trim() || undefined,
            failureSelector: failureSelector.trim() || undefined,
            additionalWaitMs,
          }
        : null;

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
          apiKey,
          authentication: authPayload,
          testSessionId: authTest.testSessionId, // reuse authenticated session if available
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

  // ─── Helper: Auth status badge ──────────────────────────────────────────────
  const authStatusBadge = () => {
    if (authTest.status === 'idle') return null;
    if (authTest.status === 'testing') {
      return (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
          <span>{authTest.message ?? 'Authenticating...'}</span>
        </div>
      );
    }
    if (authTest.status === 'manual_open') {
      return (
        <div className="space-y-3">
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
            <MousePointerClick className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Browser opened — please log in manually</p>
              <p className="text-xs text-amber-400/80 mt-0.5">{authTest.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleConfirmManualLogin}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            I Have Finished Logging In
          </button>
        </div>
      );
    }
    if (authTest.status === 'success') {
      return (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm space-y-1">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Authentication Successful
          </div>
          <p className="text-xs text-emerald-400/80">Session established — ready to crawl authenticated pages.</p>
          {authTest.finalUrl && (
            <p className="text-xs text-slate-400 font-mono truncate">Landed on: {authTest.finalUrl}</p>
          )}
        </div>
      );
    }
    if (authTest.status === 'failed') {
      const errorMessages: Record<string, string> = {
        INVALID_CREDENTIALS: 'The username or password is incorrect.',
        LOGIN_URL_UNREACHABLE: 'The login URL could not be reached.',
        USERNAME_SELECTOR_NOT_FOUND: 'Could not find the username input field. Try a custom selector.',
        PASSWORD_SELECTOR_NOT_FOUND: 'Could not find the password input field. Try a custom selector.',
        SUBMIT_SELECTOR_NOT_FOUND: 'Could not find the submit button. Try a custom selector.',
        CAPTCHA_DETECTED: 'CAPTCHA detected — use Manual Browser Login instead.',
        TWO_FACTOR_DETECTED: '2FA/OTP required — use Manual Browser Login instead.',
        SSO_DETECTED: 'SSO/OAuth detected — use Manual Browser Login instead.',
        TIMEOUT: 'Login timed out. Check the URL and try again.',
        BROWSER_LAUNCH_FAILED: 'Could not launch browser. Check server configuration.',
      };
      const detail = authTest.errorCode ? errorMessages[authTest.errorCode] : null;
      return (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm space-y-1">
          <div className="flex items-center gap-2 font-semibold">
            <XCircle className="w-4 h-4 text-rose-400" />
            Authentication Failed
          </div>
          {detail && <p className="text-xs text-rose-400/80">{detail}</p>}
          {authTest.message && !detail && (
            <p className="text-xs text-rose-400/80">{authTest.message}</p>
          )}
        </div>
      );
    }
    return null;
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
        {/* ── 1. Audit Identification ── */}
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

        {/* ── 2. Input Methods ── */}
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

          {activeTab === 'urls' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">Target Webpage URLs (One URL per line)</label>
              <textarea
                rows={5}
                placeholder={"https://example.com/\nhttps://example.com/pricing\nhttps://example.com/features"}
                value={urlsInput}
                onChange={(e) => setUrlsInput(e.target.value)}
                className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 font-mono text-xs focus:outline-none focus:border-brand-500"
              />
            </div>
          )}

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

        {/* ── 3. Authentication ── */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-5">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-brand-400" />
            <h2 className="text-base font-bold text-white">3. Authentication</h2>
          </div>

          {/* Public / Login Required toggle */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => { setAuthMode('public'); setAuthTest({ status: 'idle' }); }}
              className={`flex items-center gap-3 p-4 rounded-xl border text-sm font-semibold transition-all ${
                authMode === 'public'
                  ? 'bg-brand-600/20 border-brand-500/60 text-brand-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${authMode === 'public' ? 'border-brand-400' : 'border-slate-600'}`}>
                {authMode === 'public' && <div className="w-2 h-2 rounded-full bg-brand-400" />}
              </div>
              <Unlock className="w-4 h-4 opacity-60" />
              Public Website
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('login_required')}
              className={`flex items-center gap-3 p-4 rounded-xl border text-sm font-semibold transition-all ${
                authMode === 'login_required'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${authMode === 'login_required' ? 'border-amber-400' : 'border-slate-600'}`}>
                {authMode === 'login_required' && <div className="w-2 h-2 rounded-full bg-amber-400" />}
              </div>
              <Lock className="w-4 h-4 opacity-60" />
              Login Required
            </button>
          </div>

          {/* Auth config section (only visible when Login Required) */}
          {authMode === 'login_required' && (
            <div className="space-y-5 pt-1">
              {/* Authentication Method */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">Authentication Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAuthMethod('credentials')}
                    className={`p-3 rounded-xl border text-xs font-semibold transition-all flex items-center gap-2 ${
                      authMethod === 'credentials'
                        ? 'bg-brand-600/20 border-brand-500/60 text-brand-300'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Username &amp; Password
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMethod('manual')}
                    className={`p-3 rounded-xl border text-xs font-semibold transition-all flex items-center gap-2 ${
                      authMethod === 'manual'
                        ? 'bg-brand-600/20 border-brand-500/60 text-brand-300'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <MousePointerClick className="w-3.5 h-3.5" />
                    Manual Browser Login
                  </button>
                </div>
                {authMethod === 'manual' && (
                  <p className="text-[11px] text-slate-500 pt-1">
                    Use this for SSO, Google OAuth, Microsoft login, CAPTCHA, OTP, or 2FA authentication.
                    A browser window will open for you to log in manually.
                  </p>
                )}
              </div>

              {/* Login URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Login URL <span className="text-rose-400">*</span></label>
                <input
                  type="url"
                  placeholder="https://example.com/login"
                  value={loginUrl}
                  onChange={(e) => setLoginUrl(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-brand-500 font-mono"
                />
              </div>

              {/* Credentials (only for credentials method) */}
              {authMethod === 'credentials' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Username / Email <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      placeholder="your@email.com"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="off"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Password <span className="text-rose-400">*</span></label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        className="w-full px-4 py-2.5 pr-10 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-brand-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Test / Manual login buttons */}
              <div className="space-y-3">
                {authMethod === 'credentials' && (
                  <button
                    type="button"
                    onClick={handleTestAuth}
                    disabled={authTest.status === 'testing'}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {authTest.status === 'testing' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                    Test Authentication
                  </button>
                )}

                {authMethod === 'manual' && authTest.status !== 'manual_open' && (
                  <button
                    type="button"
                    onClick={handleOpenManualBrowser}
                    disabled={authTest.status === 'testing'}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {authTest.status === 'testing' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <MousePointerClick className="w-4 h-4" />
                    )}
                    Open Browser for Manual Login
                  </button>
                )}

                {/* Auth status badge */}
                {authStatusBadge()}
              </div>

              {/* Advanced Authentication Options */}
              <div className="border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAdvancedAuth(!showAdvancedAuth)}
                  className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 font-semibold transition-colors"
                >
                  {showAdvancedAuth ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  Advanced Authentication Options
                  <span className="text-slate-600">(custom selectors, success/failure patterns)</span>
                </button>

                {showAdvancedAuth && (
                  <div className="mt-4 space-y-4">
                    <p className="text-[11px] text-slate-500">
                      Leave blank to use automatic detection. Only fill these if the automatic login fails.
                    </p>

                    {authMethod === 'credentials' && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Username Selector</label>
                          <input
                            type="text"
                            placeholder='input[name="email"]'
                            value={usernameSelector}
                            onChange={(e) => setUsernameSelector(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-brand-500 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Password Selector</label>
                          <input
                            type="text"
                            placeholder='input[type="password"]'
                            value={passwordSelector}
                            onChange={(e) => setPasswordSelector(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-brand-500 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Submit Selector</label>
                          <input
                            type="text"
                            placeholder='button[type="submit"]'
                            value={submitSelector}
                            onChange={(e) => setSubmitSelector(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-brand-500 font-mono"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Auth Success URL / Pattern</label>
                        <input
                          type="text"
                          placeholder="/dashboard"
                          value={successUrl}
                          onChange={(e) => setSuccessUrl(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-brand-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Auth Success Selector</label>
                        <input
                          type="text"
                          placeholder=".user-avatar"
                          value={successSelector}
                          onChange={(e) => setSuccessSelector(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-brand-500 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Failure Selector (optional)</label>
                        <input
                          type="text"
                          placeholder=".error-message"
                          value={failureSelector}
                          onChange={(e) => setFailureSelector(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-brand-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Additional Wait (ms)</label>
                        <input
                          type="number"
                          min={0}
                          max={10000}
                          step={500}
                          value={additionalWaitMs}
                          onChange={(e) => setAdditionalWaitMs(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-brand-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Security notice */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/40 text-xs text-slate-500 flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-500" />
                <span>
                  Credentials are transmitted securely and held in server memory only for the duration of this audit.
                  Passwords are never stored in the database, logs, or reports.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── 4. Advanced Audit Parameters ── */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-brand-400" />
            <h2 className="text-base font-bold text-white">4. Advanced Audit Parameters</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Max Pages Limit</label>
              <input
                type="number"
                min={1}
                max={500}
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
                max={10}
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

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-brand-600 to-cyan-500 hover:from-brand-500 hover:to-cyan-400 text-white font-bold text-base shadow-xl shadow-brand-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Launching Audit Processor...
            </>
          ) : (
            <>
              {authMode === 'login_required' ? (
                <Lock className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 fill-current" />
              )}
              {authMode === 'login_required' ? 'Launch Authenticated Audit' : 'Launch Website Audit Execution'}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
