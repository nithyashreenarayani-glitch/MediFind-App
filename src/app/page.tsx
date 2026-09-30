import Link from "next/link";
import { ArrowRight, Check, Clock3, MapPin, Search, ShieldCheck, Store } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

const steps = [
  { number: "01", title: "Search your medicine", text: "Look up a medicine by name, brand, or generic name." },
  { number: "02", title: "Compare nearby stock", text: "See participating pharmacies, reported availability, and last update." },
  { number: "03", title: "Choose what works", text: "Contact a pharmacy or request a reservation where available." },
];

export default function Home() {
  return (
    <main>
      <SiteHeader />

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="pulse-dot" /> A clearer way to find local availability</div>
          <h1>Find the medicine<br />you need, <em>near you.</em></h1>
          <p className="hero-subtitle">Search nearby pharmacies, check availability, and save time. Know where to look before you head out.</p>
          <form className="search-box" action="/search">
            <Search size={20} aria-hidden="true" />
            <input aria-label="Medicine name" name="q" placeholder="Search a medicine or brand" />
            <button type="submit">Search <ArrowRight size={16} /></button>
          </form>
          <div className="search-hint"><span>Try searching</span><a href="/search?q=Paracetamol">Paracetamol</a><a href="/search?q=Cetirizine">Cetirizine</a><a href="/search?q=ORS">ORS</a></div>
          <div className="hero-proof"><span className="proof-icon"><ShieldCheck size={17} /></span><span>Availability shared by pharmacies.<br /><strong>Always confirm before you travel.</strong></span></div>
        </div>

        <div className="hero-visual" aria-label="Illustration of nearby pharmacy availability">
          <div className="visual-glow" />
          <div className="map-grid" />
          <div className="map-road road-one" /><div className="map-road road-two" /><div className="map-road road-three" />
          <div className="map-pin pin-main"><span><MapPin size={21} fill="currentColor" /></span></div>
          <div className="map-pin pin-small pin-a"><span><MapPin size={16} fill="currentColor" /></span></div>
          <div className="map-pin pin-small pin-b"><span><MapPin size={16} fill="currentColor" /></span></div>
          <div className="pharmacy-card">
            <div className="pharmacy-card-top"><div className="pharmacy-icon"><Store size={18} /></div><span className="availability"><span /> Availability reported</span></div>
            <h3>Nearby pharmacies</h3><p>Compare reported stock around you</p>
            <div className="pharmacy-row"><span className="pharmacy-avatar">A</span><span className="pharmacy-name">Local pharmacy</span><span className="distance">0.8 km</span></div>
            <div className="pharmacy-row"><span className="pharmacy-avatar avatar-two">+</span><span className="pharmacy-name">Community chemist</span><span className="distance">1.4 km</span></div>
            <div className="card-update"><Clock3 size={13} /> Sample availability · confirm with pharmacy</div>
          </div>
          <div className="map-label"><span className="map-label-dot" /> Your neighborhood</div>
          <div className="floating-check"><Check size={15} /> Search made simpler</div>
        </div>
      </section>

      <section className="trust-strip"><span>MADE FOR THE MOMENTS THAT MATTER</span><div><ShieldCheck size={17} /> Availability, made clearer</div><div><MapPin size={17} /> Local pharmacy discovery</div><div><Clock3 size={17} /> Fewer calls and extra trips</div></section>

      <section className="how-section" id="how-it-works">
        <div className="section-heading"><div className="eyebrow">SIMPLE BY DESIGN</div><h2>A little less searching.<br /><em>A lot more certainty.</em></h2><p>MediFind helps you discover reported medicine availability at nearby participating pharmacies.</p></div>
        <div className="steps-grid">{steps.map((step) => <article className="step-card" key={step.number}><span className="step-number">{step.number}</span><div className="step-line" /><h3>{step.title}</h3><p>{step.text}</p></article>)}</div>
      </section>

      <section className="pharmacy-cta" id="for-pharmacies"><div><span className="eyebrow">FOR LOCAL PHARMACIES</span><h2>Help your community<br />find what they need.</h2><p>Share inventory updates and help customers make informed trips to your pharmacy.</p></div><Link className="button button-light" href="/pharmacy">Partner with MediFind <ArrowRight size={16} /></Link><div className="cta-orb" /></section>

      <footer><Link href="/" className="brand"><span className="brand-mark">m</span><span>MediFind</span></Link><p>MediFind is an inventory discovery platform, not a source of medical advice.</p><span>© 2026 MediFind</span></footer>
      <div className="safety-note"><ShieldCheck size={17} /><p><strong>A note on medicine:</strong> Availability information can change. Confirm stock, opening hours, and suitability directly with a licensed pharmacist. MediFind does not diagnose, prescribe, or recommend treatment.</p></div>
    </main>
  );
}
