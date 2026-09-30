"use client";

import Link from "next/link";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/components/auth/auth-provider";
import { auth } from "@/lib/firebase/client";

export default function UserDashboardPage() {
  return <ProtectedRoute roles={["USER"]}><DashboardContent /></ProtectedRoute>;
}

function DashboardContent() {
  const { profile } = useAuth();
  const router = useRouter();
  async function logout() {
    if (auth) await signOut(auth);
    router.replace("/");
  }
  return <main className="dashboard-shell"><header className="dashboard-header"><Link href="/" className="brand"><span className="brand-mark">m</span><span>MediFind</span></Link><button className="button button-small" onClick={logout}>Log out</button></header><section className="dashboard-content"><span className="eyebrow">YOUR ACCOUNT</span><h1 className="dashboard-title">Hello, {profile?.name || "there"}.</h1><p className="auth-muted">Your MediFind account is ready. Search for a medicine to get started.</p><Link className="button dashboard-cta" href="/search">Find a medicine →</Link><div className="phase-note"><strong>Next up</strong><p>Medicine search, reservations, and notifications will appear here as those features are added.</p></div></section></main>;
}
