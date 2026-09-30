export type AvailabilityStatus = "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ReservationStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "READY" | "COLLECTED" | "CANCELLED" | "EXPIRED";
export type UserRole = "USER" | "PHARMACY" | "ADMIN";

export interface Medicine {
  id: string;
  name: string;
  genericName: string;
  brand: string;
  strength: string;
  form: string;
  category: string;
  description: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Pharmacy {
  id: string;
  ownerId: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  openingHours: Record<string, string>;
  approvalStatus: ApprovalStatus;
  logoUrl?: string;
  isDemo?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface InventoryRecord {
  id: string;
  pharmacyId: string;
  medicineId: string;
  quantity: number;
  minimumStock: number;
  status: AvailabilityStatus;
  updatedAt?: unknown;
  isDemo?: boolean;
}

export interface Reservation {
  id: string;
  userId: string;
  pharmacyId: string;
  medicineId: string;
  quantity: number;
  customerName?: string;
  customerPhone?: string;
  medicineName?: string;
  pharmacyName?: string;
  inventoryId?: string;
  status: ReservationStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
  expiresAt?: unknown;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: "RESERVATION" | "RESTOCK" | "PHARMACY" | "SYSTEM";
  title: string;
  body: string;
  read: boolean;
  createdAt?: unknown;
  reservationId?: string;
  medicineId?: string;
  pharmacyId?: string;
}

export interface Favorite {
  id: string;
  userId: string;
  pharmacyId: string;
  createdAt?: unknown;
}

export function calculateStockStatus(quantity: number, minimumStock: number): AvailabilityStatus {
  if (quantity <= 0) return "OUT_OF_STOCK";
  return quantity <= minimumStock ? "LOW_STOCK" : "AVAILABLE";
}

export function getDistanceKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }): number {
  const rad = Math.PI / 180;
  const dLat = (to.latitude - from.latitude) * rad;
  const dLon = (to.longitude - from.longitude) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(from.latitude * rad) * Math.cos(to.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatUpdatedAt(value: unknown): string {
  if (!value || typeof value !== "object" || !("toDate" in value) || typeof value.toDate !== "function") return "Update time unavailable";
  const date = (value.toDate as () => Date)();
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours} hr ago`;
  return `Updated ${Math.floor(hours / 24)} days ago`;
}
