"use client";

import Link from "next/link";
import { ArrowRight, LoaderCircle, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { getApprovedPharmacies, getInventoryForMedicine, searchMedicines } from "@/lib/firebase/firestore";
import type { Medicine } from "@/types/domain";

export function MedicineSearch({ initialQuery = "" }: { initialQuery?: string }) {
  const [term, setTerm] = useState(initialQuery);
  const [results, setResults] = useState<Medicine[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [availabilityCounts, setAvailabilityCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      if (!term.trim()) { setResults([]); setAvailabilityCounts({}); setSearched(false); setBusy(false); setError(""); return; }
      setBusy(true); setError("");
      try {
        const matched = await searchMedicines(term);
        if (!active) return;
        setResults(matched); setSearched(true); setBusy(false);
        const pharmacies = await getApprovedPharmacies();
        const approvedIds = new Set(pharmacies.map((pharmacy) => pharmacy.id));
        const counts = await Promise.all(matched.map(async (medicine) => {
          const inventory = await getInventoryForMedicine(medicine.id);
          return [medicine.id, new Set(inventory.filter((item) => item.quantity > 0 && approvedIds.has(item.pharmacyId)).map((item) => item.pharmacyId)).size] as const;
        }));
        if (active) setAvailabilityCounts(Object.fromEntries(counts));
      } catch { if (active) { setError("We couldn’t load medicine matches. Please check your connection and try again."); setSearched(true); } }
      finally { if (active) setBusy(false); }
    }, 280);
    return () => { active = false; window.clearTimeout(timer); };
  }, [term]);

  return <div className="medicine-search-wrap">
    <form className="medicine-search" onSubmit={(event) => event.preventDefault()} role="search">
      <Search size={20} aria-hidden="true" /><input value={term} onChange={(event) => setTerm(event.target.value)} aria-label="Search by medicine or brand" placeholder="Medicine, brand, or generic name" autoComplete="off" />
      {busy ? <LoaderCircle className="spin" size={19} aria-label="Searching" /> : <span className="search-shortcut">Search</span>}
    </form>
    {term.trim() && <div className="search-suggestions" aria-live="polite">
      {busy && <div className="suggestion-status">Searching medicines…</div>}
      {!busy && error && <div className="suggestion-status suggestion-error">{error}</div>}
      {!busy && !error && searched && results.length === 0 && <div className="suggestion-status">No matching medicines found. Try a brand, generic name, or shorter search.</div>}
      {!busy && results.map((medicine) => <Link className="suggestion-row" href={`/medicine/${medicine.id}`} key={medicine.id}>
        <span className="medicine-symbol">✚</span><span className="suggestion-copy"><strong>{medicine.name} {medicine.strength}</strong><small>{medicine.brand || medicine.genericName} · {medicine.form}{availabilityCounts[medicine.id] !== undefined ? ` · ${availabilityCounts[medicine.id]} reporting stock` : ""}</small></span><ArrowRight size={17} />
      </Link>)}
    </div>}
  </div>;
}
