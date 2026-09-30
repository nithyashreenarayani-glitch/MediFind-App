"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Bell, Boxes, ClipboardList, Clock3, PackagePlus, Search, Settings2, Store, TrendingDown } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/components/auth/auth-provider";
import { InventoryForm, NewMedicineForm, PharmacyProfileForm } from "@/components/pharmacy-forms";
import { getMedicines, getNotifications, getPharmacyByOwner, getReservationsForPharmacy, getInventoryForPharmacy, updateNotificationRead } from "@/lib/firebase/firestore";
import { safelyDeleteInventory, updateReservation } from "@/lib/firebase/callables";
import { formatUpdatedAt, type AppNotification, type InventoryRecord, type Medicine, type Pharmacy, type Reservation } from "@/types/domain";

type Tab = "inventory" | "requests" | "profile" | "notifications";
type ReservationView = { reservation: Reservation; medicine?: Medicine };

export default function PharmacyDashboardPage() { return <ProtectedRoute roles={["PHARMACY"]}><PharmacyDashboard /></ProtectedRoute>; }

function PharmacyDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("inventory");
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [requests, setRequests] = useState<ReservationView[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [queryText, setQueryText] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [editing, setEditing] = useState<InventoryRecord | null | undefined>(undefined);
  const [showNewMedicine, setShowNewMedicine] = useState(false);
  const [busyId, setBusyId] = useState("");

  const reload = useCallback(async (showLoader = false) => {
    if (!user) return;
    if (showLoader) setLoading(true);
    setError("");
    try {
      const [place, medicineList, alerts] = await Promise.all([getPharmacyByOwner(user.uid), getMedicines(), getNotifications(user.uid)]);
      let stock: InventoryRecord[] = []; let reservationList: ReservationView[] = [];
      if (place) {
        const [inventoryList, reservations] = await Promise.all([getInventoryForPharmacy(place.id), getReservationsForPharmacy(place.id)]);
        stock = inventoryList;
        reservationList = reservations.map((reservation) => ({ reservation, medicine: medicineList.find((item) => item.id === reservation.medicineId) }));
      }
      setPharmacy(place); setMedicines(medicineList); setNotifications(alerts); setInventory(stock); setRequests(reservationList);
    } catch { setError("We couldn’t load your pharmacy workspace. Check your connection and try again."); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { void reload(true); }, [reload]);

  const medicineById = useMemo(() => new Map(medicines.map((item) => [item.id, item])), [medicines]);
  const filteredStock = useMemo(() => inventory.filter((item) => {
    const medicine = medicineById.get(item.medicineId);
    const matchesText = !queryText || `${medicine?.name ?? ""} ${medicine?.genericName ?? ""} ${medicine?.brand ?? ""}`.toLocaleLowerCase().includes(queryText.toLocaleLowerCase());
    return matchesText && (filter === "ALL" || item.status === filter);
  }), [inventory, medicineById, queryText, filter]);
  const lowCount = inventory.filter((item) => item.status === "LOW_STOCK").length;
  const outCount = inventory.filter((item) => item.status === "OUT_OF_STOCK").length;
  const pendingCount = requests.filter((item) => item.reservation.status === "PENDING").length;
  const unreadCount = notifications.filter((item) => !item.read).length;

  async function moveReservation(id: string, status: "ACCEPTED" | "REJECTED" | "READY" | "COLLECTED") {
    setBusyId(id); setError("");
    try { await updateReservation({ reservationId: id, status }); await reload(); }
    catch (failure) { const code = (failure as { code?: string })?.code; setError(code === "functions/failed-precondition" ? "This request can no longer be updated. Refresh the list to see its current status." : "We couldn’t update the reservation. Please try again."); }
    finally { setBusyId(""); }
  }

  async function removeInventory(item: InventoryRecord) {
    const name = medicineById.get(item.medicineId)?.name ?? "this medicine";
    if (!window.confirm(`Remove ${name} from your inventory? Active reservations must be completed or cancelled first.`)) return;
    setBusyId(item.id); setError("");
    try { await safelyDeleteInventory({ inventoryId: item.id }); await reload(); }
    catch (failure) { const code = (failure as { code?: string })?.code; setError(code === "functions/failed-precondition" ? "This item has active reservations. Complete or cancel those requests first." : "The inventory record couldn’t be removed."); }
    finally { setBusyId(""); }
  }
  async function markNotificationRead(item: AppNotification) {
    try { await updateNotificationRead(item.id, true); setNotifications((current) => current.map((note) => note.id === item.id ? { ...note, read: true } : note)); }
    catch { setError("The notification couldn’t be updated."); }
  }

  return <main className="dashboard-layout"><SiteHeader /><div className="dashboard-frame"><aside className="dashboard-sidebar"><div className="pharmacy-side-brand"><span className="pharmacy-icon"><Store size={18} /></span><span>{pharmacy?.name || "Pharmacy workspace"}</span></div><div className="dashboard-sidebar-label">WORKSPACE</div><button className={tab === "inventory" ? "dash-nav active" : "dash-nav"} onClick={() => setTab("inventory")}><Boxes size={17} /> Inventory</button><button className={tab === "requests" ? "dash-nav active" : "dash-nav"} onClick={() => setTab("requests")}><ClipboardList size={17} /> Reservations {pendingCount > 0 && <i>{pendingCount}</i>}</button><button className={tab === "profile" ? "dash-nav active" : "dash-nav"} onClick={() => setTab("profile")}><Settings2 size={17} /> Pharmacy profile</button><button className={tab === "notifications" ? "dash-nav active" : "dash-nav"} onClick={() => setTab("notifications")}><Bell size={17} /> Notifications {unreadCount > 0 && <i>{unreadCount}</i>}</button><div className="sidebar-bottom"><Link className="dash-nav" href="/">Back to MediFind</Link></div></aside>
    <section className="dashboard-main"><div className="dashboard-welcome"><span className="eyebrow">PHARMACY PORTAL</span><div className="pharmacy-heading-row"><div><h1>{!pharmacy ? "Set up your pharmacy profile" : tab === "inventory" ? "Inventory overview" : tab === "requests" ? "Reservation requests" : tab === "notifications" ? "Notifications" : "Pharmacy profile"}</h1><p>{!pharmacy ? "Add your details to submit a pharmacy profile for review." : tab === "inventory" ? "Keep pharmacy-reported availability up to date." : tab === "requests" ? "Review and manage customer requests." : tab === "notifications" ? "Reservation updates for your pharmacy." : "Manage your public contact and location details."}</p></div>{pharmacy && <span className={`status-badge ${pharmacy.approvalStatus === "APPROVED" ? "status-available" : pharmacy.approvalStatus === "REJECTED" ? "status-rejected" : "status-pending"}`}>{pharmacy.approvalStatus}</span>}</div></div>
      {error && <div className="dashboard-feedback" role="alert">{error}</div>}
      {loading ? <div className="dashboard-skeleton"><div /><div /><div /></div> : tab === "profile" || !pharmacy ? <section className="dashboard-panel profile-panel">{!pharmacy && <div className="approval-callout"><strong>Create your pharmacy profile</strong><p>Pharmacy details are reviewed before your availability is displayed to the public.</p></div>}<PharmacyProfileForm ownerId={user?.uid ?? ""} pharmacy={pharmacy} onSaved={() => void reload(true)} />{pharmacy?.approvalStatus === "PENDING" && <div className="approval-state"><Clock3 size={17} /><p><strong>Awaiting review</strong><br />Your inventory stays private until your pharmacy has been approved.</p></div>}{pharmacy?.approvalStatus === "REJECTED" && <div className="approval-state rejected"><p><strong>Profile needs attention</strong><br />Update your information and contact MediFind support to request another review.</p></div>}</section> : tab === "inventory" ? <>
        <div className="dashboard-stat-grid"><Stat icon={<Boxes size={18} />} label="Listed medicines" value={inventory.length} /><Stat icon={<TrendingDown size={18} />} label="Low stock" value={lowCount} /><Stat icon={<PackagePlus size={18} />} label="Out of stock" value={outCount} /><Stat icon={<ClipboardList size={18} />} label="Pending requests" value={pendingCount} /></div>
        {pharmacy.approvalStatus !== "APPROVED" && <div className="approval-callout"><Clock3 size={18} /><div><strong>Inventory visibility is turned off</strong><p>Your profile must be approved before reported stock appears in public search.</p></div></div>}
        <section className="dashboard-panel inventory-panel"><div className="dashboard-panel-heading"><div><h2>Medicine inventory</h2><p>Stock on this list is pharmacy-reported, not a live connection to a point-of-sale system.</p></div><div className="inventory-header-actions"><button className="secondary-button" onClick={() => setShowNewMedicine(true)}>Add medicine details</button><button className="button" onClick={() => setEditing(null)}>+ Add to inventory</button></div></div><div className="inventory-controls"><label className="inventory-search"><Search size={16} /><input placeholder="Search medicine or brand" value={queryText} onChange={(event) => setQueryText(event.target.value)} /></label><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter inventory status"><option value="ALL">All statuses</option><option value="AVAILABLE">Available</option><option value="LOW_STOCK">Low stock</option><option value="OUT_OF_STOCK">Out of stock</option></select></div>
          {filteredStock.length ? <div className="table-wrap"><table className="data-table inventory-table"><thead><tr><th>Medicine</th><th>Generic / strength</th><th>Stock</th><th>Status</th><th>Last updated</th><th>Actions</th></tr></thead><tbody>{filteredStock.map((item) => { const medicine = medicineById.get(item.medicineId); return <tr key={item.id}><td><strong>{medicine?.name ?? "Medicine"}</strong><small>{medicine?.brand ?? ""}</small></td><td>{medicine?.genericName || "—"}<small>{medicine?.strength || medicine?.form || ""}</small></td><td><strong>{item.quantity}</strong><small>Min {item.minimumStock}</small></td><td><span className={`status-badge ${item.status === "AVAILABLE" ? "status-available" : item.status === "LOW_STOCK" ? "status-low" : "status-out"}`}>{item.status.replaceAll("_", " ")}</span></td><td>{formatUpdatedAt(item.updatedAt)}</td><td><div className="table-actions"><button className="text-action" onClick={() => setEditing(item)}>Edit</button><button className="text-action danger-action" disabled={busyId === item.id} onClick={() => void removeInventory(item)}>{busyId === item.id ? "…" : "Delete"}</button></div></td></tr>; })}</tbody></table></div> : <div className="empty-state"><span className="empty-icon"><Boxes size={23} /></span><strong>{inventory.length ? "No matching inventory" : "Your inventory is empty"}</strong><p>Add a medicine and report available units to begin.</p><button className="button" onClick={() => setEditing(null)}>Add to inventory</button></div>}
        </section>
      </> : tab === "requests" ? <section className="dashboard-panel"><div className="dashboard-panel-heading"><div><h2>Incoming requests</h2><p>Accept, decline, prepare, and complete reservation requests.</p></div></div>{requests.length ? <div className="reservation-management-list">{requests.map(({ reservation, medicine }) => <article className="reservation-management-card" key={reservation.id}><div className="reservation-management-main"><span className="reservation-med-icon">✚</span><div><strong>{medicine?.name ?? "Medicine request"} {medicine?.strength}</strong><small>{reservation.quantity} unit{reservation.quantity === 1 ? "" : "s"} · Requested {formatUpdatedAt(reservation.createdAt)}</small><small>Customer: {reservation.customerName || "MediFind user"}{reservation.customerPhone ? ` · ${reservation.customerPhone}` : ""}</small></div><span className={`status-badge status-${reservation.status.toLocaleLowerCase()}`}>{reservation.status}</span></div><div className="reservation-management-actions">{reservation.status === "PENDING" && <><button className="button button-small" disabled={busyId === reservation.id} onClick={() => void moveReservation(reservation.id, "ACCEPTED")}>Accept</button><button className="secondary-button danger-button" disabled={busyId === reservation.id} onClick={() => void moveReservation(reservation.id, "REJECTED")}>Decline</button></>}{reservation.status === "ACCEPTED" && <button className="button button-small" disabled={busyId === reservation.id} onClick={() => void moveReservation(reservation.id, "READY")}>Mark ready</button>}{reservation.status === "READY" && <button className="button button-small" disabled={busyId === reservation.id} onClick={() => void moveReservation(reservation.id, "COLLECTED")}>Mark collected</button>}</div></article>)}</div> : <div className="empty-state"><span className="empty-icon"><ClipboardList size={23} /></span><strong>No reservation requests yet</strong><p>Customer requests will appear here. Make sure reported stock is current.</p></div>}</section> : <section className="dashboard-panel"><div className="dashboard-panel-heading"><h2>Pharmacy notifications</h2></div>{notifications.length ? <div className="dash-list">{notifications.map((item) => <article className={item.read ? "notification-row is-read" : "notification-row"} key={item.id}><span className="notification-icon"><Bell size={17} /></span><div><strong>{item.title}</strong><p>{item.body}</p><small>{formatUpdatedAt(item.createdAt)}</small></div>{!item.read && <button className="text-action" onClick={() => void markNotificationRead(item)}>Mark read</button>}</article>)}</div> : <div className="empty-state"><strong>No notifications yet</strong><p>Reservation and pharmacy approval updates will appear here.</p></div>}</section>}
    </section>
  </div>{editing !== undefined && pharmacy && <InventoryForm pharmacyId={pharmacy.id} medicines={medicines} inventory={editing} onCancel={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); void reload(); }} />}{showNewMedicine && pharmacy && <NewMedicineForm pharmacyId={pharmacy.id} onCancel={() => setShowNewMedicine(false)} onSaved={async () => { setShowNewMedicine(false); await reload(); setEditing(null); }} />}</main>;
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) { return <article className="dashboard-stat"><span>{icon}</span><strong>{value}</strong><small>{label}</small></article>; }
