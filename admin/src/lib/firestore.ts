import {
  collection,
  doc,
  deleteDoc,
  setDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
  getDoc,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from './firebase';

export type ReportStatus = 'pending' | 'resolved' | 'dismissed';

export interface Report {
  reportId: string;
  postId: string;
  userId: string;
  reporterId: string;
  reason: string;
  timestamp: Date;
  status: ReportStatus;
  postContent?: string;
  postImageUrl?: string;
  postVideoUrl?: string;
}

export interface Post {
  postId: string;
  userId: string;
  content?: string;
  imageUrl?: string;
  videoUrl?: string;
  createdAt: Date;
}

export interface BannedUser {
  userId: string;
  bannedAt: Date;
  bannedBy: string;
  reason: string;
}

export interface AdminLog {
  action: 'DELETE_POST' | 'BAN_USER' | 'RESOLVE_REPORT' | 'DISMISS_REPORT' | 'UNBAN_USER';
  targetId: string;
  adminEmail: string;
  timestamp: Date;
  details?: string;
}

export async function deletePost(postId: string, adminEmail: string, reportId?: string) {
  await deleteDoc(doc(db, 'posts', postId));
  await logAdminAction({
    action: 'DELETE_POST',
    targetId: postId,
    adminEmail,
    details: reportId ? `From report ${reportId}` : undefined,
  });
}

export async function banUser(userId: string, adminEmail: string, reason: string) {
  await setDoc(doc(db, 'bannedUsers', userId), {
    userId,
    bannedAt: serverTimestamp(),
    bannedBy: adminEmail,
    reason,
  });
  await logAdminAction({
    action: 'BAN_USER',
    targetId: userId,
    adminEmail,
    details: reason,
  });
}

export async function unbanUser(userId: string, adminEmail: string) {
  await deleteDoc(doc(db, 'bannedUsers', userId));
  await logAdminAction({
    action: 'UNBAN_USER',
    targetId: userId,
    adminEmail,
  });
}

export async function resolveReport(reportId: string, adminEmail: string) {
  await updateDoc(doc(db, 'reports', reportId), {
    status: 'resolved',
    resolvedAt: serverTimestamp(),
    resolvedBy: adminEmail,
  });
  await logAdminAction({
    action: 'RESOLVE_REPORT',
    targetId: reportId,
    adminEmail,
  });
}

export async function dismissReport(reportId: string, adminEmail: string) {
  await updateDoc(doc(db, 'reports', reportId), {
    status: 'dismissed',
    resolvedAt: serverTimestamp(),
    resolvedBy: adminEmail,
  });
  await logAdminAction({
    action: 'DISMISS_REPORT',
    targetId: reportId,
    adminEmail,
  });
}

export async function isUserBanned(userId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'bannedUsers', userId));
  return snap.exists();
}

export async function getPost(postId: string): Promise<Post | null> {
  const snap = await getDoc(doc(db, 'posts', postId));
  if (!snap.exists()) return null;
  return { postId: snap.id, ...snap.data() } as Post;
}

export async function getBannedUsers(): Promise<BannedUser[]> {
  const snap = await getDocs(collection(db, 'bannedUsers'));
  return snap.docs.map((d) => ({ ...d.data() } as BannedUser));
}

async function logAdminAction(log: Omit<AdminLog, 'timestamp'>) {
  await addDoc(collection(db, 'adminLogs'), {
    ...log,
    timestamp: serverTimestamp(),
  });
}
