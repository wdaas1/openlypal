'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  where,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Report, ReportStatus } from '@/lib/firestore';

export function useReports(statusFilter: ReportStatus | 'all' = 'all') {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const constraints: QueryConstraint[] = [orderBy('timestamp', 'desc')];
    if (statusFilter !== 'all') {
      constraints.unshift(where('status', '==', statusFilter));
    }

    const q = query(collection(db, 'reports'), ...constraints);
    const unsub = onSnapshot(q, (snap) => {
      const data: Report[] = snap.docs.map((d) => ({
        reportId: d.id,
        ...d.data(),
        timestamp: d.data().timestamp?.toDate?.() ?? new Date(),
      })) as Report[];
      setReports(data);
      setLoading(false);
    });

    return unsub;
  }, [statusFilter]);

  return { reports, loading };
}

export function useReportStats() {
  const [stats, setStats] = useState({ pending: 0, resolved: 0, dismissed: 0, total: 0 });

  useEffect(() => {
    const q = query(collection(db, 'reports'));
    const unsub = onSnapshot(q, (snap) => {
      const counts = { pending: 0, resolved: 0, dismissed: 0, total: snap.size };
      snap.docs.forEach((d) => {
        const status = d.data().status as ReportStatus;
        if (status in counts) counts[status]++;
      });
      setStats(counts);
    });
    return unsub;
  }, []);

  return stats;
}

export function useBannedUsers() {
  const [bannedUsers, setBannedUsers] = useState<string[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'bannedUsers'), (snap) => {
      setBannedUsers(snap.docs.map((d) => d.id));
    });
    return unsub;
  }, []);

  return bannedUsers;
}
