'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Trash2, Ban, CheckCircle, XCircle, ExternalLink, User, Clock } from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import ConfirmModal from './ConfirmModal';
import { deletePost, banUser, resolveReport, dismissReport } from '@/lib/firestore';
import type { Report } from '@/lib/firestore';

interface ReportCardProps {
  report: Report;
  adminEmail: string;
  isBanned: boolean;
}

type ModalState = null | 'delete' | 'ban' | 'resolve' | 'dismiss';

export default function ReportCard({ report, adminEmail, isBanned }: ReportCardProps) {
  const [modal, setModal] = useState<ModalState>(null);
  const [loading, setLoading] = useState(false);

  const isResolved = report.status !== 'pending';

  async function handleAction() {
    setLoading(true);
    try {
      switch (modal) {
        case 'delete':
          await deletePost(report.postId, adminEmail, report.reportId);
          toast.success('Post deleted');
          break;
        case 'ban':
          await banUser(report.userId, adminEmail, report.reason);
          toast.success('User banned');
          break;
        case 'resolve':
          await resolveReport(report.reportId, adminEmail);
          toast.success('Report resolved');
          break;
        case 'dismiss':
          await dismissReport(report.reportId, adminEmail);
          toast('Report dismissed', { icon: '👋' });
          break;
      }
      setModal(null);
    } catch (err) {
      toast.error('Action failed. Check console.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const modalConfig = {
    delete: {
      title: 'Delete Post',
      message: `This will permanently remove post "${report.postId}" from Openly. This action cannot be undone.`,
      confirmLabel: 'Delete Post',
      danger: true,
    },
    ban: {
      title: 'Ban User',
      message: `This will ban user "${report.userId}" from posting on Openly. They will be added to the banned users list immediately.`,
      confirmLabel: 'Ban User',
      danger: true,
    },
    resolve: {
      title: 'Mark as Resolved',
      message: 'Mark this report as resolved. No further action will be taken.',
      confirmLabel: 'Resolve',
      danger: false,
    },
    dismiss: {
      title: 'Dismiss Report',
      message: 'Dismiss this report. It will be marked as dismissed with no action taken.',
      confirmLabel: 'Dismiss',
      danger: false,
    },
  };

  return (
    <>
      <div className={`bg-navy-700 border rounded-2xl overflow-hidden transition-all ${
        isResolved ? 'border-navy-400 opacity-75' : 'border-navy-400 hover:border-neon-green/30'
      }`}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-navy-600 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-navy-500 border border-navy-300 flex items-center justify-center flex-shrink-0">
              <User size={14} className="text-slate-400" />
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">
                User: <span className="text-slate-300 font-mono text-xs">{report.userId}</span>
              </p>
              <p className="text-slate-500 text-xs truncate">
                Reporter: <span className="font-mono">{report.reporterId}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isBanned && (
              <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold px-2 py-1 rounded-full">
                BANNED
              </span>
            )}
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
              report.status === 'pending' ? 'badge-pending'
                : report.status === 'resolved' ? 'badge-resolved'
                : 'badge-dismissed'
            }`}>
              {report.status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Content preview */}
        <div className="px-5 py-4">
          {/* Post media */}
          {report.postImageUrl && (
            <div className="mb-3 rounded-xl overflow-hidden border border-navy-400 max-h-48 relative">
              <Image
                src={report.postImageUrl}
                alt="Post image"
                width={400}
                height={200}
                className="w-full h-full object-cover"
                unoptimized
              />
            </div>
          )}
          {report.postVideoUrl && (
            <div className="mb-3 rounded-xl overflow-hidden border border-navy-400">
              <video src={report.postVideoUrl} controls className="w-full max-h-48" />
            </div>
          )}

          {/* Post text */}
          {report.postContent && (
            <div className="mb-3 bg-navy-800 rounded-xl px-4 py-3 border border-navy-400">
              <p className="text-sm text-slate-300 text-xs text-slate-500 mb-1 uppercase tracking-wide font-semibold">
                Post Content
              </p>
              <p className="text-white text-sm leading-relaxed line-clamp-3">{report.postContent}</p>
            </div>
          )}

          {/* Report reason */}
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3">
            <p className="text-yellow-400 text-xs font-semibold uppercase tracking-wide mb-1">Report Reason</p>
            <p className="text-slate-200 text-sm">{report.reason}</p>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <Clock size={12} />
              <span>{formatDistanceToNow(report.timestamp, { addSuffix: true })}</span>
            </div>
            <div className="flex items-center gap-1">
              <ExternalLink size={12} />
              <span className="font-mono truncate max-w-32">Post: {report.postId}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        {!isResolved && (
          <div className="px-5 py-4 border-t border-navy-600 flex flex-wrap gap-2">
            <button
              onClick={() => setModal('delete')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-colors"
            >
              <Trash2 size={13} />
              Delete Post
            </button>
            <button
              onClick={() => setModal('ban')}
              disabled={isBanned}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-semibold hover:bg-orange-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Ban size={13} />
              {isBanned ? 'Already Banned' : 'Ban User'}
            </button>
            <button
              onClick={() => setModal('resolve')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neon-green/10 border border-neon-green/30 text-neon-green text-xs font-semibold hover:bg-neon-green/20 transition-colors"
            >
              <CheckCircle size={13} />
              Resolve
            </button>
            <button
              onClick={() => setModal('dismiss')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-500/10 border border-slate-500/30 text-slate-400 text-xs font-semibold hover:bg-slate-500/20 transition-colors"
            >
              <XCircle size={13} />
              Dismiss
            </button>
          </div>
        )}
      </div>

      {modal && (
        <ConfirmModal
          open
          {...modalConfig[modal]}
          loading={loading}
          onConfirm={handleAction}
          onCancel={() => setModal(null)}
        />
      )}
    </>
  );
}
