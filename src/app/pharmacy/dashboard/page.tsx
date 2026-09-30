"use client";

import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";

export default function PharmacyDashboardPage() {
  return <ProtectedRoute roles={["PHARMACY"]}><main className="dashboard-shell"><header className="dashboard-header"><Link href="/" className="brand"><span className="brand-mark">m</span><span>MediFind</span></Link><Link className="nav-login" href="/">Home</Link></header><section className="dashboard-content"><span className="eyebrow">PHARMACY ACCOUNT</span><h1 className="dashboard-title">Your pharmacy workspace</h1><p className="auth-muted">Your account is set up. Pharmacy profile approval, inventory, and reservations are part of a later phase.</p><div className="phase-note"><strong>Account role</strong><p>Pharmacy access is not the same as approval to publish inventory. Approval workflows will be added before pharmacy listings become visible.</p></div></section></main></ProtectedRoute>;
}
