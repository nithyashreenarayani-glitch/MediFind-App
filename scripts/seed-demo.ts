import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GOOGLE_CLOUD_PROJECT;
if (!projectId) throw new Error("Set GOOGLE_CLOUD_PROJECT before seeding the demo dataset.");
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const medicines = [
  ["paracetamol-500", "Paracetamol", "Acetaminophen", "Crocin", "500 mg", "Tablet", "Pain relief", "Catalog sample only."],
  ["paracetamol-syrup", "Paracetamol", "Acetaminophen", "Calpol", "120 mg/5 ml", "Syrup", "Pain relief", "Catalog sample only."],
  ["cetirizine-10", "Cetirizine", "Cetirizine", "Cetzine", "10 mg", "Tablet", "Allergy care", "Catalog sample only."],
  ["ors-powder", "Oral Rehydration Salts", "Oral Rehydration Salts", "Electral", "21 g", "Powder", "Rehydration", "Catalog sample only."],
  ["ibuprofen-200", "Ibuprofen", "Ibuprofen", "Brufen", "200 mg", "Tablet", "Pain relief", "Catalog sample only."],
  ["vitamin-c-500", "Vitamin C", "Ascorbic acid", "Limcee", "500 mg", "Tablet", "Vitamins", "Catalog sample only."],
  ["omeprazole-20", "Omeprazole", "Omeprazole", "Omez", "20 mg", "Capsule", "Digestive care", "Catalog sample only."],
  ["azithromycin-500", "Azithromycin", "Azithromycin", "Azithral", "500 mg", "Tablet", "Prescription medicine", "Catalog sample only. Confirm prescription requirements with a pharmacist."],
  ["amoxicillin-500", "Amoxicillin", "Amoxicillin", "Mox", "500 mg", "Capsule", "Prescription medicine", "Catalog sample only. Confirm prescription requirements with a pharmacist."],
  ["antacid-tablets", "Antacid Tablets", "Calcium carbonate", "Tums", "500 mg", "Chewable tablet", "Digestive care", "Catalog sample only."],
] as const;

const locations = [
  ["demo-indiranagar", "MediFind Demo Pharmacy — Indiranagar", "12 Sample Road", "Bengaluru", 12.9784, 77.6408],
  ["demo-jayanagar", "MediFind Demo Pharmacy — Jayanagar", "25 Example Street", "Bengaluru", 12.9250, 77.5838],
  ["demo-koramangala", "MediFind Demo Pharmacy — Koramangala", "8 Demo Avenue", "Bengaluru", 12.9352, 77.6245],
  ["demo-malleswaram", "MediFind Demo Pharmacy — Malleshwaram", "3 Sample Cross", "Bengaluru", 13.0035, 77.5700],
  ["demo-whitefield", "MediFind Demo Pharmacy — Whitefield", "10 Example Layout", "Bengaluru", 12.9698, 77.7500],
] as const;

const batch = db.batch();
for (const [id, name, genericName, brand, strength, form, category, description] of medicines) {
  batch.set(db.collection("medicines").doc(id), { name, genericName, brand, strength, form, category, description, isDemo: true, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}
for (const [id, name, address, city, latitude, longitude] of locations) {
  const ownerId = `demo-owner-${id}`;
  batch.set(db.collection("pharmacies").doc(id), {
    ownerId, name, address, city, phone: "+91 80 0000 0000", latitude, longitude,
    openingHours: { monday: "09:00-21:00", tuesday: "09:00-21:00", wednesday: "09:00-21:00", thursday: "09:00-21:00", friday: "09:00-21:00", saturday: "10:00-20:00", sunday: "10:00-18:00" },
    approvalStatus: "APPROVED", isDemo: true, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}
await batch.commit();

const stockBatch = db.batch();
for (let pharmacyIndex = 0; pharmacyIndex < locations.length; pharmacyIndex += 1) {
  const [pharmacyId] = locations[pharmacyIndex];
  for (let medicineIndex = 0; medicineIndex < medicines.length; medicineIndex += 1) {
    if ((pharmacyIndex + medicineIndex) % 3 === 0) continue;
    const [medicineId] = medicines[medicineIndex];
    const quantity = (pharmacyIndex * 11 + medicineIndex * 7) % 36;
    const minimumStock = 6;
    const status = quantity === 0 ? "OUT_OF_STOCK" : quantity <= minimumStock ? "LOW_STOCK" : "AVAILABLE";
    stockBatch.set(db.collection("inventory").doc(`${pharmacyId}_${medicineId}`), {
      pharmacyId, medicineId, quantity, minimumStock, status, isPublic: true, isDemo: true,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
}
await stockBatch.commit();

const demoUserIds = ["demo-user-01", "demo-user-02", "demo-user-03"];
const userBatch = db.batch();
demoUserIds.forEach((uid, index) => userBatch.set(db.collection("users").doc(uid), {
  name: `Demo User ${index + 1}`, email: `demo.user${index + 1}@demo.medifind.invalid`, phone: "", role: "USER", isDisabled: false, isDemo: true,
  createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
}, { merge: true }));
await userBatch.commit();

const reservationSamples = [
  { id: "demo-reservation-collected", userId: demoUserIds[0], pharmacyId: locations[0][0], medicineId: medicines[0][0], quantity: 1, status: "COLLECTED" },
  { id: "demo-reservation-rejected", userId: demoUserIds[1], pharmacyId: locations[1][0], medicineId: medicines[2][0], quantity: 2, status: "REJECTED" },
  { id: "demo-reservation-cancelled", userId: demoUserIds[2], pharmacyId: locations[2][0], medicineId: medicines[3][0], quantity: 1, status: "CANCELLED" },
] as const;
const reservationBatch = db.batch();
for (const reservation of reservationSamples) {
  const inventoryId = `${reservation.pharmacyId}_${reservation.medicineId}`;
  reservationBatch.set(db.collection("reservations").doc(reservation.id), {
    ...reservation, inventoryId, customerName: "Demo customer", customerPhone: "", isDemo: true,
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), expiresAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}
await reservationBatch.commit();
console.log("Demo dataset seeded. All sample records are marked isDemo=true and use clearly labelled sample pharmacies.");
