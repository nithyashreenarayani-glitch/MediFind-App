"use client";

import Link from "next/link";
import { ArrowLeft, Clock3, Heart, MapPin, Navigation, Phone, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/components/auth/auth-provider";
import { getInventoryForPharmacy, getMedicine, getPharmacy, toggleFavorite } from "@/lib/firebase/firestore";
import { formatUpdatedAt, type InventoryRecord, type Medicine, type Pharmacy } from "@/types/domain";

function currentHours(hours: Record<string, string>) {
  const weekday = new Intl.DateTimeFormat("en", { weekday: "long" }).format(new Date()).toLocaleLowerCase();
  return hours?.[weekday] || "Hours not provided";
}

export function PharmacyDetails({ id }: { id: string }) {
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [medicines, setMedicines] = useState<Array<{ inventory: InventoryRecord; medicine: Medicine }>>([]);
  const [loading, setLoading] = useState(true);
  const [favoriteMessage, setFavoriteMessage] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [place, records] = await Promise.all([getPharmacy(id), getInventoryForPharmacy(id, true)]);
        if (!place || place.approvalStatus !== "APPROVED") { if (active) setLoading(false); return; }
        const medicineResults = await Promise.all(records.filter((record) => record.quantity > 0).map(async (record) => {
          const medicine = await getMedicine(record.medicineId);
          return medicine ? { inventory: record, medicine } : null;
        }));
        if (active) { setPharmacy(place); setMedicines(medicineResults.filter((item): item is { inventory: InventoryRecord; medicine: Medicine } => Boolean(item))); }
      } catch { /* Render the friendly unavailable state. */ }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [id]);

  async function saveFavorite() {
    if (!user || !pharmacy) { setFavoriteMessage("Log in to save a pharmacy."); return; }
    try { await toggleFavorite(user.uid, pharmacy.id); setFavoriteMessage("Saved pharmacy list updated."); }
    catch { setFavoriteMessage("We couldn’t update saved pharmacies."); }
  }

  const directionsUrl = pharmacy ? `https://www.google.com/maps/dir/?api=1&destination=${Number.isFinite(pharmacy.latitude) && Number.isFinite(pharmacy.longitude) ? `${pharmacy.latitude},${pharmacy.longitude}` : encodeURIComponent(`${pharmacy.address}, ${pharmacy.city}`)}` : "#";
  return <main className="app-page"><SiteHeader /><div className="page-container pharmacy-details-page"><div className="breadcrumb"><Link href="/search">Search</Link><span>/</span><span>Pharmacy</span></div><Link className="back-link" href="/search"><ArrowLeft size={15} /> Back to search</Link>{loading ? <div className="availability-skeletons"><div /><div /></div> : !pharmacy ? <div className="empty-state"><strong>Pharmacy details unavailable</strong><p>This pharmacy may not be approved or could not be loaded.</p><Link className="button" href="/search">Find a medicine</Link></div> : <>
    {pharmacy.isDemo && <div className="demo-banner"><Store size={17} /> Demo data — pharmacy and inventory are for demonstration only.</div>}
    <section className="pharmacy-hero-card"><div className={`pharmacy-hero-icon${pharmacy.logoUrl ? " has-logo" : ""}`} style={pharmacy.logoUrl ? { backgroundImage: `url("${pharmacy.logoUrl}")` } : undefined}>{!pharmacy.logoUrl && <Store size={26} />}</div><div className="pharmacy-hero-copy"><span className="eyebrow">PARTICIPATING PHARMACY</span><h1>{pharmacy.name}</h1><p><MapPin size={15} /> {pharmacy.address}, {pharmacy.city}</p></div><div className="pharmacy-hero-actions"><a className="button" href={directionsUrl} target="_blank" rel="noreferrer"><Navigation size={16} /> Get directions</a><button className="secondary-button" onClick={saveFavorite}><Heart size={15} /> Save</button></div></section>
    {favoriteMessage && <p className="inline-feedback" role="status">{favoriteMessage}</p>}
    <div className="pharmacy-info-grid"><section className="pharmacy-info-card"><h2>Contact & hours</h2><a className="contact-line" href={`tel:${pharmacy.phone}`}><Phone size={16} /> {pharmacy.phone || "Phone not provided"}</a><div className="contact-line"><Clock3 size={16} /> Today: {currentHours(pharmacy.openingHours)}</div><p className="helper-copy">Opening hours are shared by the pharmacy. Please call to confirm.</p></section><section className="map-card"><div className="map-placeholder"><div className="map-placeholder-pattern" /><span className="map-placeholder-pin"><MapPin size={24} fill="currentColor" /></span><span className="map-caption"><MapPin size={14} /> {pharmacy.city}</span></div><a className="map-directions" href={directionsUrl} target="_blank" rel="noreferrer">Open directions in Google Maps <Navigation size={15} /></a></section></div>
    <section className="pharmacy-stock-section"><div className="availability-intro"><div><span className="eyebrow">PHARMACY INVENTORY</span><h2>Reported availability</h2><p>Confirm the stock with the pharmacy before visiting.</p></div><span className="inventory-count">{medicines.length} listed</span></div>{medicines.length ? <div className="medicine-stock-list">{medicines.map(({ medicine, inventory }) => <article className="medicine-stock-row" key={inventory.id}><span className="medicine-symbol">✚</span><div><strong>{medicine.name} {medicine.strength}</strong><small>{medicine.genericName} · {medicine.form}</small></div><span className="stock-count">{inventory.quantity} units</span><span className={`status-badge ${inventory.status === "LOW_STOCK" ? "status-low" : "status-available"}`}>{inventory.status.replaceAll("_", " ")}</span><span className="inventory-updated">{formatUpdatedAt(inventory.updatedAt)}</span></article>)}</div> : <div className="empty-state"><strong>No available inventory is currently listed</strong><p>Call the pharmacy to ask about availability.</p></div>}</section>
  </>}</div></main>;
}
