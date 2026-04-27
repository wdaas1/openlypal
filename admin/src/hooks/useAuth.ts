'use client';

import { useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAdmin(!!u && (ADMIN_EMAILS.length === 0 || ADMIN_EMAILS.includes(u.email?.toLowerCase() ?? '')));
      setLoading(false);
    });
    return unsub;
  }, []);

  async function login(email: string, password: string) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const adminCheck = ADMIN_EMAILS.length === 0 || ADMIN_EMAILS.includes(cred.user.email?.toLowerCase() ?? '');
    if (!adminCheck) {
      await signOut(auth);
      throw new Error('Access denied: not an admin account');
    }
  }

  async function logout() {
    await signOut(auth);
  }

  return { user, loading, isAdmin, login, logout };
}
