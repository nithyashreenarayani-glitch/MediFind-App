"use client";

import Link from "next/link";
import { Bell, Bookmark, Check, Clock3, PackageCheck, Search, UserRound } from "lucide-react";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/components/auth/auth-provider";
import { SiteHeader } from "@/components/site-header";
import { auth } from "@/lib/firebase/client";
import { getFavorites, getMedicine, getNotifications, getPharmacy, getReservationsForUser, markAllNotificationsRead, saveUserProfile, updateNotificationRead } from "@/lib/firebase/firestore";
import { updateReservation } from "@/lib/firebase/callables";
import { formatUpdatedAt, type AppNotification, type Favorite, type Medicine, type Pharmacy, type Reservation } from "@/types/domain";

type ReservationView = { reservation: Reservation; medicine?: Medicine; pharmacy?: Pharmacy };
type Tab = "overview" | "reservations" | "notifications" | "saved" | "profile";

export default function UserDashboardPage() { return <ProtectedRoute roles={["USER"]}><DashboardContent /></ProtectedRoute>; }

function DashboardContent() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [reservations, setReservations] = useState<ReservationView[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [favorites, setFavorites] = useState<Array<{ favorite: Favorite; pharmacy?: Pharmacy }>>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      try {
        const [requests, alerts, saved] = await Promise.all([getReservationsForUser(user.uid), getNotifications(user.uid), getFavorites(user.uid)]);
        const [requestViews, savedViews] = await Promise.all([
          Promise.all(requests.map(async (reservation) => {
            const [medicine, pharmacy] = await Promise.all([getMedicine(reservation.medicineId).catch(() => null), getPharmacy(reservation.pharmacyId).catch(() => null)]);
            return { reservation, medicine: medicine ?? undefined, pharmacy: pharmacy ?? undefined };
          })),
          Promise.all(saved.map(async (favorite) => ({ favorite, pharmacy: (await getPharmacy(favorite.pharmacyId).catch(() => null)) ?? undefined }))),
        ]);
        if (active) { setReservations(requestViews); setNotifications(alerts); setFavorites(savedViews); }
      } catch { if (active) setFeedback("Some dashboard information couldn’t be loaded. Please refresh to try again."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [user]);

  const activeCount = reservations.filter(({ reservation }) => ["PENDING", "ACCEPTED", "READY"].includes(reservation.status)).length;
  const completedCount = reservations.filter(({ reservation }) => reservation.status === "COLLECTED").length;
  const unreadCount = notifications.filter((item) => !item.read).length;

  async function logout() { if (auth) await signOut(auth); router.replace("/"); }
  async function cancelReservation(id: string) {
    setBusyId(id); setFeedback("");
    try { await updateReservation({ reservationId: id, status: "CANCELLED" }); setReservations((current) => current.map((item) => item.reservation.id === id ? { ...item, reservation: { ...item.reservation, status: "CANCELLED" } } : item)); setFeedback("Reservation cancelled. The pharmacy was notified."); }
    catch { setFeedback("This reservation could not be cancelled. Refresh its status and try again."); }
    finally { setBusyId(""); }
  }
  async function markRead(item: AppNotification) {
    try { await updateNotificationRead(item.id, true); setNotifications((current) => current.map((note) => note.id === item.id ? { ...note, read: true } : note)); }
    catch { setFeedback("Notification couldn’t be marked as read."); }
  }
  async function markAllRead() {
    if (!user) return;
    try { await markAllNotificationsRead(user.uid); setNotifications((current) => current.map((note) => ({ ...note, read: true }))); }
    catch { setFeedback("Notifications couldn’t be updated. Please try again."); }
  }
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!user) return;
    const data = new FormData(event.currentTarget); const name = String(data.get("name") ?? "").trim(); const phone = String(data.get("phone") ?? "").trim();
    if (name.length < 2 || name.length > 100 || phone.length > 30) { setFeedback("Enter a name under 100 characters and a phone number under 30 characters."); return; }
    try { await saveUserProfile(user.uid, { name, phone }); await refreshProfile(); setFeedback("Your profile has been updated."); }
    catch { setFeedback("Your profile couldn’t be saved. Please try again."); }
  }

  function showTab(next: Tab) { setTab(next); setFeedback(""); }

  return <main className="dashboard-layout"><SiteHeader /><div className="dashboard-frame"><aside className="dashboard-sidebar"><div className="dashboard-sidebar-label">YOUR SPACE</div><button className={tab === "overview" ? "dash-nav active" : "dash-nav"} onClick={() => showTab("overview")}><PackageCheck size={17} /> Overview</button><button className={tab === "reservations" ? "dash-nav active" : "dash-nav"} onClick={() => showTab("reservations")}><Clock3 size={17} /> My reservations {activeCount > 0 && <i>{activeCount}</i>}</button><button className={tab === "notifications" ? "dash-nav active" : "dash-nav"} onClick={() => showTab("notifications")}><Bell size={17} /> Notifications {unreadCount > 0 && <i>{unreadCount}</i>}</button><button className={tab === "saved" ? "dash-nav active" : "dash-nav"} onClick={() => showTab("saved")}><Bookmark size={17} /> Saved pharmacies</button><button className={tab === "profile" ? "dash-nav active" : "dash-nav"} onClick={() => showTab("profile")}><UserRound size={17} /> Profile</button><div className="sidebar-bottom"><button className="dash-nav" onClick={logout}>Log out</button></div></aside>
    <section className="dashboard-main"><div className="dashboard-welcome"><span className="eyebrow">YOUR MEDIFIND ACCOUNT</span><h1>{tab === "overview" ? `Good to see you, ${profile?.name?.split(" ")[0] || "there"}.` : tabLabels[tab]}</h1><p>{tab === "overview" ? "Keep track of requests and find nearby pharmacy availability." : tabDescriptions[tab]}</p></div>
      {feedback && <div className="dashboard-feedback" role="status">{feedback}</div>}
      {loading ? <div className="dashboard-skeleton"><div /><div /><div /></div> : <>
        {tab === "overview" && <>
          <div className="dashboard-stat-grid"><Stat icon={<Clock3 size={18} />} label="Active reservations" value={activeCount} /><Stat icon={<Bell size={18} />} label="Unread notifications" value={unreadCount} /><Stat icon={<Check size={18} />} label="Completed requests" value={completedCount} /></div>
          <section className="dashboard-panel search-callout"><div className="dashboard-panel-icon"><Search size={20} /></div><div><h2>Looking for a medicine?</h2><p>Check reported stock at participating pharmacies nearby.</p></div><Link className="button" href="/search">Search medicines <span aria-hidden="true">→</span></Link></section>
          <section className="dashboard-panel"><PanelHeader title="Recent reservations" action="View all" onClick={() => showTab("reservations")} />{reservations.length ? <div className="dash-list">{reservations.slice(0, 3).map((item) => <ReservationRow key={item.reservation.id} item={item} onCancel={cancelReservation} busy={busyId === item.reservation.id} />)}</div> : <EmptyMessage title="No reservations yet" text="When you request a reservation, you’ll be able to track it here." />}</section>
        </>}
        {tab === "reservations" && <section className="dashboard-panel"><PanelHeader title="Reservation history" />{reservations.length ? <div className="dash-list">{reservations.map((item) => <ReservationRow key={item.reservation.id} item={item} onCancel={cancelReservation} busy={busyId === item.reservation.id} />)}</div> : <EmptyMessage title="Your reservation history will appear here" text="Search for a medicine to see participating pharmacies." />}</section>}
        {tab === "notifications" && <section className="dashboard-panel"><PanelHeader title="Notifications" action={unreadCount ? "Mark all read" : undefined} onClick={markAllRead} />{notifications.length ? <div className="dash-list">{notifications.map((item) => <article className={item.read ? "notification-row is-read" : "notification-row"} key={item.id}><span className="notification-icon"><Bell size={17} /></span><div><strong>{item.title}</strong><p>{item.body}</p><small>{formatUpdatedAt(item.createdAt)}</small></div>{!item.read && <button className="text-action" onClick={() => markRead(item)}>Mark read</button>}</article>)}</div> : <EmptyMessage title="You’re all caught up" text="Reservation updates and medicine alerts will appear here." />}</section>}
        {tab === "saved" && <section className="dashboard-panel"><PanelHeader title="Saved pharmacies" />{favorites.length ? <div className="saved-pharmacy-grid">{favorites.map(({ favorite, pharmacy }) => pharmacy && <Link className="saved-pharmacy-card" href={`/pharmacy/${pharmacy.id}`} key={favorite.id}><span className="pharmacy-icon"><Bookmark size={17} /></span><strong>{pharmacy.name}</strong><small>{pharmacy.city}</small><span className="saved-open">View pharmacy →</span></Link>)}</div> : <EmptyMessage title="No saved pharmacies yet" text="Save a pharmacy from its details page to find it here." />}</section>}
        {tab === "profile" && <section className="dashboard-panel profile-panel"><PanelHeader title="Profile details" /><form className="profile-form" onSubmit={saveProfile}><label>Full name<input name="name" defaultValue={profile?.name ?? ""} required maxLength={100} /></label><label>Email address<input value={profile?.email ?? user?.email ?? ""} disabled /></label><label>Phone number<input name="phone" type="tel" defaultValue={profile?.phone ?? ""} maxLength={30} /></label><label>Account type<input value="Personal account" disabled /></label><button className="button">Save changes</button></form></section>}
      </>}
    </section>
  </div></main>;
}

const tabLabels: Record<Tab, string> = { overview: "Overview", reservations: "My reservations", notifications: "Notifications", saved: "Saved pharmacies", profile: "Your profile" };
const tabDescriptions: Record<Tab, string> = { overview: "Your MediFind overview.", reservations: "Review and track your reservation requests.", notifications: "Updates about reservations and medicine availability.", saved: "Pharmacies you’ve bookmarked for quick access.", profile: "Manage the contact details on your account." };

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) { return <article className="dashboard-stat"><span>{icon}</span><strong>{value}</strong><small>{label}</small></article>; }
function PanelHeader({ title, action, onClick }: { title: string; action?: string; onClick?: () => void }) { return <div className="dashboard-panel-heading"><h2>{title}</h2>{action && <button className="text-action" onClick={onClick}>{action}</button>}</div>; }
function EmptyMessage({ title, text }: { title: string; text: string }) { return <div className="empty-state compact-empty"><strong>{title}</strong><p>{text}</p><Link className="secondary-button" href="/search">Find a medicine</Link></div>; }
function ReservationRow({ item, onCancel, busy }: { item: ReservationView; onCancel: (id: string) => void; busy: boolean }) {
  const canCancel = item.reservation.status === "PENDING" || item.reservation.status === "ACCEPTED";
  return <article className="reservation-row"><span className="reservation-med-icon">✚</span><div className="reservation-row-copy"><strong>{item.medicine?.name ?? item.reservation.medicineName ?? "Medicine request"} {item.medicine?.strength}</strong><small>{item.pharmacy?.name ?? item.reservation.pharmacyName ?? "Pharmacy"} · {item.reservation.quantity} unit{item.reservation.quantity === 1 ? "" : "s"}</small><small>Requested {formatUpdatedAt(item.reservation.createdAt)}</small></div><span className={`status-badge status-${item.reservation.status.toLocaleLowerCase()}`}>{item.reservation.status}</span>{canCancel && <button className="text-action danger-action" disabled={busy} onClick={() => onCancel(item.reservation.id)}>{busy ? "Cancelling…" : "Cancel"}</button>}</article>;
}
