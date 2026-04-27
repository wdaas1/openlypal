'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Flag, Users, Shield, LogOut, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useReportStats } from '@/hooks/useReports';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/reports', label: 'Reports', icon: Flag, badge: true },
  { href: '/dashboard/users', label: 'Users', icon: Users },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const stats = useReportStats();

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <aside className="w-64 flex-shrink-0 bg-navy-700 border-r border-navy-400 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-navy-400">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-neon-green-dim border border-neon-green/30 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#00ff88" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="3.5" fill="#00ff88" />
              <path d="M2 12h20M12 2C9 5 9 19 12 22M12 2C15 5 15 19 12 22" stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">Openly</p>
            <p className="text-neon-green text-xs font-medium mt-0.5">Admin Panel</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, badge, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                active
                  ? 'bg-neon-green-dim text-neon-green border border-neon-green/20'
                  : 'text-slate-400 hover:text-white hover:bg-navy-500'
              }`}
            >
              <Icon size={18} className={active ? 'text-neon-green' : 'text-slate-500 group-hover:text-slate-300'} />
              <span className="flex-1">{label}</span>
              {badge && stats.pending > 0 && (
                <span className="bg-neon-green text-navy-900 text-xs font-bold px-2 py-0.5 rounded-full">
                  {stats.pending}
                </span>
              )}
              {active && <ChevronRight size={14} className="text-neon-green opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* Admin Security label */}
      <div className="px-3 py-3 mx-3 mb-2 rounded-xl bg-navy-800 border border-navy-400">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-neon-green flex-shrink-0" />
          <p className="text-xs text-slate-400 leading-tight">Admin only · Secure access</p>
        </div>
      </div>

      {/* User */}
      <div className="px-4 py-4 border-t border-navy-400">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-navy-500 border border-neon-green/30 flex items-center justify-center flex-shrink-0">
            <span className="text-neon-green text-xs font-bold uppercase">
              {user?.email?.[0] ?? 'A'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{user?.email}</p>
            <p className="text-slate-500 text-xs">Administrator</p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="text-slate-500 hover:text-red-400 transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
