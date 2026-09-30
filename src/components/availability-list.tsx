"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Bell, Clock3, MapPin, Navigation, Phone, ShieldCheck, Store } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { addNotificationSubscription, getApprovedPharmacies, getInventoryForMedicine } from "@/lib/firebase/firestore";
import { reserveMedicine } from "@/lib/firebase/callables";
import { formatUpdatedAt, getDistanceKm, type InventoryRecord, type Medicine, type Pharmacy } from "@/types/domain";

interface PharmacyStock { pharmacy: Pharmacy; inventory: InventoryRecord; distance?: number }

function getTodayOpeningStatus(hours: Record<string, string> | undefined) {
  if (!hours) return "Hours not provided";
  const day = new Intl.DateTimeFormat("en", { weekday: "long" }).format(new Date()).toLowerCase();
  const range = hours[day];
  if (!range) return "Hours not provided";
  if (range.toLowerCase() === "closed") return "Closed";
  const [openText, closeText] = range.split("-");
  const [openHour, openMinute] = (openText ?? "").split(":").map(Number);
  const [closeHour, closeMinute] = (closeText ?? "").split(":").map(Number);
  if (![openHour, openMinute, closeHour, closeMinute].every(Number.isFinite)) return "Hours not provided";
  const now = new Date(); const current = now.getHours() * 60 + now.getMinutes();
  return current >= openHour * 60 + openMinute && current <= closeHour * 60 + closeMinute ? "Open now" : "Closed";
}
function isOpenNow(hours: Record<string, string> | undefined) { return getTodayOpeningStatus(hours) === "Open now"; }

function AvailabilityCard({ item, medicine }: { item: PharmacyStock; medicine: Medicine }) {
  const { user } = useAuth();
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const available = item.inventory.quantity > 0;
  const hoursStatus = getTodayOpeningStatus(item.pharmacy.openingHours);
  const open = hoursStatus === "Open now";
  const statusClass = item.inventory.quantity === 0 ? "status-out" : item.inventory.status === "LOW_STOCK" ? "status-low" : "status-available";

  async function reserve() {
    if (!user) { router.push(`/login?next=${encodeURIComponent(`/medicine/${medicine.id}`)}`); return; }
    setBusy(true); setMessage("");
    try {
      await reserveMedicine({ pharmacyId: item.pharmacy.id, medicineId: medicine.id, quantity });
      setMessage("Request sent. You can track it from your dashboard.");
    } catch (error) {
      const code = (error as { code?: string })?.code;
      setMessage(code === "functions/failed-precondition" ? "Stock changed while you were requesting. Refresh availability and try again." : "We couldn’t send that request. Please try again.");
    } finally { setBusy(false); }
  }

  async function notify() {
    if (!user) { router.push(`/login?next=${encodeURIComponent(`/medicine/${medicine.id}`)}`); return; }
    setBusy(true); setMessage("");
    try { await addNotificationSubscription(user.uid, medicine.id, item.pharmacy.id); setMessage("You’re subscribed to availability updates from this pharmacy."); }
    catch { setMessage("We couldn’t save that notification. Please try again."); }
    finally { setBusy(false); }
  }

  return <article className="availability-card">
    <div className="availability-card-heading"><div className="pharmacy-icon"><Store size={19} /></div><div className="pharmacy-title"><h2>{item.pharmacy.name}</h2><span><MapPin size={13} /> {item.pharmacy.address}, {item.pharmacy.city}</span></div><span className={`status-badge ${statusClass}`}>{item.inventory.status.replaceAll("_", " ")}</span></div>
    <div className="availability-metrics"><div><strong>{available ? `${item.inventory.quantity} units` : "Unavailable"}</strong><span>Reported stock</span></div><div><strong className={open ? "open-text" : "closed-text"}>{open && <i className="status-dot" />}{hoursStatus}</strong><span>Today · {item.pharmacy.openingHours?.[new Intl.DateTimeFormat("en", { weekday: "long" }).format(new Date()).toLowerCase()] || "Hours unavailable"}</span></div><div><strong>{item.distance === undefined ? "Distance unavailable" : `${item.distance.toFixed(1)} km`}</strong><span>From your location</span></div></div>
    <div className="availability-card-footer"><span><Clock3 size={13} /> {formatUpdatedAt(item.inventory.updatedAt)}</span><div className="availability-actions"><a className="secondary-button compact" href={`tel:${item.pharmacy.phone}`}><Phone size={15} /> Call</a><Link className="secondary-button compact" href={`/pharmacy/${item.pharmacy.id}`}>Details <ArrowRight size={14} /></Link></div></div>
    {available ? <div className="reserve-row"><label>Quantity<select value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} aria-label={`Quantity to reserve at ${item.pharmacy.name}`}>{Array.from({ length: Math.min(item.inventory.quantity, 20) }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label><button className="button reserve-button" onClick={reserve} disabled={busy}>{busy ? "Sending…" : "Request reservation"} <ArrowRight size={15} /></button></div> : <button className="notify-button" onClick={notify} disabled={busy}><Bell size={15} /> {busy ? "Saving…" : "Notify me when available"}</button>}
    {message && <p className="inline-feedback" role="status">{message}</p>}
  </article>;
}

export function AvailabilityList({ medicine }: { medicine: Medicine }) {
  const [items, setItems] = useState<PharmacyStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [place, setPlace] = useState("");
  const [userPosition, setUserPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [lowOnly, setLowOnly] = useState(false);
  const [openOnly, setOpenOnly] = useState(false);
  const [sortBy, setSortBy] = useState("nearest");
  const [maxDistance, setMaxDistance] = useState("all");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError("");
      try {
        const [inventory, pharmacies] = await Promise.all([getInventoryForMedicine(medicine.id), getApprovedPharmacies()]);
        const pharmacyById = new Map(pharmacies.map((pharmacy) => [pharmacy.id, pharmacy]));
        const visible = inventory.map((record) => {
          const pharmacy = pharmacyById.get(record.pharmacyId);
          return pharmacy ? { pharmacy, inventory: record } : null;
        });
        if (active) setItems(visible.filter((item): item is PharmacyStock => item !== null));
      } catch { if (active) setError("We couldn’t load pharmacy availability. Please try again."); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [medicine.id]);

  const filtered = useMemo(() => {
    let result = items.map((item) => ({ ...item, distance: userPosition && Number.isFinite(item.pharmacy.latitude) && Number.isFinite(item.pharmacy.longitude) ? getDistanceKm(userPosition, { latitude: item.pharmacy.latitude!, longitude: item.pharmacy.longitude! }) : undefined }));
    if (availableOnly) result = result.filter((item) => item.inventory.quantity > 0);
    if (lowOnly) result = result.filter((item) => item.inventory.status === "LOW_STOCK");
    if (openOnly) result = result.filter((item) => isOpenNow(item.pharmacy.openingHours));
    if (userPosition && maxDistance !== "all") result = result.filter((item) => item.distance !== undefined && item.distance <= Number(maxDistance));
    const search = place.trim().toLocaleLowerCase();
    if (search) result = result.filter((item) => `${item.pharmacy.name} ${item.pharmacy.city} ${item.pharmacy.address}`.toLocaleLowerCase().includes(search));
    if (sortBy === "nearest" && userPosition) result.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    else if (sortBy === "availability") result.sort((a, b) => b.inventory.quantity - a.inventory.quantity);
    else result.sort((a, b) => a.pharmacy.name.localeCompare(b.pharmacy.name));
    return result;
  }, [items, userPosition, availableOnly, lowOnly, openOnly, place, sortBy, maxDistance]);

  function locate() {
    if (!navigator.geolocation) { setError("Location isn’t available in this browser. Search by pharmacy or area instead."); return; }
    navigator.geolocation.getCurrentPosition((position) => {
      setUserPosition({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      setSortBy("nearest");
    }, () => setError("We couldn’t access your location. You can still search by pharmacy or area."), { maximumAge: 60_000, timeout: 10_000 });
  }

  return <section className="availability-section">
    <div className="availability-intro"><div><span className="eyebrow">PHARMACY-REPORTED AVAILABILITY</span><h2>Nearby pharmacies</h2><p>Stock and hours can change. Please confirm with the pharmacy before travelling.</p></div><button className="secondary-button" onClick={locate}><Navigation size={15} /> Use my location</button></div>
    {items.some((item) => item.inventory.isDemo || item.pharmacy.isDemo) && <div className="demo-banner"><ShieldCheck size={17} /><span><strong>Demo data</strong> — inventory shown here is for demonstration purposes.</span></div>}
    <div className="filter-toolbar"><input aria-label="Filter by pharmacy or location" placeholder="Search pharmacy or area" value={place} onChange={(event) => setPlace(event.target.value)} /><label className="filter-check"><input type="checkbox" checked={availableOnly} onChange={(event) => setAvailableOnly(event.target.checked)} /> Available</label><label className="filter-check"><input type="checkbox" checked={lowOnly} onChange={(event) => setLowOnly(event.target.checked)} /> Low stock</label><label className="filter-check"><input type="checkbox" checked={openOnly} onChange={(event) => setOpenOnly(event.target.checked)} /> Open now</label><select aria-label="Maximum distance" value={maxDistance} onChange={(event) => setMaxDistance(event.target.value)} disabled={!userPosition}><option value="all">Any distance</option><option value="5">Within 5 km</option><option value="10">Within 10 km</option><option value="25">Within 25 km</option></select><select aria-label="Sort pharmacies" value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="nearest">Nearest</option><option value="availability">Most stock</option><option value="name">Name</option></select></div>
    {loading ? <div className="availability-skeletons" aria-label="Loading pharmacies"><div /><div /><div /></div> : error && !items.length ? <div className="empty-state"><strong>Availability didn’t load</strong><p>{error}</p><button className="secondary-button" onClick={() => window.location.reload()}>Try again</button></div> : !filtered.length ? <div className="empty-state"><span className="empty-icon"><Store size={24} /></span><strong>{items.length ? "No pharmacies match those filters" : "No pharmacies have reported this medicine yet"}</strong><p>{items.length ? "Try clearing a filter or searching a different area." : "Subscribe and we’ll let you know when a pharmacy reports stock."}</p>{(!items.length || items.every((item) => item.inventory.quantity === 0)) && <GlobalNotify medicine={medicine} />}</div> : <div className="availability-list">{filtered.map((item) => <AvailabilityCard key={item.inventory.id} item={item} medicine={medicine} />)}</div>}
    {error && items.length > 0 && <p className="inline-feedback" role="status">{error}</p>}
  </section>;
}

function GlobalNotify({ medicine }: { medicine: Medicine }) {
  const { user } = useAuth(); const router = useRouter();
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function subscribe() {
    if (!user) { router.push(`/login?next=${encodeURIComponent(`/medicine/${medicine.id}`)}`); return; }
    setBusy(true); setMessage("");
    try { await addNotificationSubscription(user.uid, medicine.id); setMessage("You’ll get an in-app alert if a participating pharmacy reports new stock."); }
    catch { setMessage("We couldn’t save that notification. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="global-notify-card"><span className="notify-icon"><Bell size={20} /></span><div><strong>Not finding what you need?</strong><p>Get an in-app notification when a participating pharmacy reports availability.</p>{message && <small role="status">{message}</small>}</div><button className="button" onClick={subscribe} disabled={busy}>{busy ? "Saving…" : "Notify me"}</button></div>;
}
