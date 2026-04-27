'use client';

import { useEffect, useState } from 'react';
import { Flag, Users, CheckCircle, Clock, Shield, Activity, XCircle } from 'lucide-react';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useReportStats, useBannedUsers } from '@/hooks/useReports';
import StatsCard from '@/components/StatsCard';
import { formatDistanceToNow } from 'date-fns';

interface AdminLogEntry {
  id: string;
  action: string;
  targetId: string;
  adminEmail: string;
  timestamp: Date;
  details?: string;
}

const actionLabels: Record<string, { label: string; color: string }> = {
  DELETE_POST: { label: 'Deleted post', color: 'text-red-400' },
  BAN_USER: { label: 'Banned user', color: 'text-orange-400' },
  RESOLVE_REPORT: { label: 'Resolved report', color: 'text-neon-green' },
  DISMISS_REPORT: { label: 'Dismissed report', color: 'text-slate-400' },
  UNBAN_USER: { label: 'Unbanned user', color: 'text-blue-400' },
};

export default function DashboardPage() {
  const { user } = useAuth();
  const stats = useReportStats();
  const bannedUsers = useBannedUsers();
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'adminLogs'), orderBy('timestamp', 'desc'), limit(20));
    const unsub = onSnapshot(q, (snap) => {
      setLogs(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          timestamp: d.data().timestamp?.toDate?.() ?? new Date(),
        })) as AdminLogEntry[]
      );
    });
    return unsub;
  }, []);

  const resolutionRate =
    stats.total > 0 ? Math.round(((stats.resolved + stats.dismissed) / stats.total) * 100) : 0;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">
          Welcome back, {user?.email} · Real-time moderation overview
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          label="Pending Reports"
          value={stats.pending}
          icon={Clock}
          color="yellow"
          description="Awaiting action"
        />
        <StatsCard
          label="Resolved Reports"
          value={stats.resolved}
          icon={CheckCircle}
          color="green"
          description="All time"
        />
        <StatsCard
          label="Banned Users"
          value={bannedUsers.length}
          icon={Users}
          color="red"
          description="Active bans"
        />
        <StatsCard
          label="Total Reports"
          value={stats.total}
          icon={Flag}
          color="blue"
          description={`${resolutionRate}% resolution rate`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance panel */}
        <div className="bg-navy-700 border border-navy-400 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={18} className="text-neon-green" />
            <h2 className="text-white font-semibold">Compliance Status</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Content Reporting', status: true, note: 'Active — users can report content' },
              { label: 'Content Removal', status: true, note: 'Admin can delete posts' },
              { label: 'User Banning', status: true, note: 'Banned users blocked from posting' },
              { label: 'Real-time Monitoring', status: true, note: 'Live Firestore updates' },
              { label: '24-hr Response Target', status: stats.pending === 0, note: stats.pending > 0 ? `${stats.pending} reports need action` : 'No pending reports' },
            ].map(({ label, status, note }) => (
              <div key={label} className="flex items-start gap-3">
                {status ? (
                  <CheckCircle size={16} className="text-neon-green mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle size={16} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <p className="text-white text-sm font-medium">{label}</p>
                  <p className="text-slate-500 text-xs">{note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-navy-700 border border-navy-400 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={18} className="text-neon-green" />
            <h2 className="text-white font-semibold">Recent Admin Actions</h2>
          </div>
          {logs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500 text-sm">No admin actions yet</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {logs.map((log) => {
                const info = actionLabels[log.action] ?? { label: log.action, color: 'text-slate-300' };
                return (
                  <div key={log.id} className="flex items-start gap-3 py-2 border-b border-navy-600 last:border-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-neon-green mt-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200">
                        <span className={`font-medium ${info.color}`}>{info.label}</span>{' '}
                        <span className="font-mono text-xs text-slate-400 truncate">{log.targetId}</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {log.adminEmail} · {formatDistanceToNow(log.timestamp, { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
