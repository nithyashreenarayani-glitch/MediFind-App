"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BarChart3, ClipboardList, Clock3, Pill, Store, Users } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/components/auth/auth-provider";
import { addActivityLog, adminSetDisabled, adminUpdateDocument, getAdminCollectionCounts, getAdminRecords } from "@/lib/firebase/firestore";
import type { UserProfile } from "@/types/auth";
import type { InventoryRecord, Medicine, Pharmacy, Reservation } from "@/types/domain";
import { formatUpdatedAt } from "@/types/domain";

type Tab = "pharmacies" | "users" | "medicines" | "inventory" | "reservations" | "activity";
interface AdminUser extends UserProfile { createdAt?: unknown }
interface ActivityRecord { id: string; actorId: string; action: string; targetType: string; targetId: string; createdAt?: unknown }

export default function AdminDashboardPage() { return <ProtectedRoute roles={["ADMIN"]}><AdminDashboard /></ProtectedRoute>; }

function AdminDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("pharmacies");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [activity, setActivity] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [busyId, setBusyId] = useState("");

  const reload = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setFeedback("");
    try {
      const [summary, userRows, pharmacyRows, medicineRows, inventoryRows, reservationRows, activityLogs] = await Promise.all([
        getAdminCollectionCounts(), getAdminRecords<AdminUser>("users", 500), getAdminRecords<Pharmacy>("pharmacies", 500),
        getAdminRecords<Medicine>("medicines", 500), getAdminRecords<InventoryRecord>("inventory", 500, "updatedAt"), getAdminRecords<Reservation>("reservations", 500), getAdminRecords<ActivityRecord>("activityLogs", 200),
      ]);
      setCounts(summary); setUsers(userRows); setPharmacies(pharmacyRows); setMedicines(medicineRows); setInventory(inventoryRows); setReservations(reservationRows); setActivity(activityLogs);
    } catch { setFeedback("Admin data couldn’t be loaded. Confirm this account has an admin claim and refresh."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(true); }, [reload]);

  async function changeApproval(pharmacy: Pharmacy, approvalStatus: "APPROVED" | "REJECTED") {
    setBusyId(pharmacy.id); setFeedback("");
    try { await adminUpdateDocument("pharmacies", pharmacy.id, { approvalStatus }); if (user) await addActivityLog(user.uid, `PHARMACY_${approvalStatus}`, "pharmacy", pharmacy.id); await reload(); setFeedback(`${pharmacy.name} marked ${approvalStatus.toLowerCase()}.`); }
    catch { setFeedback("Pharmacy approval couldn’t be updated."); }
    finally { setBusyId(""); }
  }
  async function disableUser(account: AdminUser) {
    const isDisabled = !account.isDisabled;
    setBusyId(account.uid); setFeedback("");
    try { await adminSetDisabled(account.uid, isDisabled); if (user) await addActivityLog(user.uid, isDisabled ? "USER_DISABLED" : "USER_ENABLED", "user", account.uid); await reload(); }
    catch { setFeedback("Account status couldn’t be changed."); }
    finally { setBusyId(""); }
  }

  const pending = pharmacies.filter((item) => item.approvalStatus === "PENDING").length;
  const activeRequests = reservations.filter((item) => ["PENDING", "ACCEPTED", "READY"].includes(item.status)).length;
  const completed = reservations.filter((item) => item.status === "COLLECTED").length;

  return <main className="dashboard-layout"><SiteHeader /><div className="dashboard-frame"><aside className="dashboard-sidebar"><Link href="/" className="brand admin-sidebar-brand"><span className="brand-mark">m</span><span>MediFind</span></Link><div className="dashboard-sidebar-label">ADMINISTRATION</div>{adminTabs.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? "dash-nav active" : "dash-nav"} onClick={() => setTab(id)}><Icon size={17} /> {label}{id === "pharmacies" && pending > 0 && <i>{pending}</i>}</button>)}<div className="sidebar-bottom"><Link className="dash-nav" href="/">Back to MediFind</Link></div></aside>
    <section className="dashboard-main admin-main"><div className="dashboard-welcome"><span className="eyebrow">PLATFORM OPERATIONS</span><h1>Admin overview</h1><p>Review pharmacy listings and monitor MediFind activity.</p></div>{feedback && <div className="dashboard-feedback" role="status">{feedback}</div>}
      {loading ? <div className="dashboard-skeleton"><div /><div /><div /></div> : <>
        <div className="dashboard-stat-grid admin-stats"><Stat icon={<Users size={18} />} label="Users" value={counts.users ?? 0} /><Stat icon={<Store size={18} />} label="Pharmacies" value={counts.pharmacies ?? 0} /><Stat icon={<Pill size={18} />} label="Medicine records" value={counts.medicines ?? 0} /><Stat icon={<ClipboardList size={18} />} label="Active reservations" value={activeRequests} /><Stat icon={<BarChart3 size={18} />} label="Completed reservations" value={completed} /><Stat icon={<Store size={18} />} label="Awaiting approval" value={pending} /></div>
        <section className="dashboard-panel admin-table-panel"><div className="dashboard-panel-heading"><div><h2>{adminTabLabels[tab]}</h2><p>Administrative actions are recorded in the activity log.</p></div><button className="secondary-button" onClick={() => void reload(true)}>Refresh</button></div>
          {tab === "pharmacies" && <div className="table-wrap"><table className="data-table"><thead><tr><th>Pharmacy</th><th>Location</th><th>Contact</th><th>Review status</th><th>Actions</th></tr></thead><tbody>{pharmacies.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><small>{item.ownerId}</small></td><td>{item.address}<small>{item.city}</small></td><td>{item.phone}</td><td><span className={`status-badge status-${item.approvalStatus.toLowerCase()}`}>{item.approvalStatus}</span></td><td><div className="table-actions">{item.approvalStatus !== "APPROVED" && <button className="text-action" disabled={busyId === item.id} onClick={() => void changeApproval(item, "APPROVED")}>Approve</button>}{item.approvalStatus !== "REJECTED" && <button className="text-action danger-action" disabled={busyId === item.id} onClick={() => void changeApproval(item, "REJECTED")}>Reject</button>}</div></td></tr>)}</tbody></table>{!pharmacies.length && <EmptyAdmin text="No pharmacies have registered." />}</div>}
          {tab === "users" && <div className="table-wrap"><table className="data-table"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Account status</th><th>Actions</th></tr></thead><tbody>{users.map((item) => <tr key={item.uid}><td><strong>{item.name}</strong><small>{item.uid}</small></td><td>{item.email}</td><td><span className="role-pill">{item.role}</span></td><td>{item.isDisabled ? "Disabled" : "Active"}</td><td>{item.role !== "ADMIN" && <button className="text-action" disabled={busyId === item.uid} onClick={() => void disableUser(item)}>{item.isDisabled ? "Enable" : "Disable"}</button>}</td></tr>)}</tbody></table>{!users.length && <EmptyAdmin text="No users yet." />}</div>}
          {tab === "medicines" && <div className="table-wrap"><table className="data-table"><thead><tr><th>Medicine</th><th>Generic name</th><th>Brand</th><th>Strength & form</th><th>Category</th></tr></thead><tbody>{medicines.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.genericName || "—"}</td><td>{item.brand || "—"}</td><td>{item.strength}<small>{item.form}</small></td><td>{item.category || "—"}</td></tr>)}</tbody></table>{!medicines.length && <EmptyAdmin text="No medicine records yet." />}</div>}
          {tab === "inventory" && <div className="table-wrap"><table className="data-table"><thead><tr><th>Pharmacy</th><th>Medicine ID</th><th>Quantity</th><th>Stock state</th><th>Updated</th></tr></thead><tbody>{inventory.map((item) => <tr key={item.id}><td>{pharmacies.find((place) => place.id === item.pharmacyId)?.name || item.pharmacyId}{item.isDemo && <small>Demo data</small>}</td><td>{item.medicineId}</td><td>{item.quantity}</td><td>{item.status.replaceAll("_", " ")}</td><td>{formatUpdatedAt(item.updatedAt)}</td></tr>)}</tbody></table>{!inventory.length && <EmptyAdmin text="No inventory records yet." />}</div>}
          {tab === "reservations" && <div className="table-wrap"><table className="data-table"><thead><tr><th>Reservation</th><th>User</th><th>Pharmacy</th><th>Medicine</th><th>Qty</th><th>Status</th></tr></thead><tbody>{reservations.map((item) => <tr key={item.id}><td>{item.id.slice(0, 12)}</td><td>{item.customerName || item.userId}</td><td>{pharmacies.find((place) => place.id === item.pharmacyId)?.name || item.pharmacyName || item.pharmacyId}</td><td>{item.medicineName || item.medicineId}</td><td>{item.quantity}</td><td><span className={`status-badge status-${item.status.toLowerCase()}`}>{item.status}</span></td></tr>)}</tbody></table>{!reservations.length && <EmptyAdmin text="No reservation activity yet." />}</div>}
          {tab === "activity" && <div className="table-wrap"><table className="data-table"><thead><tr><th>Action</th><th>Actor</th><th>Record</th><th>Time</th></tr></thead><tbody>{activity.map((item) => <tr key={item.id}><td><strong>{item.action.replaceAll("_", " ")}</strong></td><td>{item.actorId}</td><td>{item.targetType} · {item.targetId}</td><td>{formatUpdatedAt(item.createdAt)}</td></tr>)}</tbody></table>{!activity.length && <EmptyAdmin text="No administrative activity has been recorded." />}</div>}
        </section>
      </>}
    </section>
  </div></main>;
}

const adminTabs: Array<{ id: Tab; label: string; icon: typeof Users }> = [
  { id: "pharmacies", label: "Pharmacies", icon: Store }, { id: "users", label: "Users", icon: Users }, { id: "medicines", label: "Medicines", icon: Pill }, { id: "inventory", label: "Inventory", icon: BarChart3 }, { id: "reservations", label: "Reservations", icon: ClipboardList }, { id: "activity", label: "Activity log", icon: Clock3 },
];
const adminTabLabels: Record<Tab, string> = { pharmacies: "Pharmacy approvals", users: "User management", medicines: "Medicine catalog", inventory: "Inventory monitoring", reservations: "Reservation activity", activity: "Administrative activity" };
function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) { return <article className="dashboard-stat"><span>{icon}</span><strong>{value}</strong><small>{label}</small></article>; }
function EmptyAdmin({ text }: { text: string }) { return <p className="admin-empty">{text}</p>; }
