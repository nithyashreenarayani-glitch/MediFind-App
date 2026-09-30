import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore, type Transaction } from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentWritten } from "firebase-functions/v2/firestore";

initializeApp();
const db = getFirestore();
const REGION = "us-central1";
const RESERVATION_HOURS = 2;
type Status = "PENDING" | "ACCEPTED" | "REJECTED" | "READY" | "COLLECTED" | "CANCELLED" | "EXPIRED";

function stockStatus(quantity: number, threshold: number) {
  return quantity <= 0 ? "OUT_OF_STOCK" : quantity <= threshold ? "LOW_STOCK" : "AVAILABLE";
}

function assertString(value: unknown, name: string, max = 200): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) throw new HttpsError("invalid-argument", `Invalid ${name}.`);
  return value.trim();
}

function assertQuantity(value: unknown) {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 20) throw new HttpsError("invalid-argument", "Request between 1 and 20 units.");
  return value as number;
}

function requireUser(request: CallableRequest<unknown>) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Log in to continue.");
  return request.auth;
}

function addNotification(transaction: Transaction, data: Record<string, unknown>) {
  const ref = db.collection("notifications").doc();
  transaction.create(ref, { ...data, read: false, createdAt: FieldValue.serverTimestamp() });
}

export const reserveMedicine = onCall({ region: REGION, enforceAppCheck: false }, async (request) => {
  const auth = requireUser(request);
  const pharmacyId = assertString(request.data?.pharmacyId, "pharmacy");
  const medicineId = assertString(request.data?.medicineId, "medicine");
  const quantity = assertQuantity(request.data?.quantity);
  const inventoryId = `${pharmacyId}_${medicineId}`;
    const reservationRef = db.collection("reservations").doc();
  const expiry = Timestamp.fromMillis(Date.now() + RESERVATION_HOURS * 60 * 60 * 1000);

  await db.runTransaction(async (transaction) => {
    const userRef = db.collection("users").doc(auth.uid);
    const inventoryRef = db.collection("inventory").doc(inventoryId);
    const pharmacyRef = db.collection("pharmacies").doc(pharmacyId);
    const medicineRef = db.collection("medicines").doc(medicineId);
    const [userSnap, inventorySnap, pharmacySnap, medicineSnap] = await Promise.all([
      transaction.get(userRef), transaction.get(inventoryRef), transaction.get(pharmacyRef),
      transaction.get(medicineRef),
    ]);
    if (!userSnap.exists || userSnap.get("role") !== "USER" || userSnap.get("isDisabled") === true) throw new HttpsError("permission-denied", "This account cannot place reservations.");
    if (!inventorySnap.exists || !pharmacySnap.exists || !medicineSnap.exists || pharmacySnap.get("approvalStatus") !== "APPROVED") throw new HttpsError("not-found", "This pharmacy listing is not available.");
    const inventory = inventorySnap.data()!;
    if (inventory.pharmacyId !== pharmacyId || inventory.medicineId !== medicineId || inventory.isPublic !== true) throw new HttpsError("not-found", "This pharmacy listing is not available.");
    const quantityAvailable = inventory.quantity;
    if (!Number.isInteger(quantityAvailable) || quantityAvailable < quantity) throw new HttpsError("failed-precondition", "There isn’t enough stock for that quantity. Please refresh availability.");
    const newQuantity = quantityAvailable - quantity;
    const threshold = Number(inventory.minimumStock) || 0;
    transaction.update(inventoryRef, { quantity: newQuantity, status: stockStatus(newQuantity, threshold), updatedAt: FieldValue.serverTimestamp() });
    transaction.create(reservationRef, {
      userId: auth.uid, customerName: userSnap.get("name"), customerPhone: userSnap.get("phone"),
      pharmacyName: pharmacySnap.get("name"), medicineName: `${medicineSnap.get("name")} ${medicineSnap.get("strength") || ""}`.trim(),
      pharmacyId, medicineId, inventoryId, quantity,
      status: "PENDING", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), expiresAt: expiry,
    });
    addNotification(transaction, {
      userId: pharmacySnap.get("ownerId"), type: "RESERVATION", title: "New reservation request",
      body: `A customer requested ${quantity} unit${quantity === 1 ? "" : "s"}.`, pharmacyId, reservationId: reservationRef.id, medicineId,
    });
  });
  return { reservationId: reservationRef.id, expiresAt: expiry.toDate().toISOString() };
});

export const updateReservation = onCall({ region: REGION, enforceAppCheck: false }, async (request) => {
  const auth = requireUser(request);
  const reservationId = assertString(request.data?.reservationId, "reservation id");
  const nextStatus = assertString(request.data?.status, "reservation status") as Status;
  const allowed = new Set<Status>(["ACCEPTED", "REJECTED", "READY", "COLLECTED", "CANCELLED"]);
  if (!allowed.has(nextStatus)) throw new HttpsError("invalid-argument", "That status cannot be set directly.");

  await db.runTransaction(async (transaction) => {
    const reservationRef = db.collection("reservations").doc(reservationId);
    const reservationSnap = await transaction.get(reservationRef);
    if (!reservationSnap.exists) throw new HttpsError("not-found", "Reservation not found.");
    const reservation = reservationSnap.data()!;
    const [userSnap, pharmacySnap] = await Promise.all([
      transaction.get(db.collection("users").doc(auth.uid)),
      transaction.get(db.collection("pharmacies").doc(String(reservation.pharmacyId))),
    ]);
    const isAdmin = auth.token.admin === true;
    const isCustomer = reservation.userId === auth.uid;
    const isPharmacyOwner = pharmacySnap.exists && pharmacySnap.get("ownerId") === auth.uid;
    const account = userSnap.data();
    if (!isAdmin && (!account || account.isDisabled === true || (!isCustomer && !isPharmacyOwner))) throw new HttpsError("permission-denied", "You cannot update this reservation.");

    const current = reservation.status as Status;
    const valid = nextStatus === "CANCELLED"
      ? isCustomer && (current === "PENDING" || current === "ACCEPTED")
      : nextStatus === "ACCEPTED" || nextStatus === "REJECTED"
        ? (isPharmacyOwner || isAdmin) && current === "PENDING"
        : nextStatus === "READY"
          ? (isPharmacyOwner || isAdmin) && current === "ACCEPTED"
          : nextStatus === "COLLECTED" && (isPharmacyOwner || isAdmin) && current === "READY";
    if (!valid) throw new HttpsError("failed-precondition", `Cannot change a ${current.toLowerCase()} reservation to ${nextStatus.toLowerCase()}.`);

    if (nextStatus === "CANCELLED" || nextStatus === "REJECTED") {
      const inventoryRef = db.collection("inventory").doc(String(reservation.inventoryId));
      const inventorySnap = await transaction.get(inventoryRef);
      if (inventorySnap.exists) {
        const inventory = inventorySnap.data()!;
        const quantity = Number(inventory.quantity) + Number(reservation.quantity);
        transaction.update(inventoryRef, { quantity, status: stockStatus(quantity, Number(inventory.minimumStock) || 0), updatedAt: FieldValue.serverTimestamp() });
      }
    }

    transaction.update(reservationRef, { status: nextStatus, updatedAt: FieldValue.serverTimestamp() });
    const customerId = String(reservation.userId);
    const ownerId = String(pharmacySnap.get("ownerId") ?? "");
    const message: Record<Status, [string, string]> = {
      PENDING: ["Reservation requested", "Your request was sent to the pharmacy."],
      ACCEPTED: ["Reservation accepted", "The pharmacy accepted your reservation."],
      REJECTED: ["Reservation unavailable", "The pharmacy could not fulfil your reservation."],
      READY: ["Ready for collection", "Your reserved medicine is ready at the pharmacy."],
      COLLECTED: ["Reservation collected", "Your collection has been marked complete."],
      CANCELLED: ["Reservation cancelled", "Your reservation has been cancelled."],
      EXPIRED: ["Reservation expired", "This reservation expired and the stock was released."],
    };
    addNotification(transaction, { userId: customerId, type: "RESERVATION", title: message[nextStatus][0], body: message[nextStatus][1], pharmacyId: reservation.pharmacyId, reservationId, medicineId: reservation.medicineId });
    if (nextStatus === "CANCELLED" && ownerId) addNotification(transaction, { userId: ownerId, type: "RESERVATION", title: "Reservation cancelled", body: "A customer cancelled their reservation.", pharmacyId: reservation.pharmacyId, reservationId, medicineId: reservation.medicineId });
  });
  return { ok: true as const };
});

export const safelyDeleteInventory = onCall({ region: REGION }, async (request) => {
  const auth = requireUser(request);
  const inventoryId = assertString(request.data?.inventoryId, "inventory id");
  await db.runTransaction(async (transaction) => {
    const inventoryRef = db.collection("inventory").doc(inventoryId);
    const inventorySnap = await transaction.get(inventoryRef);
    if (!inventorySnap.exists) return;
    const inventory = inventorySnap.data()!;
    const pharmacySnap = await transaction.get(db.collection("pharmacies").doc(String(inventory.pharmacyId)));
    const userSnap = await transaction.get(db.collection("users").doc(auth.uid));
    const isAdmin = auth.token.admin === true;
    if (!isAdmin && (!userSnap.exists || userSnap.get("role") !== "PHARMACY" || userSnap.get("isDisabled") === true || pharmacySnap.get("ownerId") !== auth.uid)) {
      throw new HttpsError("permission-denied", "You cannot remove this inventory record.");
    }
    const activeQuery = db.collection("reservations").where("inventoryId", "==", inventoryId).where("status", "in", ["PENDING", "ACCEPTED", "READY"]);
    const active = await transaction.get(activeQuery);
    if (!active.empty) throw new HttpsError("failed-precondition", "This medicine has active reservations. Complete or cancel them before removing it.");
    transaction.delete(inventoryRef);
  });
  return { ok: true as const };
});

export const setAccountDisabled = onCall({ region: REGION }, async (request) => {
  const auth = requireUser(request);
  if (auth.token.admin !== true) throw new HttpsError("permission-denied", "Admin access is required.");
  const uid = assertString(request.data?.uid, "user id");
  if (uid === auth.uid) throw new HttpsError("failed-precondition", "You cannot disable your own admin account.");
  if (typeof request.data?.disabled !== "boolean") throw new HttpsError("invalid-argument", "Invalid account state.");
  await getAuth().updateUser(uid, { disabled: request.data.disabled });
  await db.collection("users").doc(uid).update({ isDisabled: request.data.disabled, updatedAt: FieldValue.serverTimestamp() });
  return { ok: true as const };
});

export const expireReservations = onSchedule({ schedule: "every 15 minutes", region: REGION, timeZone: "UTC" }, async () => {
  const now = Timestamp.now();
  for (const status of ["PENDING", "ACCEPTED"] as const) {
    const expired = await db.collection("reservations").where("status", "==", status).where("expiresAt", "<=", now).limit(100).get();
    for (const reservationSnap of expired.docs) {
      await db.runTransaction(async (transaction) => {
        const latest = await transaction.get(reservationSnap.ref);
        if (!latest.exists || (latest.get("status") !== "PENDING" && latest.get("status") !== "ACCEPTED") || latest.get("expiresAt").toMillis() > Date.now()) return;
        const inventoryRef = db.collection("inventory").doc(String(latest.get("inventoryId")));
        const inventorySnap = await transaction.get(inventoryRef);
        if (inventorySnap.exists) {
          const inventory = inventorySnap.data()!;
          const quantity = Number(inventory.quantity) + Number(latest.get("quantity"));
          transaction.update(inventoryRef, { quantity, status: stockStatus(quantity, Number(inventory.minimumStock) || 0), updatedAt: FieldValue.serverTimestamp() });
        }
        transaction.update(reservationSnap.ref, { status: "EXPIRED", updatedAt: FieldValue.serverTimestamp() });
        addNotification(transaction, { userId: latest.get("userId"), type: "RESERVATION", title: "Reservation expired", body: "This reservation expired and the stock was released.", pharmacyId: latest.get("pharmacyId"), reservationId: latest.id, medicineId: latest.get("medicineId") });
      });
    }
  }
});

export const notifyOnRestock = onDocumentWritten({ document: "inventory/{inventoryId}", region: REGION }, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!after || !before || Number(before.quantity) > 0 || Number(after.quantity) <= 0) return;
  const subscriptions = await db.collection("notificationSubscriptions")
    .where("medicineId", "==", after.medicineId).where("active", "==", true).limit(500).get();
  const matching = subscriptions.docs.filter((item) => !item.get("pharmacyId") || item.get("pharmacyId") === after.pharmacyId);
  for (let offset = 0; offset < matching.length; offset += 450) {
    const batch = db.batch();
    for (const subscription of matching.slice(offset, offset + 450)) {
      const notificationRef = db.collection("notifications").doc(`restock_${event.id}_${subscription.id}`);
      batch.set(notificationRef, {
        userId: subscription.get("userId"), type: "RESTOCK", title: "Medicine reported back in stock",
        body: "A pharmacy reported new availability. Please confirm before travelling.", read: false,
        medicineId: after.medicineId, pharmacyId: after.pharmacyId, createdAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    await batch.commit();
  }
});

export const syncPharmacyApproval = onDocumentWritten({ document: "pharmacies/{pharmacyId}", region: REGION }, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!after || before?.approvalStatus === after.approvalStatus) return;
  const approved = after.approvalStatus === "APPROVED";
  const records = await db.collection("inventory").where("pharmacyId", "==", event.params.pharmacyId).get();
  for (let offset = 0; offset < records.docs.length; offset += 450) {
    const batch = db.batch();
    for (const record of records.docs.slice(offset, offset + 450)) batch.update(record.ref, { isPublic: approved, updatedAt: FieldValue.serverTimestamp() });
    await batch.commit();
  }
  const ownerId = String(after.ownerId ?? "");
  if (ownerId && (approved || after.approvalStatus === "REJECTED")) {
    const notificationRef = db.collection("notifications").doc();
    await notificationRef.set({
      userId: ownerId, type: "PHARMACY", title: approved ? "Pharmacy approved" : "Pharmacy review update",
      body: approved ? "Your pharmacy profile is approved and can publish inventory." : "Your pharmacy profile was not approved. Contact support if you need more information.",
      read: false, pharmacyId: event.params.pharmacyId, createdAt: FieldValue.serverTimestamp(),
    });
  }
});
