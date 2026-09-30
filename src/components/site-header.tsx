"use client";

import Link from "next/link";
import { signOut } from "firebase/auth";
import { ArrowRight, Menu, Search, UserRound, X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { auth } from "@/lib/firebase/client";

export function SiteHeader() {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  async function logout() {
    if (auth) await signOut(auth);
    setOpen(false);
    router.push("/");
  }
  const dashboard = profile?.role === "PHARMACY" ? "/pharmacy/dashboard" : profile?.role === "ADMIN" ? "/admin/dashboard" : "/dashboard";
  return <header className="site-header">
    <Link href="/" className="brand" aria-label="MediFind home"><span className="brand-mark">m</span><span>MediFind</span></Link>
    <nav className="desktop-nav" aria-label="Main navigation"><a href="/#how-it-works">How it works</a><a href="/#for-pharmacies">For pharmacies</a><Link href="/search">Browse medicines</Link></nav>
    <div className="nav-actions">{user ? <><Link className="nav-login" href={dashboard}><UserRound size={15} /> {profile?.name?.split(" ")[0] || "Account"}</Link><button className="nav-login nav-logout" onClick={logout}>Log out</button></> : <><Link className="nav-login" href="/login">Log in</Link><Link className="button button-small" href="/search">Find a medicine <ArrowRight size={16} /></Link></>}
      <button className="mobile-menu-button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}</button>
    </div>
    {open && <nav className="mobile-nav"><Link href="/search" onClick={() => setOpen(false)}><Search size={16} /> Find a medicine</Link><a href="/#how-it-works" onClick={() => setOpen(false)}>How it works</a><a href="/#for-pharmacies" onClick={() => setOpen(false)}>For pharmacies</a>{user ? <Link href={dashboard} onClick={() => setOpen(false)}>My account</Link> : <Link href="/login" onClick={() => setOpen(false)}>Log in</Link>}</nav>}
  </header>;
}
