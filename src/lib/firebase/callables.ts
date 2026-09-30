import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "@/lib/firebase/client";

export interface ReserveMedicineInput { pharmacyId: string; medicineId: string; quantity: number }
export interface ReserveMedicineResult { reservationId: string; expiresAt: string }
export interface UpdateReservationInput { reservationId: string; status: "ACCEPTED" | "REJECTED" | "READY" | "COLLECTED" | "CANCELLED" }
export interface DeleteInventoryInput { inventoryId: string }
export interface DisableAccountInput { uid: string; disabled: boolean }

function getFunction<TInput, TOutput>(name: string) {
  if (!firebaseApp) throw new Error("Firebase is not configured");
  return httpsCallable<TInput, TOutput>(getFunctions(firebaseApp, "us-central1"), name);
}

export async function reserveMedicine(input: ReserveMedicineInput) {
  const result = await getFunction<ReserveMedicineInput, ReserveMedicineResult>("reserveMedicine")(input);
  return result.data;
}

export async function updateReservation(input: UpdateReservationInput) {
  const result = await getFunction<UpdateReservationInput, { ok: true }>("updateReservation")(input);
  return result.data;
}

export async function safelyDeleteInventory(input: DeleteInventoryInput) {
  const result = await getFunction<DeleteInventoryInput, { ok: true }>("safelyDeleteInventory")(input);
  return result.data;
}

export async function setAccountDisabled(input: DisableAccountInput) {
  const result = await getFunction<DisableAccountInput, { ok: true }>("setAccountDisabled")(input);
  return result.data;
}
