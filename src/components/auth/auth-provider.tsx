"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase/client";
import type { UserProfile } from "@/types/auth";

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  configured: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth || !db) {
      setLoading(false);
      return;
    }

    let latestUid: string | null = null;
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      latestUid = nextUser?.uid ?? null;
      setUser(nextUser);
      setProfile(null);
      if (nextUser) {
        try {
          const snapshot = await getDoc(doc(db, "users", nextUser.uid));
          if (latestUid === nextUser.uid && snapshot.exists()) setProfile({ uid: snapshot.id, ...snapshot.data() } as UserProfile);
        } catch {
          // Route guards handle a missing/unreadable profile without exposing backend details.
        }
      }
      if (latestUid === (nextUser?.uid ?? null)) setLoading(false);
    });
    return () => {
      latestUid = null;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(() => ({
    user,
    profile,
    loading,
    configured: isFirebaseConfigured,
    refreshProfile: async () => {
      if (!user || !db) return;
      const snapshot = await getDoc(doc(db, "users", user.uid));
      setProfile(snapshot.exists() ? { uid: snapshot.id, ...snapshot.data() } as UserProfile : null);
    },
  }), [user, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
