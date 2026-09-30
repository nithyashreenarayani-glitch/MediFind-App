"use client";

import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";

export default function AdminDashboardPage() {
  return <ProtectedRoute roles={["ADMIN"]}><main className="dashboard-shell"><header className="dashboard-header"><Link href="/" className="brand"><span className="brand-mark">m</span><span>MediFind</span></Link></header><section className="dashboard-content"><span className="eyebrow">ADMINISTRATION</span><h1 className="dashboard-title">Platform workspace</h1><p className="auth-muted">Admin access is reserved for accounts provisioned through trusted server-side tooling.</p></section></main></ProtectedRoute>;
}
