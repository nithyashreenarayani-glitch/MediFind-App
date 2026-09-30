"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import { z } from "zod";
import { inventorySchema, medicineSchema, pharmacySchema } from "@/lib/validation";
import { saveInventory, saveMedicine, savePharmacy, setPharmacyLogo } from "@/lib/firebase/firestore";
import { uploadPharmacyLogo } from "@/lib/firebase/storage";
import type { InventoryRecord, Medicine, Pharmacy } from "@/types/domain";

const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export function PharmacyProfileForm({ ownerId, pharmacy, onSaved }: { ownerId: string; pharmacy: Pharmacy | null; onSaved: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof pharmacySchema>>({ resolver: zodResolver(pharmacySchema), defaultValues: {
    name: pharmacy?.name ?? "", address: pharmacy?.address ?? "", city: pharmacy?.city ?? "", phone: pharmacy?.phone ?? "",
    latitude: pharmacy?.latitude?.toString() ?? "", longitude: pharmacy?.longitude?.toString() ?? "",
    openTime: pharmacy?.openingHours?.monday?.split("-")[0] ?? "09:00", closeTime: pharmacy?.openingHours?.monday?.split("-")[1] ?? "21:00",
  } });
  const [savedId, setSavedId] = useState(pharmacy?.id ?? "");

  async function submit(values: z.infer<typeof pharmacySchema>) {
    setBusy(true); setError("");
    try {
      const openingHours = Object.fromEntries(days.map((day) => [day, `${values.openTime}-${values.closeTime}`]));
      const id = await savePharmacy(ownerId, {
        name: values.name, address: values.address, city: values.city, phone: values.phone,
        latitude: values.latitude ? Number(values.latitude) : null, longitude: values.longitude ? Number(values.longitude) : null, openingHours,
      }, pharmacy?.id);
      setSavedId(id); onSaved();
    } catch { setError("We couldn’t save your pharmacy details. Please check the fields and try again."); }
    finally { setBusy(false); }
  }

  async function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !savedId) return;
    setBusy(true); setError("");
    try { const url = await uploadPharmacyLogo(savedId, ownerId, file); await setPharmacyLogo(savedId, url); onSaved(); }
    catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "The logo could not be uploaded."); }
    finally { setBusy(false); event.target.value = ""; }
  }

  return <form className="pharmacy-form" onSubmit={handleSubmit(submit)}>
    <div className="form-section-heading"><h3>Pharmacy details</h3><p>Location and contact details help customers confirm where to go.</p></div>
    <div className="form-grid"><FormInput label="Pharmacy name" error={errors.name?.message} {...register("name")} /><FormInput label="Phone number" error={errors.phone?.message} {...register("phone")} /><FormInput label="Street address" error={errors.address?.message} className="span-two" {...register("address")} /><FormInput label="City or area" error={errors.city?.message} {...register("city")} /><FormInput label="Latitude (optional)" error={errors.latitude?.message} placeholder="e.g. 12.9716" {...register("latitude")} /><FormInput label="Longitude (optional)" error={errors.longitude?.message} placeholder="e.g. 77.5946" {...register("longitude")} /><label className="form-field"><span>Opening time</span><input type="time" {...register("openTime")} /></label><label className="form-field"><span>Closing time</span><input type="time" {...register("closeTime")} /></label></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-action-row"><button className="button" disabled={busy}>{busy ? "Saving…" : pharmacy ? "Save pharmacy details" : "Create pharmacy profile"}</button>{savedId && <label className="secondary-button upload-control">Upload logo<input type="file" accept="image/*" onChange={uploadLogo} disabled={busy} /></label>}</div>
    {!pharmacy && <p className="form-hint">New profiles are reviewed before inventory appears in public search.</p>}
  </form>;
}

export function InventoryForm({ pharmacyId, medicines, inventory, onSaved, onCancel }: { pharmacyId: string; medicines: Medicine[]; inventory: InventoryRecord | null; onSaved: () => void; onCancel: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof inventorySchema>>({ resolver: zodResolver(inventorySchema), defaultValues: { medicineId: inventory?.medicineId ?? "", quantity: inventory?.quantity ?? 0, minimumStock: inventory?.minimumStock ?? 5 } });
  async function submit(values: z.infer<typeof inventorySchema>) {
    setBusy(true); setError("");
    try { await saveInventory(pharmacyId, values.medicineId, values.quantity, values.minimumStock, inventory?.id); onSaved(); }
    catch { setError("Stock couldn’t be saved. Check that the pharmacy profile has been approved and try again."); }
    finally { setBusy(false); }
  }
  return <div className="modal-backdrop" role="presentation"><section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="inventory-modal-title"><button className="modal-close" aria-label="Close" onClick={onCancel}>×</button><span className="eyebrow">INVENTORY</span><h2 id="inventory-modal-title">{inventory ? "Update stock" : "Add medicine to inventory"}</h2><p>Stock quantity means units currently available for a new request.</p><form className="pharmacy-form" onSubmit={handleSubmit(submit)}><label className="form-field"><span>Medicine</span><select {...register("medicineId")}><option value="">Choose medicine</option>{medicines.map((medicine) => <option key={medicine.id} value={medicine.id}>{medicine.name} {medicine.strength} · {medicine.form}</option>)}</select>{errors.medicineId?.message && <small className="field-error">{errors.medicineId.message}</small>}</label><div className="form-grid"><label className="form-field"><span>Available units</span><input type="number" min="0" max="100000" {...register("quantity", { valueAsNumber: true })} />{errors.quantity?.message && <small className="field-error">{errors.quantity.message}</small>}</label><label className="form-field"><span>Low stock threshold</span><input type="number" min="0" max="100000" {...register("minimumStock", { valueAsNumber: true })} />{errors.minimumStock?.message && <small className="field-error">{errors.minimumStock.message}</small>}</label></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button className="button" disabled={busy}>{busy ? "Saving…" : "Save stock"}</button></div></form></section></div>;
}

export function NewMedicineForm({ pharmacyId, onSaved, onCancel }: { pharmacyId: string; onSaved: (id: string) => void; onCancel: () => void }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof medicineSchema>>({ resolver: zodResolver(medicineSchema), defaultValues: { name: "", genericName: "", brand: "", strength: "", form: "Tablet", category: "", description: "" } });
  async function submit(values: z.infer<typeof medicineSchema>) {
    setBusy(true); setError("");
    try { const id = await saveMedicine(values, pharmacyId); onSaved(id); }
    catch { setError("Medicine details couldn’t be added. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="modal-backdrop" role="presentation"><section className="modal-panel modal-wide" role="dialog" aria-modal="true" aria-labelledby="medicine-modal-title"><button className="modal-close" aria-label="Close" onClick={onCancel}>×</button><span className="eyebrow">MEDICINE CATALOG</span><h2 id="medicine-modal-title">Add a medicine</h2><p>Enter product details as shown on its packaging. This is catalog information, not medical guidance.</p><form className="pharmacy-form" onSubmit={handleSubmit(submit)}><div className="form-grid"><FormInput label="Medicine name" error={errors.name?.message} {...register("name")} /><FormInput label="Generic name" error={errors.genericName?.message} {...register("genericName")} /><FormInput label="Brand" error={errors.brand?.message} {...register("brand")} /><FormInput label="Strength" placeholder="e.g. 500 mg" error={errors.strength?.message} {...register("strength")} /><label className="form-field"><span>Form</span><select {...register("form")}><option>Tablet</option><option>Capsule</option><option>Syrup</option><option>Oral solution</option><option>Powder</option><option>Cream</option><option>Other</option></select>{errors.form?.message && <small className="field-error">{errors.form.message}</small>}</label><FormInput label="Category (optional)" error={errors.category?.message} {...register("category")} /><label className="form-field span-two"><span>Description (optional)</span><textarea rows={3} maxLength={500} {...register("description")} /></label></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button className="button" disabled={busy}>{busy ? "Saving…" : "Add medicine"}</button></div></form></section></div>;
}

function FormInput({ label, error, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; className?: string }) {
  return <label className={`form-field ${className}`}><span>{label}</span><input {...props} />{error && <small className="field-error">{error}</small>}</label>;
}
