import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where, type DocumentData, type QueryConstraint } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { setAccountDisabled } from "@/lib/firebase/callables";
import { calculateStockStatus, type AppNotification, type Favorite, type InventoryRecord, type Medicine, type Pharmacy, type Reservation, type UserRole } from "@/types/domain";

function requireDb() {
  if (!db) throw new Error("Firebase is not configured");
  return db;
}

function withId<T>(id: string, data: DocumentData): T { return { id, ...data } as T; }

async function list<T>(path: string, ...constraints: QueryConstraint[]): Promise<T[]> {
  const snapshot = await getDocs(query(collection(requireDb(), path), ...constraints));
  return snapshot.docs.map((item) => withId<T>(item.id, item.data()));
}

export async function getUserProfile(uid: string) {
  const snap = await getDoc(doc(requireDb(), "users", uid));
  return snap.exists() ? { uid: snap.id, ...snap.data() } as { uid: string; name: string; email: string; phone: string; role: UserRole; isDisabled: boolean } : null;
}
export async function saveUserProfile(uid: string, input: { name: string; phone: string }) {
  await updateDoc(doc(requireDb(), "users", uid), { name: input.name.trim(), phone: input.phone.trim(), updatedAt: serverTimestamp() });
}

export async function searchMedicines(term: string): Promise<Medicine[]> {
  const all = await list<Medicine>("medicines", orderBy("name"), limit(300));
  const needle = term.trim().toLocaleLowerCase();
  if (!needle) return all.slice(0, 30);
  return all.filter((item) => [item.name, item.genericName, item.brand, item.strength, item.form].some((field) => field?.toLocaleLowerCase().includes(needle))).slice(0, 40);
}

export async function getMedicines(): Promise<Medicine[]> { return list<Medicine>("medicines", orderBy("name"), limit(300)); }
export async function getMedicine(id: string): Promise<Medicine | null> { const snap = await getDoc(doc(requireDb(), "medicines", id)); return snap.exists() ? withId<Medicine>(snap.id, snap.data()) : null; }
export async function getPharmacy(id: string): Promise<Pharmacy | null> { const snap = await getDoc(doc(requireDb(), "pharmacies", id)); return snap.exists() ? withId<Pharmacy>(snap.id, snap.data()) : null; }
export async function getPharmacies() { return list<Pharmacy>("pharmacies", where("approvalStatus", "==", "APPROVED"), orderBy("name"), limit(300)); }
export async function getApprovedPharmacies() { return getPharmacies(); }
export async function getInventoryForMedicine(medicineId: string) { return list<InventoryRecord>("inventory", where("medicineId", "==", medicineId), where("isPublic", "==", true), orderBy("updatedAt", "desc"), limit(500)); }
export async function getInventoryForPharmacy(pharmacyId: string, publicOnly = false) { return list<InventoryRecord>("inventory", where("pharmacyId", "==", pharmacyId), ...(publicOnly ? [where("isPublic", "==", true)] : []), orderBy("updatedAt", "desc"), limit(500)); }
export async function getInventoryById(id: string) { const snap = await getDoc(doc(requireDb(), "inventory", id)); return snap.exists() ? withId<InventoryRecord>(snap.id, snap.data()) : null; }
export async function getPharmacyByOwner(ownerId: string): Promise<Pharmacy | null> {
  const result = await list<Pharmacy>("pharmacies", where("ownerId", "==", ownerId), limit(1));
  return result[0] ?? null;
}

export async function savePharmacy(ownerId: string, input: Pick<Pharmacy, "name" | "address" | "city" | "phone" | "latitude" | "longitude" | "openingHours">, existingId?: string) {
  const database = requireDb();
  const data = { ...input, ownerId, updatedAt: serverTimestamp() };
  if (existingId) {
    await updateDoc(doc(database, "pharmacies", existingId), data);
    return existingId;
  }
  const created = await addDoc(collection(database, "pharmacies"), { ...data, approvalStatus: "PENDING", createdAt: serverTimestamp() });
  return created.id;
}
export async function setPharmacyLogo(pharmacyId: string, logoUrl: string) {
  await updateDoc(doc(requireDb(), "pharmacies", pharmacyId), { logoUrl, updatedAt: serverTimestamp() });
}

export async function saveMedicine(input: Omit<Medicine, "id" | "createdAt" | "updatedAt">, pharmacyId: string, existingId?: string) {
  const database = requireDb();
  const data = { ...input, createdByPharmacyId: pharmacyId, name: input.name.trim(), genericName: input.genericName.trim(), brand: input.brand.trim(), updatedAt: serverTimestamp() };
  if (existingId) {
    await updateDoc(doc(database, "medicines", existingId), data);
    return existingId;
  }
  const created = await addDoc(collection(database, "medicines"), { ...data, createdAt: serverTimestamp() });
  return created.id;
}

export async function saveInventory(pharmacyId: string, medicineId: string, quantity: number, minimumStock: number, existingId?: string) {
  const database = requireDb();
  const pharmacy = await getPharmacy(pharmacyId);
  if (!pharmacy) throw new Error("Pharmacy profile not found");
  const data = { pharmacyId, medicineId, quantity, minimumStock, status: calculateStockStatus(quantity, minimumStock), isPublic: pharmacy.approvalStatus === "APPROVED", updatedAt: serverTimestamp() };
  const inventoryId = existingId ?? `${pharmacyId}_${medicineId}`;
  await setDoc(doc(database, "inventory", inventoryId), data, { merge: Boolean(existingId) });
  return inventoryId;
}

export async function getReservationsForUser(userId: string) { return list<Reservation>("reservations", where("userId", "==", userId), orderBy("createdAt", "desc"), limit(100)); }
export async function getReservationsForPharmacy(pharmacyId: string) { return list<Reservation>("reservations", where("pharmacyId", "==", pharmacyId), orderBy("createdAt", "desc"), limit(100)); }
export async function getAllReservations() { return list<Reservation>("reservations", orderBy("createdAt", "desc"), limit(500)); }
export async function getNotifications(userId: string) { return list<AppNotification>("notifications", where("userId", "==", userId), orderBy("createdAt", "desc"), limit(100)); }
export async function addNotificationSubscription(userId: string, medicineId: string, pharmacyId?: string) {
  const database = requireDb();
  const exists = await getDocs(query(collection(database, "notificationSubscriptions"), where("userId", "==", userId), where("medicineId", "==", medicineId), where("pharmacyId", "==", pharmacyId ?? ""), where("active", "==", true), limit(1)));
  if (!exists.empty) return exists.docs[0].id;
  const created = await addDoc(collection(database, "notificationSubscriptions"), { userId, medicineId, pharmacyId: pharmacyId ?? "", active: true, createdAt: serverTimestamp() });
  return created.id;
}
export async function updateNotificationRead(id: string, read: boolean) { await updateDoc(doc(requireDb(), "notifications", id), { read }); }
export async function markAllNotificationsRead(userId: string) {
  const database = requireDb();
  const unread = await getDocs(query(collection(database, "notifications"), where("userId", "==", userId), where("read", "==", false), limit(500)));
  const { writeBatch } = await import("firebase/firestore");
  const batch = writeBatch(database);
  unread.docs.forEach((item) => batch.update(item.ref, { read: true }));
  await batch.commit();
}
export async function getFavorites(userId: string) { return list<Favorite>("favorites", where("userId", "==", userId), orderBy("createdAt", "desc"), limit(100)); }
export async function toggleFavorite(userId: string, pharmacyId: string) {
  const database = requireDb();
  const favId = `${userId}_${pharmacyId}`;
  const ref = doc(database, "favorites", favId);
  const current = await getDoc(ref);
  if (current.exists()) await deleteDoc(ref);
  else await setDoc(ref, { userId, pharmacyId, createdAt: serverTimestamp() });
}

export async function getAdminCollectionCounts() {
  const database = requireDb();
  const { getCountFromServer } = await import("firebase/firestore");
  const names = ["users", "pharmacies", "medicines", "inventory", "reservations"] as const;
  const counts = await Promise.all(names.map(async (name) => [name, (await getCountFromServer(collection(database, name))).data().count] as const));
  return Object.fromEntries(counts) as Record<(typeof names)[number], number>;
}

export async function getAdminRecords<T>(path: string, max = 300, dateField = "createdAt") {
  const records = await list<T & { id?: string; uid?: string }>(path, orderBy(dateField, "desc"), limit(max));
  return (path === "users" ? records.map((item) => ({ ...item, uid: item.uid || item.id })) : records) as T[];
}
export async function adminUpdateDocument(path: string, id: string, data: Record<string, unknown>) { await updateDoc(doc(requireDb(), path, id), { ...data, updatedAt: serverTimestamp() }); }
export async function addActivityLog(actorId: string, action: string, targetType: string, targetId: string) {
  await addDoc(collection(requireDb(), "activityLogs"), { actorId, action, targetType, targetId, createdAt: serverTimestamp() });
}
export async function adminSetDisabled(uid: string, isDisabled: boolean) { await setAccountDisabled({ uid, disabled: isDisabled }); }
