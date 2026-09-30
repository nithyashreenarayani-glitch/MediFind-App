"use client";

import Link from "next/link";
import { ArrowLeft, Pill } from "lucide-react";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { AvailabilityList } from "@/components/availability-list";
import { getMedicine } from "@/lib/firebase/firestore";
import type { Medicine } from "@/types/domain";

export function MedicineDetails({ id }: { id: string }) {
  const [medicine, setMedicine] = useState<Medicine | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void getMedicine(id).then((result) => { if (active) setMedicine(result); }).catch(() => { if (active) setError("Medicine details couldn’t be loaded. Check Firebase configuration and try again."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);
  return <main className="app-page"><SiteHeader /><div className="page-container medicine-detail-page"><div className="breadcrumb"><Link href="/search">Search medicines</Link><span>/</span><span>{medicine?.name || "Medicine"}</span></div><Link className="back-link" href="/search"><ArrowLeft size={15} /> Back to search</Link>{loading ? <div className="availability-skeletons"><div /><div /></div> : error ? <div className="empty-state"><strong>Unable to show medicine details</strong><p>{error}</p></div> : medicine ? <><div className="medicine-detail-heading"><span className="medicine-detail-icon"><Pill size={25} /></span><div><span className="eyebrow">MEDICINE AVAILABILITY</span><h1>{medicine.name} {medicine.strength}</h1><p>{medicine.brand ? `${medicine.brand} · ` : ""}{medicine.genericName} · {medicine.form}</p></div></div><AvailabilityList medicine={medicine} /></> : <div className="empty-state"><strong>Medicine not found</strong><p>Search again to find an available medicine.</p><Link className="button" href="/search">Search medicines</Link></div>}</div></main>;
}
