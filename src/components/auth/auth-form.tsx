"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, GoogleAuthProvider, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useState, type FormEvent } from "react";
import { auth, db } from "@/lib/firebase/client";
import { friendlyAuthError } from "@/lib/firebase/errors";
import { useAuth } from "@/components/auth/auth-provider";
import type { UserRole } from "@/types/auth";

type AuthMode = "login" | "register" | "reset";

const descriptions: Record<AuthMode, { title: string; subtitle: string; button: string }> = {
  login: { title: "Welcome back", subtitle: "Log in to continue to your MediFind account.", button: "Log in" },
  register: { title: "Create your account", subtitle: "Get started finding participating pharmacies near you.", button: "Create account" },
  reset: { title: "Reset your password", subtitle: "We’ll email you a link to choose a new password.", button: "Send reset link" },
};

export function AuthForm({ mode }: { mode: AuthMode }) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<UserRole>("USER");
  const { configured } = useAuth();
  const router = useRouter();
  const copy = descriptions[mode];
  useEffect(() => {
    if (mode === "register" && new URLSearchParams(window.location.search).get("role") === "PHARMACY") setRole("PHARMACY");
  }, [mode]);

  function continueTo(roleValue: string) {
    const requested = new URLSearchParams(window.location.search).get("next");
    const safeNext = requested?.startsWith("/") && !requested.startsWith("//") ? requested : null;
    router.push(safeNext ?? (roleValue === "PHARMACY" ? "/pharmacy/dashboard" : roleValue === "ADMIN" ? "/admin/dashboard" : "/dashboard"));
  }

  async function continueWithGoogle() {
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      if (!auth || !db) throw new Error("Firebase is not configured");
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      const profileRef = doc(db, "users", credential.user.uid);
      let profileSnap = await getDoc(profileRef);
      if (!profileSnap.exists()) {
        const email = credential.user.email ?? "";
        await setDoc(profileRef, {
          name: credential.user.displayName?.trim() || email.split("@")[0] || "MediFind member",
          email,
          phone: credential.user.phoneNumber ?? "",
          role: mode === "register" ? role : "USER",
          isDisabled: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        profileSnap = await getDoc(profileRef);
      }
      if (!profileSnap.exists()) throw new Error("Profile unavailable");
      const profile = profileSnap.data();
      if (profile.isDisabled) {
        await signOut(auth);
        setError("This account has been disabled. Contact support for help.");
        return;
      }
      continueTo(profile.role);
    } catch (authError) {
      setError(friendlyAuthError(authError));
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");

    if (mode !== "reset" && password.length < 6) {
      setError("Your password must be at least 6 characters.");
      return;
    }
    if (mode === "register" && password !== String(form.get("confirmPassword") ?? "")) {
      setError("Your passwords don’t match.");
      return;
    }

    setBusy(true);
    try {
      if (!auth || !db) throw new Error("Firebase is not configured");
      if (mode === "reset") {
        await sendPasswordResetEmail(auth, email);
        setSuccess("If an account exists for that email, a password reset link is on its way.");
      } else if (mode === "login") {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const selected = credential.user;
        let profileSnap = await getDoc(doc(db, "users", selected.uid));
        if (!profileSnap.exists()) {
          await setDoc(doc(db, "users", selected.uid), {
            name: selected.displayName?.trim() || email.split("@")[0], email,
            phone: selected.phoneNumber ?? "", role: "USER", isDisabled: false,
            createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          });
          profileSnap = await getDoc(doc(db, "users", selected.uid));
        }
        if (!profileSnap.exists()) throw new Error("Profile unavailable");
        const profile = profileSnap.data();
        if (profile.isDisabled) {
          await signOut(auth);
          setError("This account has been disabled. Contact support for help.");
          return;
        }
        continueTo(profile.role);
      } else {
        const name = String(form.get("name") ?? "").trim();
        const phone = String(form.get("phone") ?? "").trim();
        const selectedRole = String(form.get("role") ?? role) as UserRole;
        if (selectedRole !== "USER" && selectedRole !== "PHARMACY") {
          setError("Choose a valid account type.");
          return;
        }
        if (!name) {
          setError("Enter your name to continue.");
          return;
        }
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user, { displayName: name });
        try {
          await setDoc(doc(db, "users", credential.user.uid), {
            name,
            email,
            phone,
            role: selectedRole,
            isDisabled: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (profileError) {
          await credential.user.delete();
          throw profileError;
        }
        continueTo(selectedRole);
      }
    } catch (authError) {
      setError(friendlyAuthError(authError));
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-shell"><section className="auth-panel">
    <Link className="brand auth-brand" href="/"><span className="brand-mark">m</span><span>MediFind</span></Link>
    <h1 className="auth-title">{copy.title}</h1><p className="auth-muted">{copy.subtitle}</p>
    {!configured && <div className="auth-alert" role="status">Firebase is not configured yet. Add the values from .env.example to .env.local.</div>}
    <form onSubmit={submit} className="auth-form">
      {mode === "register" && <>
        <label>Full name<input name="name" autoComplete="name" required maxLength={100} /></label>
        <label>Phone <span className="optional-label">(optional)</span><input name="phone" type="tel" autoComplete="tel" maxLength={30} /></label>
        <label>Account type<select name="role" value={role} onChange={(event) => setRole(event.target.value as UserRole)}><option value="USER">Personal account</option><option value="PHARMACY">Pharmacy account</option></select></label>
      </>}
      <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
      {mode !== "reset" && <label>Password<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={6} maxLength={128} /></label>}
      {mode === "register" && <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={6} maxLength={128} /></label>}
      {mode === "login" && <div className="auth-helper"><Link href="/reset-password">Forgot password?</Link></div>}
      {error && <div className="auth-alert" role="alert">{error}</div>}
      {success && <div className="auth-success" role="status">{success}</div>}
      <button className="button auth-submit" disabled={busy || !configured}>{busy ? "Please wait…" : copy.button}</button>
    </form>
    {mode !== "reset" && <><div className="auth-divider"><span>or continue with</span></div><button type="button" className="google-button" onClick={continueWithGoogle} disabled={busy || !configured}><span className="google-g" aria-hidden="true">G</span>Continue with Google</button></>}
    {mode === "login" ? <p className="auth-switch">New to MediFind? <Link href="/register">Create an account</Link></p> : mode === "register" ? <p className="auth-switch">Already have an account? <Link href="/login">Log in</Link></p> : <p className="auth-switch"><Link href="/login">Back to log in</Link></p>}
    <p className="auth-disclaimer">MediFind helps you find pharmacy-reported inventory. It does not provide medical advice.</p>
  </section></main>;
}
