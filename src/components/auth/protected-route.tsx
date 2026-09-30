"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import type { UserRole } from "@/types/auth";

export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: UserRole[] }) {
  const { user, profile, loading, configured } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (!configured) return <AuthMessage title="Connect Firebase to continue" text="Add your Firebase web app settings to .env.local, then restart the development server." />;
  if (loading) return <AuthLoading />;
  if (!user) return <AuthLoading />;
  if (!profile) return <AuthMessage title="Profile unavailable" text="We couldn't load your account profile. Please log in again or contact support." />;
  if (profile.isDisabled) return <AuthMessage title="Account unavailable" text="This account has been disabled. Contact support if you think this is a mistake." />;
  if (roles && !roles.includes(profile.role)) return <AuthMessage title="You don't have access to this page" text="Log in with an account that has the appropriate access." />;
  return <>{children}</>;
}

export function AuthLoading() {
  return <main className="auth-shell"><div className="auth-panel"><div className="auth-spinner" aria-label="Loading" /><p className="auth-muted">Checking your account…</p></div></main>;
}

export function AuthMessage({ title, text }: { title: string; text: string }) {
  return <main className="auth-shell"><div className="auth-panel"><Link className="brand auth-brand" href="/"><span className="brand-mark">m</span><span>MediFind</span></Link><h1 className="auth-title">{title}</h1><p className="auth-muted">{text}</p><Link className="button auth-submit" href="/">Back to home</Link></div></main>;
}
