'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShieldAlert,
  PlusCircle,
  History,
  GitCompare,
  Settings,
  LayoutDashboard,
  LogOut,
  User as UserIcon,
  Clock
} from 'lucide-react';

interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (isAuthPage) {
      setUser(null);
      return;
    }

    // Fetch current user details
    fetch('/api/auth/me')
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
        }
      })
      .catch(() => {});
  }, [pathname, isAuthPage]);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      router.push('/login');
      router.refresh();
    } catch {
      router.push('/login');
    } finally {
      setLoggingOut(false);
    }
  };

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'New Audit', href: '/audits/new', icon: PlusCircle },
    { name: 'Audit History', href: '/audits/history', icon: History },
    { name: 'Compare', href: '/compare', icon: GitCompare },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-800/80 px-4 sm:px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-400 p-0.5 flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <span className="text-xl font-bold bg-gradient-to-r from-white via-slate-200 to-cyan-400 bg-clip-text text-transparent">
              Tangence
            </span>
            <span className="block text-[10px] tracking-wider text-slate-400 uppercase font-semibold">
              Audit Tool
            </span>
          </div>
        </Link>

        {/* Minimal header links for auth pages */}
        {isAuthPage ? (
          <div className="flex items-center gap-3">
            {pathname === '/login' ? (
              <Link
                href="/signup"
                className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-800 transition-all hover:border-slate-700"
              >
                Create Account
              </Link>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-800 transition-all hover:border-slate-700"
              >
                Sign In
              </Link>
            )}
          </div>
        ) : (
          /* Authenticated Dashboard Navigation */
          <div className="flex items-center gap-2 sm:gap-4">
            <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1.5 rounded-xl border border-slate-800">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20 font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* User Profile & 12h Session Badge & Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              {user && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-brand-600 to-cyan-500 flex items-center justify-center text-white text-[10px] font-bold">
                    {(user.name || user.email)[0].toUpperCase()}
                  </div>
                  <span className="max-w-[120px] truncate font-medium">
                    {user.name || user.email.split('@')[0]}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] text-cyan-400 font-mono bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40" title="12-hour session active">
                    <Clock className="w-3 h-3" />
                    <span>12h</span>
                  </div>
                </div>
              )}

              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-400 bg-rose-950/30 hover:bg-rose-900/50 border border-rose-900/50 transition-all hover:scale-[1.02] focus:outline-none"
                title="Log out of the audit tool"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
