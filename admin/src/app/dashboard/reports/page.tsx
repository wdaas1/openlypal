'use client';

import { useState, useMemo } from 'react';
import { Search, Filter, RefreshCw, Flag } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useReports, useBannedUsers } from '@/hooks/useReports';
import ReportCard from '@/components/ReportCard';
import type { ReportStatus } from '@/lib/firestore';

type StatusFilter = ReportStatus | 'all';

export default function ReportsPage() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [search, setSearch] = useState('');
  const { reports, loading } = useReports(statusFilter);
  const bannedUsers = useBannedUsers();

  const filtered = useMemo(() => {
    if (!search.trim()) return reports;
    const q = search.toLowerCase();
    return reports.filter(
      (r) =>
        r.userId.toLowerCase().includes(q) ||
        r.postId.toLowerCase().includes(q) ||
        r.reporterId.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q)
    );
  }, [reports, search]);

  const tabs: { label: string; value: StatusFilter; color: string }[] = [
    { label: 'Pending', value: 'pending', color: 'text-yellow-400' },
    { label: 'Resolved', value: 'resolved', color: 'text-neon-green' },
    { label: 'Dismissed', value: 'dismissed', color: 'text-slate-400' },
    { label: 'All', value: 'all', color: 'text-blue-400' },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Flag size={22} className="text-neon-green" />
            Reports
          </h1>
          <p className="text-slate-400 text-sm mt-1">Real-time moderation queue</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-neon-green bg-neon-green-dim border border-neon-green/20 px-3 py-2 rounded-lg">
          <RefreshCw size={12} className="animate-spin" style={{ animationDuration: '3s' }} />
          Live updates
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-navy-700 border border-navy-400 rounded-xl p-1 mb-5 w-fit">
        {tabs.map(({ label, value, color }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              statusFilter === value
                ? 'bg-navy-500 text-white shadow-sm'
                : `${color} hover:text-white`
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by user ID, post ID, reporter or reason…"
          className="w-full bg-navy-700 border border-navy-400 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-neon-green focus:ring-1 focus:ring-neon-green transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            <Filter size={14} />
          </button>
        )}
      </div>

      {/* Results count */}
      {!loading && (
        <p className="text-slate-500 text-xs mb-4">
          Showing {filtered.length} report{filtered.length !== 1 ? 's' : ''}
          {search && ` matching "${search}"`}
        </p>
      )}

      {/* Report cards */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-neon-green border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-500 text-sm">Loading reports…</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-navy-700 border border-navy-400 flex items-center justify-center mb-4">
            <Flag size={28} className="text-slate-600" />
          </div>
          <p className="text-white font-semibold">No reports found</p>
          <p className="text-slate-500 text-sm mt-1">
            {search ? 'Try a different search term' : `No ${statusFilter === 'all' ? '' : statusFilter + ' '}reports`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtered.map((report) => (
            <ReportCard
              key={report.reportId}
              report={report}
              adminEmail={user?.email ?? ''}
              isBanned={bannedUsers.includes(report.userId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
