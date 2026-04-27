'use client';

import { useState, useEffect } from 'react';
import { Users, Ban, CheckCircle, Search, AlertTriangle } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { banUser, unbanUser } from '@/lib/firestore';
import ConfirmModal from '@/components/ConfirmModal';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

interface BannedUserRecord {
  userId: string;
  bannedAt: Date;
  bannedBy: string;
  reason: string;
}

type ModalAction = { type: 'unban'; userId: string } | null;

export default function UsersPage() {
  const { user } = useAuth();
  const [bannedUsers, setBannedUsers] = useState<BannedUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalAction>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'bannedUsers'), orderBy('bannedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setBannedUsers(
        snap.docs.map((d) => ({
          userId: d.id,
          ...d.data(),
          bannedAt: d.data().bannedAt?.toDate?.() ?? new Date(),
        })) as BannedUserRecord[]
      );
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered = bannedUsers.filter((u) =>
    !search || u.userId.toLowerCase().includes(search.toLowerCase())
  );

  async function handleUnban() {
    if (!modal || modal.type !== 'unban') return;
    setActionLoading(true);
    try {
      await unbanUser(modal.userId, user?.email ?? '');
      toast.success('User unbanned');
      setModal(null);
    } catch {
      toast.error('Failed to unban user');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users size={22} className="text-neon-green" />
            Users
          </h1>
          <p className="text-slate-400 text-sm mt-1">Manage banned users</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2 text-sm">
          <span className="text-red-400 font-bold">{bannedUsers.length}</span>
          <span className="text-slate-400 ml-1">active ban{bannedUsers.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3 mb-6">
        <AlertTriangle size={16} className="text-yellow-400 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-slate-300">
          Banned users are blocked from posting and will not appear in any feeds. The app checks the{' '}
          <code className="text-neon-green bg-navy-700 px-1 rounded text-xs">bannedUsers</code> collection on every post attempt.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by user ID…"
          className="w-full bg-navy-700 border border-navy-400 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-neon-green focus:ring-1 focus:ring-neon-green transition-colors"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-neon-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-navy-700 border border-navy-400 flex items-center justify-center mb-4">
            <Users size={28} className="text-slate-600" />
          </div>
          <p className="text-white font-semibold">No banned users</p>
          <p className="text-slate-500 text-sm mt-1">
            {search ? 'No users match your search' : 'No users have been banned yet'}
          </p>
        </div>
      ) : (
        <div className="bg-navy-700 border border-navy-400 rounded-2xl overflow-hidden">
          <table className="w-full admin-table">
            <thead>
              <tr>
                <th className="text-left">User ID</th>
                <th className="text-left">Ban Reason</th>
                <th className="text-left">Banned By</th>
                <th className="text-left">Date</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.userId}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                        <Ban size={12} className="text-red-400" />
                      </div>
                      <span className="font-mono text-xs text-slate-200">{u.userId}</span>
                    </div>
                  </td>
                  <td>
                    <p className="text-sm text-slate-300 max-w-xs line-clamp-2">{u.reason}</p>
                  </td>
                  <td>
                    <p className="text-xs text-slate-400">{u.bannedBy}</p>
                  </td>
                  <td>
                    <p className="text-xs text-slate-500">
                      {formatDistanceToNow(u.bannedAt, { addSuffix: true })}
                    </p>
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => setModal({ type: 'unban', userId: u.userId })}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neon-green/10 border border-neon-green/30 text-neon-green text-xs font-semibold hover:bg-neon-green/20 transition-colors"
                    >
                      <CheckCircle size={12} />
                      Unban
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={modal?.type === 'unban'}
        title="Unban User"
        message={`Remove the ban for user "${modal?.userId ?? ''}"? They will be able to post again immediately.`}
        confirmLabel="Unban User"
        loading={actionLoading}
        onConfirm={handleUnban}
        onCancel={() => setModal(null)}
      />
    </div>
  );
}
