import Link from "next/link";
import { MedicineSearch } from "@/components/medicine-search";
import { SiteHeader } from "@/components/site-header";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  return <main className="app-page"><SiteHeader /><div className="page-container search-page"><div className="breadcrumb"><Link href="/">Home</Link><span>/</span><span>Search medicines</span></div><div className="page-intro"><span className="eyebrow">LOCAL AVAILABILITY</span><h1>What medicine are you looking for?</h1><p>Search by medicine name, brand, or generic name. Results show pharmacy-reported stock and update times.</p></div><MedicineSearch initialQuery={q} /><div className="search-safety"><strong>Availability can change.</strong> Confirm stock and suitability directly with a licensed pharmacist.</div><section className="search-how"><span className="eyebrow">HOW IT WORKS</span><h2>Find reported availability nearby.</h2><div className="mini-steps"><span>01 <b>Choose a medicine</b></span><span>02 <b>Compare pharmacies</b></span><span>03 <b>Reserve or contact</b></span></div></section></div></main>;
}
